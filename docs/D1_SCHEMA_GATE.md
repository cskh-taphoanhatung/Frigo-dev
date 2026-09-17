# D1 schema gate

Run the read-only gate before any Worker release or D1 migration apply:

```bash
pnpm schema:check:local
pnpm schema:check:remote
```

The gate verifies that migrations `0001` through `0012` are recorded in
`d1_migrations`, required core/Week tables and columns exist, and
the meal-plan household ownership trigger and scan queue ledger exist. It also requires
`pragma_foreign_key_check` to return no violations. It only executes a schema
inspection query; it never applies migrations or deploys the Worker.

Set `D1_DATABASE` only when checking a database other than `frigo-db`:

```bash
D1_DATABASE=frigo-staging pnpm schema:check:remote
```

A failed gate is a release blocker. Export/backup the target, reconcile its
migration history and schema, then rerun the gate before any apply or deploy.

The gate is a single statement. Cloudflare D1 (workerd) caps compound SELECTs
at five terms (`SQLITE_LIMIT_COMPOUND_SELECT`), so `scripts/d1-schema-gate.sql`
must keep exactly five `UNION ALL` branches: migrations, tables, columns,
indexes+triggers (one `required_schema_objects(type, name)` list) and foreign
keys. Add new requirements to those lists; never add a sixth branch.

For the complete production release gate, run:

```bash
CHECK_REMOTE_SCHEMA=1 pnpm check
```

Normal local/CI `pnpm check` skips the remote query so it does not require a
Cloudflare login.
