import { createHash } from 'node:crypto';

export interface FakeR2StoredObject {
  bytes: Uint8Array;
  contentType?: string;
}

/**
 * Deterministic in-memory R2 double for recipe media tests. Mirrors the parts of `R2Bucket.get`
 * the application relies on (`size`, `httpMetadata.contentType`, `body`, `arrayBuffer`) and records
 * every requested key so tests can prove no arbitrary reads. Never touches a real bucket.
 */
export class FakeR2 {
  readonly objects = new Map<string, FakeR2StoredObject>();
  readonly requestedKeys: string[] = [];
  /** Test seam: makes the next `get` reject, to exercise OBJECT_READ_FAILED paths. */
  failNextGet: Error | null = null;

  put(key: string, bytes: Uint8Array, contentType?: string): void {
    this.objects.set(key, { bytes, contentType });
  }

  async get(key: string) {
    this.requestedKeys.push(key);
    if (this.failNextGet) { const error = this.failNextGet; this.failNextGet = null; throw error; }
    const object = this.objects.get(key);
    if (!object) return null;
    const bytes = object.bytes;
    return {
      key,
      size: bytes.byteLength,
      httpMetadata: object.contentType ? { contentType: object.contentType } : undefined,
      body: new Blob([bytes as BlobPart]).stream(),
      arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
    };
  }
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Minimal RIFF/WEBP-looking fixture bytes; content, not validity, is what the tests hash. */
export const WEBP_FIXTURE_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
export const WEBP_FIXTURE_SHA256 = sha256Hex(WEBP_FIXTURE_BYTES);
