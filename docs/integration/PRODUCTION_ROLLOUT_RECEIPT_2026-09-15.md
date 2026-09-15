# Production Rollout Receipt — 2026-09-15

## Result

Production rollout completed after the rolling-schema rehearsal and explicit
operator authorization. The canonical repository remains `vn-dlo/Frigo-dev`
and production is serving Worker SHA
`e6b91956484589c088e6d04a9835b3e59a2eb786`.

## Database

- Database: `frigo-db` (`f975ec39-b2c8-4a2a-80e1-0366054599d3`)
- Migration ledger: `0001`-`0033`
- Read-only gate: `pnpm schema:check:remote` PASS
- Backup/export: `/tmp/frigo-prod-pre0032-20260916.sql`
- Export SHA-256: `378c023b15c159d140162e6eb74bbf2ad584e7b699c72384379119defe6dec6a`

The direct ad-hoc Wrangler query path returned Cloudflare `SQLITE_AUTH`; no
write was performed by that failed query. Schema evidence therefore comes from
the repository-owned remote gate, which completed successfully.

## Deployment and smoke

Compatibility Worker `64ee9ed1d986a5e521598a36656e9c2f59d682ee` was deployed
before the bridge migration. Canonical Worker
`e6b91956484589c088e6d04a9835b3e59a2eb786` was then deployed with
`GIT_COMMIT` stamping. Production readiness returned HTTP 200 and the exact
canonical SHA with database/queue healthy, AI configured, and `config.ok=true`.
The only reported issue is the existing warning
`CONFIG_PLUS_GRANT_SECRET_MISSING`.

Public health, recipe reads, Takosan PWA manifest/branding, and unauthenticated
mutation boundaries were checked. Worker tail for the exact version showed no
exceptions while serving the smoke request.

## Follow-up and safety

PR #4 (`release/pre0032-schema-compat`) remains open and has no hosted checks.
It must receive normal CI and maintainer review before merge; branch protection
was not bypassed. Until then, the deployed compatibility SHA is traceable but
not reachable from canonical `main`.

No PayOS/payment change, DNS change, secret rotation, production KV/R2/queue
data mutation, or T14 work was performed.
