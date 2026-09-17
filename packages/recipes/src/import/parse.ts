import { ImportBatchHeaderSchema, ImportBatchSchema, IMPORT_LIMITS } from './schema';
import type { ImportIssue } from './types';

/**
 * Input parsing for `.json` (one batch object) and `.jsonl` (header line followed by one record
 * per line). Pure: takes bytes, returns a raw batch or issues. Rejects invalid UTF-8 (fatal
 * decoder), invalid JSON, non-object rows, duplicate keys and oversized records.
 */

export interface RawImportBatch {
  header: unknown;
  /** Raw records in PHYSICAL order; the compiler re-orders by explicit `batchOrder`. */
  records: unknown[];
  /** SHA-256-ready canonical bytes are computed by the caller from the original input. */
  format: 'json' | 'jsonl';
}

export type ParseResult = { ok: true; batch: RawImportBatch } | { ok: false; issues: ImportIssue[] };

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

function decode(bytes: Uint8Array): string | null {
  try { return utf8.decode(bytes); } catch { return null; }
}

/**
 * JSON.parse keeps the LAST duplicate key silently. A duplicate key in a recipe record can hide a
 * reviewer's edit, so the scanner below detects duplicates in any object of the document. It is a
 * small tokenizer, not a full parser: JSON.parse still decides validity.
 */
export function findDuplicateJsonKeys(text: string): string[] {
  const duplicates: string[] = [];
  const stack: Array<Set<string> | null> = [];
  let index = 0;
  let expectKey = false;
  const readString = (): string => {
    let out = '';
    index += 1; // opening quote
    while (index < text.length) {
      const ch = text[index];
      if (ch === '\\') { out += text[index + 1] === 'u' ? String.fromCharCode(parseInt(text.slice(index + 2, index + 6), 16)) : text[index + 1]; index += text[index + 1] === 'u' ? 6 : 2; continue; }
      if (ch === '"') { index += 1; return out; }
      out += ch; index += 1;
    }
    return out;
  };
  while (index < text.length) {
    const ch = text[index];
    if (ch === '{') { stack.push(new Set()); expectKey = true; index += 1; continue; }
    if (ch === '[') { stack.push(null); expectKey = false; index += 1; continue; }
    if (ch === '}' || ch === ']') { stack.pop(); expectKey = false; index += 1; continue; }
    if (ch === ',') { expectKey = stack.at(-1) !== null && stack.length > 0; index += 1; continue; }
    if (ch === '"') {
      const value = readString();
      const keys = stack.at(-1);
      if (expectKey && keys) {
        if (keys.has(value)) duplicates.push(value);
        keys.add(value);
        expectKey = false;
      }
      continue;
    }
    index += 1;
  }
  return [...new Set(duplicates)].sort();
}

const issue = (code: ImportIssue['code'], subject: string, detail: string, path?: string): ImportIssue =>
  ({ code, severity: 'error', subject, detail, ...(path ? { path } : {}) });

function parseObject(text: string, subject: string, issues: ImportIssue[]): Record<string, unknown> | null {
  if (text.length > IMPORT_LIMITS.maxRecordBytes && subject !== 'batch') {
    issues.push(issue('INVALID_INPUT', subject, `record exceeds ${IMPORT_LIMITS.maxRecordBytes} bytes`));
    return null;
  }
  let value: unknown;
  try { value = JSON.parse(text); } catch { issues.push(issue('INVALID_INPUT', subject, 'invalid JSON')); return null; }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) { issues.push(issue('INVALID_INPUT', subject, 'row is not a JSON object')); return null; }
  const duplicates = findDuplicateJsonKeys(text);
  if (duplicates.length) { issues.push(issue('INVALID_INPUT', subject, `duplicate JSON keys: ${duplicates.join(', ')}`)); return null; }
  return value as Record<string, unknown>;
}

export function parseImportInput(bytes: Uint8Array, format: 'json' | 'jsonl'): ParseResult {
  const text = decode(bytes);
  if (text === null) return { ok: false, issues: [issue('INVALID_INPUT', 'batch', 'input is not valid UTF-8')] };
  const issues: ImportIssue[] = [];

  if (format === 'json') {
    const value = parseObject(text, 'batch', issues);
    if (!value) return { ok: false, issues };
    const parsed = ImportBatchSchema.safeParse(value);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) issues.push(issue('INVALID_SCHEMA', 'batch', problem.message, problem.path.join('.') || 'batch'));
      return { ok: false, issues };
    }
    const { recipes, ...header } = parsed.data;
    for (const [rowIndex, record] of recipes.entries()) {
      const serialized = JSON.stringify(record);
      if (record === null || typeof record !== 'object' || Array.isArray(record)) issues.push(issue('INVALID_INPUT', `row:${rowIndex}`, 'row is not a JSON object'));
      else if (serialized.length > IMPORT_LIMITS.maxRecordBytes) issues.push(issue('INVALID_INPUT', `row:${rowIndex}`, `record exceeds ${IMPORT_LIMITS.maxRecordBytes} bytes`));
    }
    if (issues.length) return { ok: false, issues };
    return { ok: true, batch: { header, records: recipes, format } };
  }

  const lines = text.split('\n').map((line) => line.replace(/\r$/, '')).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { ok: false, issues: [issue('INVALID_INPUT', 'batch', 'empty JSONL input')] };
  const headerValue = parseObject(lines[0], 'batch', issues);
  if (!headerValue) return { ok: false, issues };
  const header = ImportBatchHeaderSchema.safeParse(headerValue);
  if (!header.success) {
    for (const problem of header.error.issues) issues.push(issue('INVALID_SCHEMA', 'batch', problem.message, problem.path.join('.') || 'batch'));
    return { ok: false, issues };
  }
  if (lines.length - 1 > IMPORT_LIMITS.maxRecordsPerBatch) return { ok: false, issues: [issue('INVALID_INPUT', 'batch', `more than ${IMPORT_LIMITS.maxRecordsPerBatch} records`)] };
  const records: unknown[] = [];
  lines.slice(1).forEach((line, rowIndex) => {
    const record = parseObject(line, `row:${rowIndex}`, issues);
    if (record) records.push(record);
  });
  if (issues.length) return { ok: false, issues };
  return { ok: true, batch: { header: header.data, records, format } };
}

/** `.json` / `.jsonl` by extension; anything else is refused (no sniffing). */
export function importFormatForPath(file: string): 'json' | 'jsonl' | null {
  if (/\.jsonl$/i.test(file)) return 'jsonl';
  if (/\.json$/i.test(file)) return 'json';
  return null;
}
