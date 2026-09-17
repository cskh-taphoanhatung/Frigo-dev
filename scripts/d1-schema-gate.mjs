import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The read-only D1 schema gate derives its required-migration list from the repository's
// `migrations/` directory at the checked-out commit, so the gate can never lag behind an
// additive migration. `release-check.mjs`/`d1-migration-check.mjs` derive the same list
// from `git ls-tree` at the pinned SHA; a deploy/migration job checks out exactly that SHA.
export const MIGRATION_NAME = /^\d{4}_[A-Za-z0-9_-]+\.sql$/;
export const REQUIRED_MIGRATIONS_MARKER = '-- @required_migrations';

export function listMigrations(directory = path.resolve(process.cwd(), 'migrations')) {
  const names = readdirSync(directory).filter((name) => name.endsWith('.sql')).sort();
  if (names.length === 0) throw new Error('No migrations found');
  names.forEach((name, index) => {
    if (!MIGRATION_NAME.test(name) || Number(name.slice(0, 4)) !== index + 1) {
      throw new Error('Migration sequence is malformed, duplicated, or has a gap');
    }
  });
  return names;
}

export function migrationTip(directory) {
  return listMigrations(directory).at(-1);
}

/** Renders the gate SQL with `required_migrations` populated from the migration directory. */
export function renderSchemaGateSql({
  template = path.resolve(process.cwd(), 'scripts/d1-schema-gate.sql'),
  migrationsDirectory,
} = {}) {
  const source = readFileSync(template, 'utf8');
  const markers = source.split('\n').filter((line) => line.trim() === REQUIRED_MIGRATIONS_MARKER);
  if (markers.length !== 1) throw new Error(`Schema gate template must contain exactly one ${REQUIRED_MIGRATIONS_MARKER} line`);
  const values = listMigrations(migrationsDirectory).map((name) => `    ('${name}')`).join(',\n');
  return source.replace(REQUIRED_MIGRATIONS_MARKER, values);
}

/** Single-line form for `wrangler d1 execute --command` (comments and blank lines removed). */
export function renderSchemaGateCommand(options) {
  return renderSchemaGateSql(options)
    .split('\n')
    .filter((line) => !/^\s*--/.test(line) && line.trim() !== '')
    .join(' ');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];
  if (command === 'render') process.stdout.write(renderSchemaGateCommand());
  else if (command === 'tip') process.stdout.write(migrationTip());
  else { console.error('Usage: d1-schema-gate.mjs <render|tip>'); process.exitCode = 2; }
}
