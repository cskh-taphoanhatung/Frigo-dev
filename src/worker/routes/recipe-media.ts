/**
 * T14C — same-origin canonical recipe media route (ADR-025).
 *
 *   GET /api/v1/recipe-media/:recipeId/:role/:version
 *
 * Every path component is validated against closed shapes, the trusted `storage_key` comes from D1
 * (and must equal the deterministic key for that row), the object is read from the existing `IMAGES`
 * binding, and only allow-listed raster MIME types leave the Worker. No request parameter ever
 * reaches `IMAGES.get` unchanged, so this route cannot browse the bucket or proxy external hosts.
 * Public read-only: it is mounted before the auth middleware, like /health.
 */
import { Hono } from 'hono';
import {
  auditReadyRecipeMediaRecord,
  isCanonicalRecipeIdShape,
  isRecipeMediaMimeType,
  isRecipeMediaRole,
  isTrustedRecipeMediaStorageKey,
  parseRecipeMediaVersion,
  type RecipeMediaRecord,
} from '@frigo/recipes';
import { D1RecipeMediaCatalog } from '@frigo/db';
import type { Env } from '../types';
import { emitRecipeMediaDiagnostic } from '../services/recipe-media';

export const RECIPE_MEDIA_IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const NOT_FOUND_CACHE_CONTROL = 'no-store';
const ROUTE_PATH = '/recipe-media/:recipeId/:role/:version';

type MediaResolution =
  | { ok: true; record: RecipeMediaRecord }
  | { ok: false; status: 404 | 409 | 415 | 503; code: string };

function respondError(status: 404 | 409 | 415 | 503, code: string): Response {
  return new Response(JSON.stringify({ error: 'Recipe media unavailable', code }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NOT_FOUND_CACHE_CONTROL, 'x-content-type-options': 'nosniff' },
  });
}

/** Raw (undecoded) segments are checked too, so `%2e%2e`, `%2f` and `%5c` can never normalise into a key. */
function hasSuspiciousRawPath(rawPath: string): boolean {
  return /%2e|%2f|%5c|\\|\.\.|%25/i.test(rawPath);
}

export async function resolveCanonicalRecipeMedia(env: Pick<Env, 'DB'>, rawPath: string, recipeId: string, role: string, version: string): Promise<MediaResolution> {
  if (hasSuspiciousRawPath(rawPath)) return { ok: false, status: 404, code: 'RECIPE_MEDIA_INVALID_PATH' };
  if (!isCanonicalRecipeIdShape(recipeId)) return { ok: false, status: 404, code: 'RECIPE_MEDIA_INVALID_RECIPE' };
  if (!isRecipeMediaRole(role)) return { ok: false, status: 404, code: 'RECIPE_MEDIA_INVALID_ROLE' };
  const parsedVersion = parseRecipeMediaVersion(version);
  if (parsedVersion === null) return { ok: false, status: 404, code: 'RECIPE_MEDIA_INVALID_VERSION' };
  if (!env.DB) return { ok: false, status: 503, code: 'RECIPE_MEDIA_UNAVAILABLE' };

  let record: RecipeMediaRecord | null;
  try {
    record = await new D1RecipeMediaCatalog(env.DB).readVersion(recipeId, role, parsedVersion);
  } catch {
    emitRecipeMediaDiagnostic('recipe_media_read_failed', { recipeId, role, version: parsedVersion, code: 'D1_READ_FAILED' });
    return { ok: false, status: 503, code: 'RECIPE_MEDIA_UNAVAILABLE' };
  }
  if (!record) {
    emitRecipeMediaDiagnostic('recipe_media_metadata_missing', { recipeId, role, version: parsedVersion });
    return { ok: false, status: 404, code: 'RECIPE_MEDIA_NOT_FOUND' };
  }
  if (record.status !== 'ready') {
    emitRecipeMediaDiagnostic('recipe_media_not_ready', { recipeId, role, version: parsedVersion, code: record.status });
    return { ok: false, status: 409, code: `RECIPE_MEDIA_${record.status.toUpperCase()}` };
  }
  const issues = auditReadyRecipeMediaRecord(record);
  if (issues.length > 0 || !record.storageKey || !record.mimeType) {
    emitRecipeMediaDiagnostic('recipe_media_invalid', { recipeId, role, version: parsedVersion, code: issues[0] ?? 'incomplete' });
    return { ok: false, status: issues.includes('unsupported_mime_type') ? 415 : 409, code: 'RECIPE_MEDIA_METADATA_INVALID' };
  }
  if (!isTrustedRecipeMediaStorageKey(record.storageKey, record.recipeId, record.role, record.version, record.mimeType)) {
    emitRecipeMediaDiagnostic('recipe_media_invalid', { recipeId, role, version: parsedVersion, code: 'untrusted_storage_key' });
    return { ok: false, status: 409, code: 'RECIPE_MEDIA_METADATA_INVALID' };
  }
  return { ok: true, record };
}

export const recipeMediaRoutes = new Hono<{ Bindings: Env }>();

async function serve(c: { env: Env; req: { path: string; raw: Request; param(name: string): string } }, includeBody: boolean): Promise<Response> {
  const resolution = await resolveCanonicalRecipeMedia(c.env, new URL(c.req.raw.url).pathname, c.req.param('recipeId'), c.req.param('role'), c.req.param('version'));
  if (!resolution.ok) return respondError(resolution.status, resolution.code);
  const { record } = resolution;
  if (!c.env.IMAGES) return respondError(503, 'RECIPE_MEDIA_UNAVAILABLE');

  // storageKey is the D1 value already proven equal to the deterministic derivation — never request input.
  const object = await c.env.IMAGES.get(record.storageKey as string);
  if (!object) {
    emitRecipeMediaDiagnostic('recipe_media_object_missing', { recipeId: record.recipeId, role: record.role, version: record.version });
    return respondError(404, 'RECIPE_MEDIA_OBJECT_MISSING');
  }
  const objectMime = object.httpMetadata?.contentType ?? null;
  if (objectMime !== null && objectMime !== record.mimeType) {
    emitRecipeMediaDiagnostic('recipe_media_mime_rejected', { recipeId: record.recipeId, role: record.role, version: record.version, code: 'object_mime_mismatch' });
    return respondError(415, 'RECIPE_MEDIA_MIME_REJECTED');
  }
  if (!isRecipeMediaMimeType(record.mimeType)) return respondError(415, 'RECIPE_MEDIA_MIME_REJECTED');
  if (record.contentLength !== null && object.size !== record.contentLength) {
    emitRecipeMediaDiagnostic('recipe_media_invalid', { recipeId: record.recipeId, role: record.role, version: record.version, code: 'object_size_mismatch' });
    return respondError(409, 'RECIPE_MEDIA_METADATA_INVALID');
  }

  const etag = `"${record.contentHash}"`;
  const headers = new Headers({
    'content-type': record.mimeType,
    'content-length': String(object.size),
    'cache-control': RECIPE_MEDIA_IMMUTABLE_CACHE_CONTROL,
    etag,
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline',
    'cross-origin-resource-policy': 'same-origin',
  });
  if (c.req.raw.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  if (!includeBody) return new Response(null, { status: 200, headers });
  // Workers' ReadableStream type is structurally narrower than lib.dom's; the runtime object is the same.
  return new Response(object.body as unknown as BodyInit, { status: 200, headers });
}

recipeMediaRoutes.get(ROUTE_PATH, (c) => serve(c, true));
recipeMediaRoutes.on('HEAD', ROUTE_PATH, (c) => serve(c, false));
