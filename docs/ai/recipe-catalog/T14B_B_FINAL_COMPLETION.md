# T14B-B final completion — production D1 0034 applied, Worker deployed (2026-09-16)

```text
repo=vn-taphoanhatung/Frigo-dev (formerly cskh-taphoanhatung/Frigo-dev; old path 301-redirects)
repository_id=1368281478
PR14_HEAD=004e5a320397b71e7bff5a65b8f5efa9a7a09065
T14B_B_MERGE_SHA=c7455160bfc8d279d38bc7ca4c0751542012a3c5
ROLLOUT_RECEIPT_MAIN=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6   (PR #15 merge; exact-head validate=SUCCESS)
DEPLOYED_SHA=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6
HARDENED_SHA_INPUT=af661af467ba8620ba6b2919ee958195d179380c
STATUS=T14B_B_COMPLETE
```

All items below were executed in this session by an operator-authorized interactive Cloudflare OAuth
login (Wrangler) and GitHub device-code login. No credential, OAuth code, or API token value was
displayed in chat, logged, or committed.

## 1. Cloudflare / D1 identity (AC6–AC8)

```text
CF_AUTH=wrangler OAuth (scopes incl. account:read, workers:write, d1:write, queues:write)
CF_ACCOUNT_ID=ef250a88911fd24073cb73d1c07e0218
D1_BINDING=DB
D1_DATABASE_NAME=frigo-db
D1_DATABASE_ID=f975ec39-b2c8-4a2a-80e1-0366054599d3        (matches wrangler.jsonc; d1 list + d1 info agree)
D1_TABLES_BEFORE=70
```

## 2. Pre-migration ledger and baseline (AC9)

```text
LEDGER_BEFORE=33 rows; first=0001_initial_schema.sql; tip=0033_scan_evidence_completeness.sql; 0034/0035 absent
WRANGLER_PLAN=exactly one pending: 0034_global_recipe_catalog_parity.sql
BASELINE_AGGREGATES: users=35 households=35 inventory_items=41 inventory_lots=0 inventory_events=43
  inventory_commands=0 inventory_observations=0 inventory_adoption_receipts=0
  inventory_reconciliation_decisions=0 cooked_meals=0 meal_plans=3 scans=24
  recipes=59 recipe_ingredients=328 recipe_steps=295
```

## 3. Backup (AC10)

```text
BACKUP_METHOD=pnpm wrangler d1 export frigo-db --remote --output <path>
BACKUP_PATH=/tmp/d1-backup/frigo-db-pre-0034-20260916T130027Z.sql   (sandbox-local, mode 0600; not committed)
BACKUP_TIMESTAMP=2026-09-16T13:00:27Z
BACKUP_SIZE=1055211 bytes
BACKUP_SHA256=ab082dd4f8a73062f6678d9e46406a7914d14012b609cb45891515862280343c
BACKUP_SANITY=70 CREATE TABLE, 1491 INSERT statements, 33 d1_migrations rows
```

Operator note: the export lives in the thread sandbox. Copy it to durable operator storage if
long-term retention is required; the sandbox is not a backup vault.

## 4. Migration receipt (AC11–AC13)

```text
MIGRATION_FILE=migrations/0034_global_recipe_catalog_parity.sql
MIGRATION_SHA256=23f356458a294b240e683fec14012bc932a8b7e57ad0c932e4fc184329bada4d   (matches merge receipt)
COMMAND=pnpm wrangler d1 migrations apply frigo-db --remote
RESULT=✅ 0034_global_recipe_catalog_parity.sql — 11 commands executed in 17.19 ms
LEDGER_AFTER=34 rows; tip=0034_global_recipe_catalog_parity.sql; 0035 absent
```

## 5. Post-migration certification (AC14–AC23)

| Check | Result |
| --- | --- |
| recipes / VN / global | 71 / 59 / 12 (`gl-01..gl-12`) |
| recipe_ingredients / recipe_steps | 385 / 341 |
| recipe_runtime_fields / recipe_runtime_ingredient_order | 71 / 385 |
| recipe_classifications / recipe_nutrition | 0 / 0 |
| `runtime_order` | 71 rows, 71 distinct, min 0, max 70 |
| `region` | bac 18 · trung 4 · nam 11 · toan_quoc 26 · NULL 12 (global recipes; closed vocabulary respected) |
| `category` | 59 VN non-empty; 12 global NULL (schema: `category IS NULL OR non-empty`; typed open field) |
| Ingredient ordinals | missing 0 · recipe mismatch 0 · non-contiguous (0..n-1) 0 · 71 recipes covered |
| Orphans | runtime_fields without recipe 0 · recipes without runtime_fields 0 |
| `PRAGMA foreign_key_check` | `[]` |
| `PRAGMA quick_check` | `ok` |
| `PRAGMA integrity_check` | **rejected by D1** (`not authorized: SQLITE_AUTH [code 7500]`) — platform restriction, recorded, not hidden |
| Non-recipe aggregates after | identical to baseline (users 35, households 35, inventory_items 41, lots 0, events 43, commands 0, observations 0, adoption 0, recon 0, cooked_meals 0, meal_plans 3, scans 24) → **zero drift** |
| `bash scripts/d1-schema-gate.sh remote` (AC24) | **PASS** — "required migrations (0001-0034 …) and foreign keys are valid" |

## 6. GitHub deployment configuration (AC25–AC26)

```text
GH_AUTH=gh device-code login as vn-taphoanhatung (repo admin); scopes repo, workflow
ENV_staging=existing; ENV_production=created with required_reviewers=[repo owner]
SECRETS(staging, production)=CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
  - API token created by the operator in the Cloudflare dashboard (template "Edit Cloudflare Workers"
    + Account·D1·Edit + Account·Queues·Edit, scoped to account …c07e0218 / zone tungjpstore.net)
  - Verified before storage: /user/tokens/verify=active; workers/scripts, d1/database, queues on the
    account all authorized. Value never displayed or logged; set via `gh secret set --env`.
REPO_VARS=STAGING_URL=https://frigo-staging.tungbipdz.workers.dev ; PRODUCTION_URL=https://frigo.tungjpstore.net
WORKFLOW_FILES_CHANGED=none (.github/workflows/deploy.yml untouched)
```

## 7. Deployment (AC27–AC32)

```text
STAGING_DEPLOY_RUN=35101845374 (workflow_dispatch; environment=staging; ref=4ed98514…; hardened_sha=af661af4…)
  release=SUCCESS  staging=SUCCESS (Deploy + "Staging post-deploy smoke and SHA receipt" SUCCESS)  production=SKIPPED
  staging /api/v1/health/ready → status=ok commit=4ed98514… env=staging; /api/v1/recipes → 71/59/12
PRODUCTION_DEPLOY_RUN=35102115354 (workflow_dispatch; environment=production; confirm_production=true)
  release=SUCCESS → production waited on environment approval → approved by repo owner in GitHub UI
  production=SUCCESS: Local gates ✅ · Recheck exact-head CI ✅ · Pre-deploy schema gate + ledger receipt ✅ ·
  Deploy to Cloudflare production ✅ · Production post-deploy smoke and exact SHA receipt ✅
PRODUCTION_DEPLOYED_SHA=4ed98514f65ddd3b3d83007cd726fd7c2e2136e6
PRODUCTION_WORKER_VERSION=56979cb5-e1a8-4241-8a4c-2432d41cc439 (100%, created 2026-09-16T13:33:27Z)
```

## 8. Production smoke (AC33–AC38)

| Probe | Result |
| --- | --- |
| `GET /api/v1/health` | 200 `{"status":"ok"}` |
| `GET /api/v1/health/ready` | `status=degraded`, `commit=4ed98514…`, `environment=production`, database/queue ok, ai/email configured; config issue `CONFIG_PLUS_GRANT_SECRET_MISSING` (warning) — **pre-existing** (identical before deploy), not introduced by T14B-B |
| `GET /api/v1/recipes` | 200; 71 recipes = 59 VN + 12 global; order identical to local `ALL_RECIPES` (first `vn-canh-01`, last `gl-12`) |
| `GET /api/v1/auth/google/config` | 200 |
| `OPTIONS /api/v1/auth/login` (CORS preflight) | 204 |
| `GET /` (SPA) | 200 text/html |
| `wrangler tail frigo` (25 s sample) | 0 events, 0 exceptions |
| Inventory Truth (T09/T11) | untouched — inventory aggregates unchanged; no inventory code in this rollout |
| Recipe authority | `RECIPE_CATALOG_MODE` unset in `wrangler.jsonc` → `static`; no `d1` mode exists (`d1_recipe_authority_mode=DOES_NOT_EXIST`); D1 catalog is shadow-ready only |
| Worker secrets (names) | GROQ_API_KEY, JWT_SECRET, OTP_HASH_SECRET, QWEN_API_KEY, TURNSTILE_SECRET_KEY — unchanged |

## 9. Scope guard

Not touched: recipe architecture, runtime ordering logic, ingredient ordinal logic, ranking/planner/swap,
Inventory Truth, Qwen runtime, PayOS, auth/OCR behaviour, media/CSP, DNS, package dependencies,
`deploy.yml`, migration `0034` content; no `0035` created. T14C/T14D/T14E not started.

## 10. Known follow-ups (not T14B-B blockers)

- `CONFIG_PLUS_GRANT_SECRET_MISSING` readiness warning pre-dates this rollout (operator config).
- Wrangler 3.114.17 is out-of-date (4.x available); upgrade is a separate dependency task.
- `PRAGMA integrity_check` cannot run on hosted D1; `quick_check` + `foreign_key_check` + schema gate used.
