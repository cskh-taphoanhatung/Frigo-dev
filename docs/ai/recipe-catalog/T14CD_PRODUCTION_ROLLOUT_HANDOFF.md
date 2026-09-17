# T14C + T14D production debt closure — OPS handoff (2026-09-17)

```text
STATUS=OPS_WORKFLOW_MERGED · AWAITING_OPERATOR_WORKFLOW_DISPATCH
repository_id=1368281478
repository_full_name=frigo-2/Frigo-dev            (owner renamed from frigo-1/vn-taphoanhatung; ID is canonical)
starting_main=ed34c6b926ddb62c79e3fb2b5dcdac1cca8eab8b   (validate SUCCESS run 35158817101)
OPS_WORKFLOW_PR=#21
OPS_WORKFLOW_MERGE_SHA=6910a7b4aee875f061454528daf6b4f0777e7f1a
OPS_CANONICAL_MAIN=6910a7b4aee875f061454528daf6b4f0777e7f1a   (validate SUCCESS run 35168563076)
DEPLOY_SHA=6910a7b4aee875f061454528daf6b4f0777e7f1a
hardened_sha=bb504cce7476927249b3c6e4d5bc634600a45883        (T14D application merge; ancestor of DEPLOY_SHA)
```

Application tree `src/ packages/ migrations/ wrangler*.jsonc package.json pnpm-lock.yaml` is byte-identical between
`ed34c6b9…` and `6910a7b4…` (`git diff --stat` empty). PR #21 changed only `.github/workflows/production-d1-migrate.yml`,
`scripts/d1-migration-check.mjs`, `scripts/d1-schema-gate.sql`, `tests/unit/d1-migration-check.test.mjs`, `DEPLOYMENT.md`,
`docs/D1_SCHEMA_GATE.md`.

## 1. Proven state (read-only, 2026-09-17T00:20–01:01Z)

| Item | Evidence |
| --- | --- |
| Repository ID | `GET /repositories/1368281478` → `frigo-2/Frigo-dev`, public, default `main` |
| GitHub Environments | `production` (id 22061338944, required reviewer `vn-taphoanhatung`, admins may bypass), `staging` (no rules) |
| Env secrets usable | Deploy run 35102115354 (production job: schema gate + `wrangler deploy` SUCCESS) and 35168741683 (staging) prove `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` exist in both Environments; names only, values never read |
| `PRODUCTION_URL` / `STAGING_URL` | present (used by past successful smoke steps) — `https://frigo.tungjpstore.net`, `https://frigo-staging.tungbipdz.workers.dev` |
| Production app | `/api/v1/health/ready` → `commit=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6`, `environment=production`, `database=ok`, status `degraded` only from pre-existing `CONFIG_PLUS_GRANT_SECRET_MISSING` warning |
| Production recipes | `/api/v1/recipes` → 71 (59 `vn-*`, 12 `gl-*`), first `vn-canh-01`, last `gl-12`; no `media` field (pre-T14C Worker) |
| Production media route | `/api/v1/recipe-media/vn-canh-01/hero/1` → 401 (route not mounted on the old Worker; SPA/auth fallback) |
| Staging app | `commit=6910a7b4…`, `status=ok`; `/recipes` 71 with `media.hero.source` = 59 `legacy_external` + 12 `legacy_static`, 0 `canonical_r2` |
| Production D1 ledger | NOT read in this session (no Cloudflare credential in the sandbox; expected tip 0034 per T14B-B receipt). The migration workflow reads it before any mutation. |
| Local Wrangler auth | `pnpm wrangler whoami` → not authenticated (expected; not a blocker) |

## 2. Why this stopped before mutation

The migration and deploy workflows are `workflow_dispatch`-only by design. The Hoplite toolset can list/inspect/rerun runs
but has **no workflow-dispatch capability**, and the sandbox has no GitHub token (`POST …/dispatches` → 401). Rerunning an
old dispatch run would replay stale inputs and was not attempted. Reported to Hoplite as missing tooling. Nothing in
production (D1 or Worker) was mutated.

## 3. Operator sequence (exact inputs; each step gated by the workflow itself)

### 3a. Production D1 Migration — `.github/workflows/production-d1-migrate.yml` (Actions → "Production D1 Migration" → Run workflow, branch `main`)

```text
ref                          = 6910a7b4aee875f061454528daf6b4f0777e7f1a
expected_pre_tip             = 0034_global_recipe_catalog_parity.sql
migration                    = 0035_recipe_media_layer.sql
confirm_production_migration = true
```

Behaviour: `gate` job verifies full SHA ∈ main, tip 0035 / predecessor 0034, 34 pinned hashes, exact-head validate
SUCCESS. `migrate` job waits for `production` Environment approval, then: credentials present → `whoami` + `d1 list`
(+ `d1 info`) must equal `frigo-db` / `f975ec39-b2c8-4a2a-80e1-0366054599d3` → ledger (34 rows / tip 0034 ⇒ `apply`;
35 rows / tip 0035 ⇒ `certify`, no re-apply; anything else ⇒ stop) → `d1 time-travel info --json` bookmark (rollback
receipt, logged) → counts-only baseline → plan must be exactly `0035_recipe_media_layer.sql` → `d1 migrations apply
frigo-db --remote` → post ledger 35/0035 → drift none, FK `[]`, `quick_check ok`, `recipe_media` 71/71 hero/71 pending/
0 ready + schema contract → `scripts/d1-schema-gate.sh remote`. Artifact `d1-migration-receipt-<run>-<attempt>` (sanitized).

Locally rehearsed end-to-end on a fresh 0001→0034 local D1 (see PR #21): identical expected values.

### 3b. Staging exact release — `Deploy` workflow_dispatch (branch `main`)

```text
environment=staging   ref=6910a7b4aee875f061454528daf6b4f0777e7f1a   hardened_sha=bb504cce7476927249b3c6e4d5bc634600a45883   confirm_production=false
```

Already satisfied incidentally: auto run 35168741683 (release SUCCESS, staging SUCCESS, smoke + exact-SHA receipt
SUCCESS; readiness `commit=6910a7b4…`). A manual staging dispatch is optional; `KNOWN_OPS_P2_STAGING_SHA_PROPAGATION_RACE`
did not occur.

### 3c. Production deploy — `Deploy` workflow_dispatch (branch `main`), ONLY after 3a PASS

```text
environment=production   ref=6910a7b4aee875f061454528daf6b4f0777e7f1a   hardened_sha=bb504cce7476927249b3c6e4d5bc634600a45883   confirm_production=true
```

Production job re-runs local gates, rechecks exact-head CI, runs the **read-only** schema gate + ledger receipt (fails
closed if 0035 is absent), deploys `--var GIT_COMMIT:<sha>`, smokes `/health/ready` for the exact SHA. Recipe authority
variables are NOT set: `RECIPE_CATALOG_MODE` unset ⇒ `static`; `RECIPE_CATALOG_CUTOVER_ENABLED` unset.

### 3d. Post-deploy smoke (read-only) and receipts

`/api/v1/health` 200; `/health/ready` `commit=6910a7b4…`, `database=ok` (`CONFIG_PLUS_GRANT_SECRET_MISSING` may persist —
pre-existing); `/recipes` 71/59/12 same order with `media.hero.source` legacy only (`canonical_r2=0`);
`/api/v1/recipe-media/vn-canh-01/hero/1` → **409 `RECIPE_MEDIA_PENDING`**; auth/google/config 200; CORS preflight 204;
Worker version from the deploy log; `wrangler tail` window: no `recipe_media`/D1/authority/planner/inventory errors.
Then write `T14C_FINAL_COMPLETION.md` and `T14D_PRODUCTION_DEPLOY_RECEIPT.md` from the run artifacts, mark
`T14C_PRODUCTION_COMPLETE` · `T14D_PRODUCTION_RUNTIME_DEPLOYED` · `T14D_AUTHORITY_CUTOVER_NOT_STARTED`, and freeze the
docs-closure merge SHA as `OPS_FINAL_CANONICAL_MAIN`.

## 4. Incidental finding fixed in PR #21 (would have blocked 3c)

`scripts/d1-schema-gate.sql` at T14C had six `UNION ALL` branches; Cloudflare D1/workerd enforces
`SQLITE_LIMIT_COMPOUND_SELECT=5` (`too many terms in compound SELECT: SQLITE_ERROR`, reproduced on the local D1
emulator: 5 terms OK, 6 fail). The read-only pre-deploy gate in `deploy.yml` would therefore have failed for every
production run of `3a1e6be6…`/`bb504cce…`/`ed34c6b9…`. Indexes and triggers now share one branch; the gate still fails
closed (verified: missing index + missing trigger both reported). Required objects unchanged.

## 5. Hard limits for this packet (unchanged)

No shadow/canary/d1 activation; no media population; no T14E; no force push; no manual ledger edits; no raw DB export
uploaded to the public repository; Time Travel bookmark is the rollback receipt; do not restore unless corruption is
proven. If 3a reports missing Cloudflare secrets → `PRODUCTION_CREDENTIAL_PATH_BLOCKED` (operator configures the
Environment; never paste token values anywhere).
