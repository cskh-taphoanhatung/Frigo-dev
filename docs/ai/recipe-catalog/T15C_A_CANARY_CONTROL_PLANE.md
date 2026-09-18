# T15C-A — bounded recipe D1 canary control plane

Date: 2026-09-18

## Scope and stop condition

T15C-A hardens the Deploy control plane so a reviewed canary wiring PR can be
opened without authorizing production traffic. It does not activate canary,
deploy production, write D1, populate R2/media, start T14G, or change runtime
authority code.

```text
RUNTIME_SUPPORT_EXISTS=YES
PRODUCTION_CANARY_AUTHORIZED=NO
PRODUCTION_CANARY_ACTIVATED=NO
FULL_D1_AUTHORIZED_BY_WORKFLOW=NO
```

The existing runtime still supports `static`, `shadow`, `canary`, and internal
`d1` modes. Runtime capability is intentionally broader than this release
policy. The reviewed Deploy workflow exposes only `static`, `shadow`, and
`canary`; `d1`, `full`, and `full_d1` are rejected by release validation.

## Release policy

`validateRecipeCatalogRollout({ mode, canaryPercent })` is the single pure
release policy validator. It accepts exactly this matrix:

| mode | canary percent | derived cutover |
| --- | ---: | --- |
| `static` | `0` | `false` |
| `shadow` | `0` | `false` |
| `canary` | `1`, `2`, or `5` | `true` |

The validator rejects arbitrary percentages, `100%`, `d1`/`full` modes,
malformed numbers, decimal/scientific strings, and leading-zero forms. The
operator cannot select `RECIPE_CATALOG_CUTOVER_ENABLED`; it is derived from the
validated mode.

Automatic `workflow_run` deployments force `static / 0 / false`. Manual
dispatch may choose `static`, `shadow`, or bounded `canary` with `0`, `1`, `2`,
or `5`; invalid combinations fail closed before any deploy job starts.

## Immutable propagation

The release artifact records:

```text
recipeCatalogMode
recipeCatalogCanaryPercent
recipeCatalogCutoverEnabled
```

Release outputs carry the validated `deploy_sha`, mode, percent, and derived
cutover. Staging and production Wrangler commands consume only those outputs:
`GIT_COMMIT`, `RECIPE_CATALOG_MODE`,
`RECIPE_CATALOG_D1_CANARY_PERCENT`, and
`RECIPE_CATALOG_CUTOVER_ENABLED`. The production `environment: production`
gate and required reviewer mechanism are unchanged.

## Runtime audit (unchanged)

The audited runtime continues to use `auth.householdId` as the tenant key and
FNV-1a32(`recipe-catalog-canary:` + householdId) modulo 10000. Assignment is
deterministic and monotonic, never uses random/request IDs/time, never canaries
an unauthenticated request, and never logs household IDs. A selected D1 cohort
requires verified readiness; read failure/parity drift falls back to static.
The verified D1 cache remains TTL 30 seconds with a five-minute stale grace and
singleflight refresh. These runtime primitives remain available for a future
review; they are not production authorization evidence here.

## T15C-B plan (documented, not executed)

The next separately reviewed operation may manually deploy production with
`mode=canary`, `percent=1`, and derived `cutover=true`, obtain the required
production Environment approval, prove exact-SHA convergence, and certify both
inside/outside cohorts plus unauthenticated static behavior. It must observe
aggregate authority/fallback/stale/not-ready signals without raw household IDs
or recipe dumps. Emergency rollback is configuration-only to `static`.

No live canary checks, production dispatch, widening, rollback, D1 write,
migration, or media action belongs to T15C-A.
