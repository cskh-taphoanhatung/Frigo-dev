import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const artifactRoot = '.hoplite/artifacts/t13b-playwright';
const sensitive = /^(?:cookies?|set-cookie|authorization|proxy-authorization|token|sessionToken|storageState)$/i;

export function redactTraceText(text) {
  const redactString = (value) => value
    .replace(/\b[a-f0-9]{64}\b/gi, '[redacted]')
    .replace(/(__Host-frigo_session=)[^;\s"\\]+/g, '$1[redacted]');
  const redact = (value) => {
    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.name === 'string' && sensitive.test(value.name)) {
      return { name: value.name, value: '[redacted]' };
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
      [key, sensitive.test(key) ? '[redacted]' : redact(entry)]));
  };
  return text.split('\n').map((line) => {
    try { return JSON.stringify(redact(JSON.parse(line))); }
    catch { return redactString(line); }
  }).join('\n');
}

export async function sanitizeBrowserArtifacts(root = artifactRoot) {
  for (const entry of await readdir(root, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await sanitizeBrowserArtifacts(file);
    } else if (entry.name.endsWith('.zip')) {
      const archive = unzipSync(await readFile(file));
      for (const [name, bytes] of Object.entries(archive)) {
        if (/\.(trace|network|stacks|json|txt|md)$/.test(name) || name.startsWith('attachments/')) {
          try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            archive[name] = strToU8(redactTraceText(text));
          } catch {
            // Binary screenshots are retained as images, not parsed as text.
          }
        }
      }
      await writeFile(file, zipSync(archive));
    } else if (/\.(json|txt|md)$/.test(entry.name)) {
      await writeFile(file, redactTraceText(strFromU8(await readFile(file))));
    }
  }
}

export default class PrivateArtifactReporter {
  async onEnd() { await this.sanitize(); }
  async onExit() { await this.sanitize(); }
  async sanitize() {
    try {
      // Older HTML reports contain encoded, unsanitized in-memory results.
      await rm(path.join(artifactRoot, 'report'), { recursive: true, force: true });
      await sanitizeBrowserArtifacts();
    }
    catch {
      await rm(artifactRoot, { recursive: true, force: true });
      throw new Error('Browser artifact redaction failed; artifacts removed');
    }
  }
}
