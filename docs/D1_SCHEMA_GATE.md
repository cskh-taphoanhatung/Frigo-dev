# D1 schema gate

Run the read-only gate before any Worker release or D1 migration apply:

```bash
pnpm schema:check:local
pnpm schema:check:remote
```

The gate verifies that `d1_migrations` equals **exactly** the repository's `migrations/`
directory at the checked-out commit (`0001` through the current tip, contiguous — a missing
entry reports `missing_migration`, an entry the repository does not know reports
`unexpected_migration`), that required tables/columns/indexes/triggers exist, and that
`pragma_foreign_key_check` returns no violations. The required-migration list is rendered by
`scripts/d1-schema-gate.mjs` into the `-- @required_migrations` marker of
`scripts/d1-schema-gate.sql`, so the gate can never lag behind an additive migration; never
hand-edit that list. `node scripts/d1-schema-gate.mjs tip` prints the required tip. The gate
only executes a schema inspection query; it never applies migrations or deploys the Worker.

Set `D1_DATABASE` only when checking a database other than `frigo-db`:

```bash
D1_DATABASE=frigo-staging pnpm schema:check:remote
```

A failed gate is a release blocker. Export/backup the target, reconcile its
migration history and schema, then rerun the gate before any apply or deploy.

The gate is a single statement. Cloudflare D1 (workerd) caps compound SELECTs
at five terms (`SQLITE_LIMIT_COMPOUND_SELECT`), so `scripts/d1-schema-gate.sql`
must keep exactly five top-level `UNION ALL` branches: migration ledger (one CTE that
unions missing + unexpected), tables, columns, indexes+triggers (one
`required_schema_objects(type, name)` list) and foreign keys. Add new requirements to
those lists; never add a sixth top-level branch.

The production migration workflow (`production-d1-migrate.yml`) applies the exact pinned
chain `expected_pre_tip → migration` from one immutable SHA, then certifies the catalog
against the shipped release manifest (`d1-migration-check.mjs catalog`: legacy 71 + every
approved batch whose migration is applied, contiguous runtime order, complete rows, media
still pending) before running this gate.

For the complete production release gate, run:

```bash
CHECK_REMOTE_SCHEMA=1 pnpm check
```

Normal local/CI `pnpm check` skips the remote query so it does not require a
Cloudflare login.
