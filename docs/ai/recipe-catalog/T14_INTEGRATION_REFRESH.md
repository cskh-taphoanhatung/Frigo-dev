# T14A / T14B-A integration refresh

## Final integration receipt — both foundations merged, T14B-B not started

```text
repo=vn-clo/Frigo-dev
repository_id=1368281478
starting_main=055913596acd3bef049aa0eb007bde2873a658a9
verified_main_before_docs_receipt=a165474a623a8130c9a9ed4f1df096b3ac3b3ae9
T14A_CANONICAL_MERGE_SHA=fbd14c771070e1b5594532648d79fb60c891747d
T14B_A_CANONICAL_MERGE_SHA=a165474a623a8130c9a9ed4f1df096b3ac3b3ae9
T14A_MERGED=YES
T14B_A_MERGED=YES
T14B_B_STARTED=NO
```

Both integrations used normal protected merge commits, with successful exact-head
hosted `validate`, no unresolved review threads, independent read-only preservation
review and an unchanged expected main immediately before each merge. No canonical
history was rewritten. Source PRs #7/#8 remain preserved historical references;
their approved work entered main through replacement integration PRs #11/#12.

### Exact integration evidence

| Field | T14A | T14B-A |
| --- | --- | --- |
| Source PR | #7 | #8 |
| Historical head | `769e0532fadc95018bc1aedc01a36b396b91a974` | `4a1fa07cbc9c22e393234bcba9212ca2ef887d65` |
| Historical code remediation | docs-only | `582ced73a715e92e0476e9b9e050e86cbb36c6b9` |
| Integration PR | #11 | #12 |
| Branch | `hoplite/poteidaia-c88481ca` | `hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main` |
| Integration head | `e916d292d391ba999bcdd96bfdfec98e6b598678` | `3e3937419b560f1ebf0aa7f5e29a3131508b7d94` |
| Hosted CI run | `35034318031` | `35035112092` |
| Exact-head validate | SUCCESS | SUCCESS |
| Canonical merge | `fbd14c771070e1b5594532648d79fb60c891747d` | `a165474a623a8130c9a9ed4f1df096b3ac3b3ae9` |
| Fresh full local tests | 151 files / 3633 tests | 154 files / 3676 tests |

T14A is docs-only. The T14B-A integration applies exactly 15 accepted functional
paths (including one deletion), byte-identical to source PR #8's final head. The
only architecture-document reconciliation is renumbering recipe ADR-022 to
**ADR-023**, preserving Auth/OCR ADR-022 and the accepted recipe decisions.

### Production lineage and preservation proof

`current_production_application_merge=911db7fdddcd60ea1e3f3c17b4aed3f4b922bda5`

`current_production_worker_version=20bc1f35-6ffe-4085-ba79-d54a0b53da71`

PR #10's recorded 100% custom-domain rollout is retained. This is the last recorded
production release, not a new deployment/probe by this task. `e6b9195` is historical.
Starting main and T14A main differ from PR #9 only by docs. After T14B-A, the whole
application tree is deliberately **not identical** to deployed PR #9: it contains
the accepted non-authoritative recipe safety library/tooling/test delta. Production
runtime authority and all PR #9 protected files are unchanged.

Exact comparisons against starting main preserve **348** existing files under
`src/`, `public/`, `packages/ai/`, `packages/domain/`, plus lockfile, Wrangler
configs and all PR #9 regression tests. Specifically preserved byte-for-byte:
`public/_headers`, `src/web/components/scan/ScanProcessingState.tsx`,
`src/web/pages/{AuthPage,ReceiptReviewPage,ScanPage,ScanResultPage}.tsx`,
`src/worker/index.ts`, `tests/integration/worker-cors.test.mjs`,
`tests/unit/auth-google-credential.test.tsx`, `tests/unit/scan-processing-state.test.tsx`.
No old Auth/OCR/header files were restored.

Inventory SQL-table-reference file set: **16 files**, same paths and SHA-256 values
before/after. The conservative scan covers `inventory_items`, `inventory_events`,
`inventory_lots`, `inventory_commands` across `src` and `packages`; all protected
runtime source also matches. T09 writer and T11 reader authority are unchanged.
`rg 'runtime-recipe|catalog-entry|catalog-drift|recipe-content' src` has zero matches.

### Fresh recipe and migration truth

Fresh **local in-memory replay**, not a production D1 census: all 33 committed
migrations produce 59 complete D1 recipes; the new content projection issues four
SELECTs only. Runtime recipes remain **71 = 59 Vietnamese + 12 global**;
`static_only=gl-01..gl-12`, `d1_only=[]`, `runtime_authority=ALL_RECIPES`.

| Drift dimension | Fresh result |
| --- | --- |
| Core / requirements / units | 0 / 0 / 0 |
| Steps / tags / media | 0 / 0 / 0 |
| Nutrition | `unsupported_by_catalog_model`, 59 shared IDs; no invented parity |
| Incomplete / rejected | `[]` / `[]` |

Media equality is not media health; fixes remain deferred to T14C. No recipe data
or media/CSP changes were made. Migration count **33**, highest **0033**,
`0034_exists=NO`, `hash_drift=NONE`. Every migration's SHA-256 was captured before
any tests and rechecked after both complete suites and renderer execution.

### Exact fresh commands and results

On the final T14B-A integration head `3e3937419b560f1ebf0aa7f5e29a3131508b7d94`:

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 (Node 24.19.0, pnpm 10.26.0) |
| `pnpm recipe:seed:check` | exit 0, 59 recipes match committed 0006 |
| `pnpm recipe:seed:render` | exit 0, output only `.artifacts/recipe-seed/0006_vietnamese_recipe_bank.sql` |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm check:migrations` | exit 0, `migration-smoke=ok` |
| `pnpm build` | exit 0 |
| `pnpm test` | exit 0, **154 files / 3676 tests passed**, including 29 output-policy regressions |
| `git diff --check` | exit 0 |
| `git status --short` | empty after all gates and renderer |

Renderer output compares byte-for-byte to committed 0006. Eleven real forbidden
CLI output paths (migrations, packages, worker/web source, docs, package.json,
wrangler.jsonc, `.artifacts/other`, sibling prefix, `..`, absolute external path)
each refused with exit 3; regression tests also exercise symlink/traversal escapes.
All checks passed without modifying accepted code or weakening tests. SQLite was
installed through the existing canonical setup prerequisite; no dependency or
configuration change was committed. Private local gate logs and preservation
manifests are retained under `.hoplite/artifacts/t14-refresh/`.

### OPS / RELEASE remains separate

Starting-main CI `35030996228`, T14A main CI `35034649347`, and T14B-A main CI
`35035415271`: all SUCCESS. Deploy runs `35031212139` (starting main),
`35034907761` (T14A main), and `35035612637` (T14B-A main) all have
release SUCCESS, staging FAILURE, production SKIPPED. All three staging logs confirm
`DEPLOY_WORKFLOW_BLOCKER=CLOUDFLARE_API_TOKEN_MISSING_IN_STAGING_ENV`.
Later main CI/deploy observations are appended to the receipt PR's post-merge
comment; no automatic attempt is presented as a successful deployment.
No staging secret fix, workflow change, manual deploy or production authorization
was performed. This missing-token OPS issue is **not a T14 regression**.

### Final baseline receipt and next action

Both required foundations are now canonical: **READY_FOR_T14B_B** as an integration
prerequisite only; **T14B-B has not begun** and needs its own task packet. This
docs-only receipt (`docs(t14): record canonical integration completion`) is the
sole remaining finalization change. Its eventual merge
SHA cannot be embedded in its own commit: the receipt PR's post-merge comment
records exact `final_main` and `T14B_B_BASE_MAIN` after a fresh fetch, together with
final main CI and Deploy state. Future T14B-B must use that final canonical tip,
not `345cecf`, the source PR stack, `e6b9195`, or the earlier deployed application
merge. Re-fetch before starting; any later external advancement needs a new audit.

PR #4 remains open, historical, **CLOSE_ARCHIVE** recommended. No branch/history
was deleted. Force push, history rewrite, manual production deploy, production
D1/R2/KV/queue writes, secret/DNS/PayOS changes, recipe authority switch, migration
creation, Inventory Truth/Qwen/media/CSP changes and T14B-B work: **all NO**.

## Historical reconciliation checkpoint — T14A merged, T14B-A validation pending

```text
CURRENT_CANONICAL_MAIN=fbd14c771070e1b5594532648d79fb60c891747d
T14A_INTEGRATION_PR=11
T14A_INTEGRATION_HEAD=e916d292d391ba999bcdd96bfdfec98e6b598678
T14A_CI_RUN=35034318031
T14A_VALIDATE=SUCCESS
T14A_CANONICAL_MERGE_SHA=fbd14c771070e1b5594532648d79fb60c891747d
T14B_A_INTEGRATION_BRANCH=hoplite/poteidaia-c88481ca-integrate-t14b-a-current-main
T14B_A_BASE_MAIN=fbd14c771070e1b5594532648d79fb60c891747d
T14B_A_SOURCE_HEAD=4a1fa07cbc9c22e393234bcba9212ca2ef887d65
T14B_A_HISTORICAL_CODE_SHA=582ced73a715e92e0476e9b9e050e86cbb36c6b9
T14B_A_MERGED=NO (at this pre-validation checkpoint)
T14B_B_STARTED=NO
```

PR #11 merged through the normal protected flow after exact-head hosted success,
fresh full local gates (151 files / 3633 tests), a docs-only diff and independent
read-only preservation review. Main was checked immediately before merge and
advanced only by that authorized integration. Its application tree still equals
PR #9 merge `911db7f`; the recorded production Worker remains
`20bc1f35-6ffe-4085-ba79-d54a0b53da71`.

T14B-A applies exactly the 15 functional paths in the accepted PR #8 delta
(including the deletion of the migration-writing test); no functional redesign.
The RuntimeRecipe contract, classifier/FK-stub exclusion, drift audit, read-only
D1 projection, pure renderer and contained output policy remain as accepted.
The documentation-only ADR collision is resolved by numbering the imported
recipe decision **ADR-023**, preserving PR #9's Auth/OCR ADR-022 verbatim.

Next action: run all fresh gates on this integration head, prove exact accepted
functional blobs and production/inventory/migration preservation, publish against
main, require exact-head hosted `validate`, then normal protected merge. A final
post-merge receipt must record actual test counts, CI and merge SHAs; the old
152/3673 count is historical and must not be substituted for fresh evidence.
No production access/deploy is needed. T14B-B remains blocked until both land.

## Initial remote audit and T14A pre-merge checkpoint (historical below)

## Scope and canonical identity

Reconcile approved T14 knowledge and safety tooling with the newer Auth/OCR
production lineage. No redesign, T14B-B, recipe-data change or deployment.

```text
repo=vn-clo/Frigo-dev
repository_id=1368281478
CURRENT_MAIN=055913596acd3bef049aa0eb007bde2873a658a9
T14A_AUDIT_BASE_MAIN=345cecf388321a00c96be387744a10e8c98bd9ac
PR7_STATE=open,draft
PR7_HEAD=769e0532fadc95018bc1aedc01a36b396b91a974
PR7_BASE=main (historical base SHA 345cecf388321a00c96be387744a10e8c98bd9ac)
PR8_STATE=open,draft
PR8_HEAD=4a1fa07cbc9c22e393234bcba9212ca2ef887d65
PR8_BASE=hoplite/koroneia-838b0ccc
PR4_STATE=open; recommended disposition=CLOSE_ARCHIVE; no action taken
PR9_MERGE_SHA=911db7fdddcd60ea1e3f3c17b4aed3f4b922bda5
PR10_MERGE_SHA=055913596acd3bef049aa0eb007bde2873a658a9
```

Fresh brokered fetches used explicit branches (the authorized equivalent of the
requested all-ref fetch; no wildcard fetch or branch rewrite). Public repository
metadata confirmed the canonical name, numeric ID and default branch. The
pre-existing `.hoplite/settings.json` modification was saved in a named local
stash and a private patch, excluded from all integration commits.

## Production-preservation baseline

`git diff --name-status 911db7f origin/main` contains exactly five docs paths:
`PROJECT_STATUS.md`, `TASK_BOARD.md`, `docs/ai/CURRENT_STATE.md`,
`docs/ai/HANDOFF.md`, `docs/ai/TASK_BOARD.md`. The application-path diff is empty.
PR #9 contains the Auth/GIS popup fix, OCR pending UX and SPA/API COOP distinction;
none of its source, public-header or regression-test changes may be replaced.
Old audit base → current main has no recipe-package, recipe-reader, recipe-route,
planner-source, recipe-media or migration changes.

Current recorded production application merge:
`911db7fdddcd60ea1e3f3c17b4aed3f4b922bda5`.
Current recorded production Worker version:
`20bc1f35-6ffe-4085-ba79-d54a0b53da71` (100% custom-domain rollout, PR #10
receipt). This supersedes `e6b9195`; it is existing release evidence, not a fresh
deployment or production probe by this task.

## Integration sequence

1. T14A: semantic docs-only reconciliation on
   `hoplite/poteidaia-c88481ca`, directly from `0559135`. Preserve the full audit,
   label its old lineage historical, and retain PR #9/#10 production receipts.
2. Require fresh local gates and exact-head hosted `validate` before normal merge.
3. Start a fresh authorized thread branch from that resulting main; apply only
   PR #8's accepted T14B-A delta. Preserve all accepted functional blobs.
4. Require fresh local safety evidence and exact-head hosted validation before
   normal merge. T14B-B remains blocked until both integrations actually land.

The source PRs #7/#8 are historical references, not branches to merge blindly.
Historical CI runs on their old lineage do not certify this integration.

## Verification checkpoint

- `pnpm install --frozen-lockfile`: exit 0, Node 24.19.0 / pnpm 10.26.0.
- Canonical setup's SQLite prerequisite installed locally; no config change.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:migrations`,
  `pnpm build`, `git diff --check`: all exit 0. Full Vitest: **151 files /
  3633 tests passed**; migration smoke: `migration-smoke=ok`.
- `sha256sum -c` on the 33-file baseline: all OK after the full suite.
- `git diff --exit-code origin/main -- src packages migrations public package.json
  pnpm-lock.yaml wrangler.jsonc scripts tests`: exit 0, empty. Working-tree changes
  are exclusively the seven T14A integration documentation paths.
- Exact-head hosted integration CI: pending publication, not replaced by old CI.
- Migration SHA-256 baseline captured for all 33 files before any test execution.
- No merge or production action performed at this checkpoint.

## Separate OPS / RELEASE blocker

Starting-main CI run `35030996228`, head `0559135`: **SUCCESS**.
Deploy run `35031212139`: release **SUCCESS**, staging **FAILURE**, production
**SKIPPED**. Job `104589946815` failed at “Deploy to Cloudflare staging” with
Wrangler's non-interactive `CLOUDFLARE_API_TOKEN` requirement.

`DEPLOY_WORKFLOW_BLOCKER=CLOUDFLARE_API_TOKEN_MISSING_IN_STAGING_ENV`

This is not a T14 application regression. Do not change secrets/workflows or
manually deploy. Configured automatic staging attempts after merges may fail for
the same reason; record them separately. Production requires a separate explicit
release decision and is not authorized by this task.

## Safety and next action

No force-push/history rewrite; no PR #4 merge; no migration 0034; no production
D1/R2/KV/queue, secret, DNS, PayOS, Qwen, Inventory Truth or media/CSP change.
Runtime authority stays `ALL_RECIPES`, 71 recipes (59 Vietnamese + 12 global).
Next action: publish the locally verified T14A docs-only integration, obtain exact-head
hosted CI, then merge through normal protection. **T14B-B NOT STARTED.**
