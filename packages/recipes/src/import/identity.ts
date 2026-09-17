import type { ImportSourceIdentity } from './types';

/**
 * Stable identity for imported recipes (T14E).
 *
 * canonical recipe ID = `imp-` + first 16 hex chars of SHA-256(`<sourceNamespace>:<sourceRecordId>`)
 *
 * Properties: deterministic (same source record ⇒ same ID forever), independent of title/slug/
 * position, compatible with the T14C media identity rule `^[a-z0-9]+(?:-[a-z0-9]+)*$` (≤ 64 chars)
 * and with `CatalogIdSchema`. The `imp-` prefix keeps imports out of the `vn-*` / `gl-*` legacy
 * namespaces. A 64-bit truncation is ample for ≤ 10^5 recipes; the compiler still detects any
 * collision explicitly and fails closed instead of renumbering.
 */

export const IMPORT_RECIPE_ID_PREFIX = 'imp-';
export const IMPORT_RECIPE_ID_HEX_LENGTH = 16;
export const IMPORT_RECIPE_ID_PATTERN = /^imp-[0-9a-f]{16}$/;
/** Slugs are reviewer-supplied romanized identifiers; no locale-dependent transliteration is attempted. */
export const IMPORT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const IMPORT_SLUG_MAX_LENGTH = 100;

export async function sha256Hex(text: string | Uint8Array): Promise<string> {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sourceKeyOf(identity: ImportSourceIdentity): string {
  return `${identity.sourceNamespace}:${identity.sourceRecordId}`;
}

export async function deriveImportRecipeId(identity: ImportSourceIdentity): Promise<string> {
  const hash = await sha256Hex(sourceKeyOf(identity));
  return `${IMPORT_RECIPE_ID_PREFIX}${hash.slice(0, IMPORT_RECIPE_ID_HEX_LENGTH)}`;
}

export function isImportRecipeId(value: unknown): value is string {
  return typeof value === 'string' && IMPORT_RECIPE_ID_PATTERN.test(value);
}

export function isValidImportSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= IMPORT_SLUG_MAX_LENGTH && IMPORT_SLUG_PATTERN.test(value);
}

/** Deterministic, key-sorted JSON used for every hash/fingerprint in the factory. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).filter((key) => row[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
