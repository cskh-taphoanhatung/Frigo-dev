# Frigo / Takosan current authority — 2026-09-15

## T14B-A recipe catalog safety foundation — 2026-09-15

Branch `hoplite/koroneia-838b0ccc--t14b-a-catalog-safety` (stacked on T14A PR #7,
application tree = `main` `345cecf`). Implemented per ADR-022 and
`docs/ai/recipe-catalog/T14B_A_CATALOG_SAFETY_FOUNDATION.md`:
`tests/unit/generate-migration.test.ts` (rewrote `vietnamese-bank.ts` and
`migrations/0006` during `pnpm test`) is removed and replaced by a pure in-memory
seed renderer + read-only validation test + explicit `pnpm recipe:seed:check` /
`pnpm recipe:seed:render` (refuses `migrations/`); `RuntimeRecipe` formal contract
(lossless for all 71 static recipes, distinct from foundation `RecipeDefinition`);
`classifyCatalogEntry` (complete / incomplete+fkStub / rejected) so cooking/shopping
FK anchor rows are never catalog entries; `auditCatalogDrift` + read-only
`readRecipeContent` covering identity, core, requirements, units, steps, nutrition,
tags, category/region representation and media. Current truthful drift: static 71,
D1 complete 59, static-only `gl-01..gl-12`, nutrition unrepresented in D1, all
other classes empty. `ALL_RECIPES` remains the only runtime authority; no route,
migration (33 files byte-identical, `0034` absent), CSP, inventory, AI or config
change. PR #4 remains open (recommend close/archive; not acted on).

## T14A production recipe truth audit — 2026-09-15 (docs-only)

Audit report: `docs/ai/recipe-catalog/T14A_PRODUCTION_RECIPE_TRUTH_AUDIT.md`
on branch `audit/t14a-production-recipe-truth` from `origin/main`
`345cecf388321a00c96be387744a10e8c98bd9ac`. Verified
`PRODUCTION_MAIN_APPLICATION_EQUIVALENCE = PASS`: deployed `e6b91956…` differs
from `main` only by seven documentation paths; live readiness reports the same
commit. Migration ledger `0001`–`0033` is contiguous with no duplicates;
`NEXT_AVAILABLE_MIGRATION = 0034` (not created).

Recipe truth: production authority is the static TypeScript `ALL_RECIPES`
(71 recipes: 59 Vietnamese + 12 global) for `/recipes`, `/recipes/:id`,
`/recommendations`, Week v1 generation/regeneration/swap, cooking, shopping and
the offline client. D1 `recipes` holds only the 59-row `0006` seed plus lazily
inserted 7-column stub rows from cooking/shopping; `readRecipeCatalog` is used
solely by the flag-disabled T04 planner. `IS_RECIPE_CATALOG_ABSTRACTION_PRESENT
= YES`, `IS_RECIPE_CATALOG_RUNTIME_AUTHORITY = NO`. All 59 Vietnamese recipe
images are `images.unsplash.com` URLs blocked by production `img-src`
(P1, confirmed by live header); 46/71 recipes share an image; `gl-11`
references a missing local asset. No P0 finding. Recommended T14B strategy:
**A — static authority, D1 shadow catalog**. No application, migration,
config, test or production change was made by T14A.

## Production rollout receipt — 2026-09-15

The previously blocked rolling-schema release was completed with explicit
operator authorization. Production D1 `frigo-db` now reports the complete
`0001`-`0033` ledger; `pnpm schema:check:remote` passed, including inventory
authority, scan evidence retention/completeness and foreign-key checks. The
pre-migration SQL export is `/tmp/frigo-prod-pre0032-20260916.sql` with SHA-256
`378c023b15c159d140162e6eb74bbf2ad584e7b699c72384379119defe6dec6a`.

Compatibility Worker `64ee9ed1d986a5e521598a36656e9c2f59d682ee` was deployed
first, then canonical Worker `e6b91956484589c088e6d04a9835b3e59a2eb786` was
deployed to the production custom domain. Readiness now reports the exact
canonical SHA with `database=ok`, `queue=ok`, `ai=configured`,
`config.ok=true`; the only issue is the pre-existing warning
`CONFIG_PLUS_GRANT_SECRET_MISSING`. Public health, recipes, manifest/Takosan
branding and unauthenticated mutation boundaries returned expected responses.

Remote SQL API ad-hoc `PRAGMA` queries returned Cloudflare `SQLITE_AUTH`; the
repository-owned remote schema gate is the accepted read-only evidence. No
production KV/R2/queue data was mutated, and no PayOS, DNS, secret rotation or
T14 work occurred. PR #4 (`release/pre0032-schema-compat`) remains open with
no hosted checks; it must be reviewed/merged before the compatibility code is
considered part of canonical `main`.

## Canonical repository consolidation

**CANONICAL REPOSITORY CONSOLIDATION COMPLETE.** The canonical repository is
`vn-dlo/Frigo-dev` (ID `1368281478`), and `main` is
`a5cfb14cfd5840be23eb16b26a3689f5e2d6e805`. PR #2 merged reviewed head
`7ede92c73a41da24500746fd0eded892689d8558` using a history-preserving merge
commit; its tree matches the reviewed head exactly. The immutable application
freeze remains `5f6853d0ed11415871dca0fd31d4981d60518310`; `e34ed167` is
historical and superseded.

Exact PR CI run `34972891435` and post-merge main CI run `34973522150` passed.
Branch protection requires strict `validate`, blocks force-push and deletion,
enforces admins, and retains the maintainer-authorized approval count of zero.
The rollback pointer preserves old main `d1b06732` at
`archive/pre-canonical-consolidation`.

## Maintainer review acceptance

`EXTERNAL_TECHNICAL_REVIEW=APPROVED` for final reviewed head
`7ede92c73a41da24500746fd0eded892689d8558`, with P0=0, P1=0 and P2=0. The
maintainer explicitly accepts that review as sufficient for this repository
consolidation and may waive only the GitHub-native collaborator approval
requirement. CI, PR, force-push and branch-deletion protections remain active.

## Production deployment status

**ROLLOUT COMPLETE WITH FOLLOW-UP.** Production is serving canonical
`e6b91956484589c088e6d04a9835b3e59a2eb786` and D1 is at migration `0033`.
The compatibility sequencing concern was handled by deploying `64ee9ed1`
before the bridge migration. The remaining follow-up is review/merge of PR #4;
do not down-migrate or bypass branch protection. PayOS, DNS, secret rotation,
production KV/R2/queue data and T14 remain untouched.

# Historical production integration evidence — 2026-09-15

## Historical merger-plan audit — superseded as current authority

**NOT READY TO MERGE OR DEPLOY.** A fresh two-repository/branch/migration audit
is recorded in `docs/integration/CANONICAL_REPOSITORY_CONSOLIDATION_PLAN.md`;
the separate production rollout risks remain in
`docs/integration/SAFE_PRODUCTION_MERGER_PLAN.md`. Production
`main` already contains adapted frontend upgrade lineage `d270cd4`/`57c88c5`
and platform hardening lineage `3f33d11`; historical tips `fafe1cc`, `2052932`
and `089c406` are not independent cherry-picks. The confirmed migration
collision remains production `0023_scan_request_fingerprint.sql` versus dev
`0023_inventory_truth_foundation.sql`, resolved by immutable production
`0001`-`0023` plus byte-copied T08-T13 `0024`-`0033`.

Qwen task-runtime source `da41686` is 15 commits ahead of and not contained in
production `main`; it remains a required merge source. The fetched history's
additional `0024`-`0032` filename variants are the current integration branch's
`+1` aliases of the same certified dev blobs, not extra migrations.

New release blocker: canonical `0032_scan_evidence_retention.sql` enforces
`review_state`/`is_confirmed` coupling, while the current production Worker
writes only `is_confirmed`. The integrated Worker also assumes the new columns
exist. A schema-capability compatibility release and rolling-upgrade rehearsal
must precede any remote bridge migration. That compatibility release must be
merged/deployed independently, followed by separate Qwen/runtime, T08-T13
bridge, and Takosan brand-only trains; each begins at the prior deployed head.
Current `f26003b` is not production-deployable as-is; canonical repository
promotion still requires the exact lineage, docs-only and hosted-CI gates.
Repository access remains production
`ADMIN` and Frigo-dev `WRITE`. Promotion branch `canonical/5f6853d-promotion`
was published at `f48e830ed9cdde2214ad5b4dbd58b8bc30c06106`, archive pointer
`archive/pre-canonical-consolidation` preserves `d1b06732`, and PR #1 was
closed. PR #2 later completed the canonical merge; no production deploy or
remote database/resource mutation occurred.

Fresh planning-audit checks: repository/API metadata, heads/merge-base/ancestry,
source diff inventories, all-ref migration variants, bridge blob equality,
production/integrated scan SQL inspection, and two real SQLite ordering probes.
Both probes exited `1` with the expected trigger/missing-column failures.
Promotion validation then passed: frozen install, lint, typecheck, migration
smoke, build, `git diff --check`, full Vitest `3630/3630` (149 files), local D1
`92/92` (5 files), and browser `60/60` serial at 360/390/430. Hosted PR checks
have not started/reported yet; branch protection API remains 404.

## Historical remediation state — superseded by the merger-plan audit above

**INDEPENDENT-REVIEW BLOCKERS FIXED AND COMMITTED.** The working branch remains
`integration/t13-takosan-qwen`; remediation candidate is `5f6853d` on base HEAD
`231d1e7`.
The reviewed candidate `e34ed16777166407acf67b2c76d733d89c7d64ca` is
superseded and must not be merged as-is.

Protected payment UI is restored byte-identically to production base
`05423f2`; brand assertions exclude those protected surfaces. The Qwen scan
regression now exercises real router/runtime/provider composition and mocks only
synthetic DashScope HTTP before queue persistence and T13 confirmation.
Missing/0/.11/.9 confidence remains exact evidence; low confidence is retained
for review, while generic labels are rejected. Runtime escalation preserves a
concrete prior error when the next role is disabled. Certified T13 DEC-012 auth
deferral is intentionally retained and documented as an auth difference from
production.

Exact fresh checks: focused `41/41`; broader affected matrix initially `300/302`
because two brand assertions included payment, then brand `16/16`; full Vitest
`3630/3630` in 149 files; `pnpm lint`, `pnpm typecheck`,
`pnpm check:migrations`, `pnpm build`, `git diff --check` PASS; browser `60/60`
at 360/390/430 PASS. No remote or production mutation occurred. Next action:
final review of immutable SHA `5f6853d`.
Two intermediate typecheck attempts exposed an over-generic then invalid
`fetch` spy annotation; `MockInstance<typeof globalThis.fetch>` fixed it and the
final typecheck plus focused `57/57` rerun passed.

Access preflight: `Tungjpstore` has production `ADMIN` and Frigo-dev `WRITE`;
repository IDs/default heads remain verified, with no branch protection or
rulesets reported. Local `origin` points to `Tungjpstore/yaji`, so it is not a
safe implicit publication target for this integration branch.

**HISTORICAL PRE-REVIEW CERTIFICATION — SUPERSEDED BY REMEDIATION ABOVE.** Branch `integration/t13-takosan-qwen` starts at verified
production `PRODUCTION_BASE=05423f2ad675006a4c7913e696f1979b3fcaae59` in
`Tungjpstore/Frigo` (ID `1360256196`). Normal common ancestor with certified
development is `d1b06732f8a80db4e77986df31ff28d9f04641fa`.
`INTEGRATION_APPLICATION_CANDIDATE=e34ed16777166407acf67b2c76d733d89c7d64ca`.

The candidate combines governed Qwen source `da41686b`, certified T13 freeze
`32ddbb4` / review `9c3c3d3`, and hardened Takosan source `ff63edf`. Production
`0023_scan_request_fingerprint.sql` is byte-identical; ten certified T13
migrations are byte-copied at `0024`-`0033`. Pre-existing production migration
changes `0`; bridge mismatches `0`; 33 unique contiguous migrations. The real
queue path preserves missing/0/.11/.9 evidence, provenance and fingerprint into
T13 confirmation; replay creates no duplicate T09 effects. T09/T11 remain the
mutation/read authorities; unknown writers/readers `0/0`.

Historical candidate gates: frozen install, lint, typecheck, migration smoke, build, diff check
PASS; full Vitest `3628/3628` in 149 files; real local workerd/D1 `92/92` in five
files; browser last and serial `60/60` at 360/390/430. P3-1 and P3-2 remain
unchanged. **NO HOSTED GITHUB CI STATUS FOR INTEGRATION_APPLICATION_CANDIDATE**.
No deploy, main merge, remote D1/R2/KV/queue mutation, PayOS backend change,
secret/DNS change, or T14. Full packet: `docs/integration/`.

# Takosan brand branch (independent descendant) — 2026-09-14

## Brand branch state — NOT part of the T13 certification

Out-of-band user-facing rebrand Frigo → Takosan on `hoplite/megara-hyblaia-6b723eb2`,
created from exactly `TAKOSAN_BRAND_BASE=897102b6816c22af2e6a49f29662690e3e3206e0`
(T13R published continuation). **TAKOSAN_BRAND_APPLICATION_CHECKPOINT=
`e37ee2808a50a7195dc90a2e7bb01be639aa186b`** (published via broker). The T13
freeze `32ddbb4…`, docs head `42e0037…`, continuation `897102b…` and main
`d1b06732…` are unchanged; Review #2 still targets exact `32ddbb4`.

Scope: brand assets (`public/takosan/`), `TAKOSAN_BRAND` contract, Takosan tokens
with `--frigo-*` aliases, Nunito, index.html / manifest / sw (`takosan-pwa-v2`),
Landing, Onboarding, Auth, chrome, empty/success states, visible copy. No diff in
`src/worker/`, `packages/db/`, `migrations/`, deps, or technical identifiers.
Checks at `e37ee28`: diff-check, typecheck, scoped lint, build PASS; Vitest
**3480/139**; browser **60/60**; brand QA 360/390/430 0 broken assets, 0 overflow.
Details: [docs/brand/TAKOSAN_MIGRATION.md](../brand/TAKOSAN_MIGRATION.md).

# Frigo current state — T13R certified, ready for independent review #2

## Current authoritative state — T13R certified freeze, 2026-09-14

**T13 REMEDIATION CERTIFIED — READY FOR INDEPENDENT FINAL REVIEW #2.** Repository
`vn-blo/Frigo-dev` (provider owner renamed from `vn-co3`), ID **1368281478**.
Branch `hoplite/delos-f0bb1d04` (this thread's broker-authorized branch; it
descends from `origin/hoplite/medma-164548ce` = `83248df…`, the T13R-B safe-stop
docs head). **T13R_APPLICATION_FREEZE=`32ddbb4f2bb636fdcf201e9ca99c4689d3655477`**,
published and fetch-verified. Protected main `d1b06732…` unchanged. Rejected
freeze `7b7bb69…` remains **DO NOT RELEASE**.

The freeze differs from the T13R-B candidate `7e68e3b` only by two certification
test/fixture commits (`bd2f5f3` fixture collision fix, `32ddbb4` new P2-B browser
reopen spec); `git diff 7e68e3b 32ddbb4 -- src packages migrations wrangler.jsonc
package.json pnpm-lock.yaml playwright.config.ts` is EMPTY. All T13R-A (P1-1..P1-4,
P2-A, P2-B) and T13R-B (P2-1, P2-4, P2-5, P2-6) fixes plus the IngredientRow
`/fridge` crash fix are re-verified at the freeze; original blockers P0/P1/blocking
P2 = **0/0/0**; original AC1–AC14 **all PASS**; roadmap R3/R4/R5/R6/R7/R8/R11 and
U1/U4/U6/U7/U8/U12/U13/U14 **DONE**.

Exact gates, pre-freeze and clean detached at `32ddbb4`: lint/typecheck/build PASS;
full Vitest **3471/138** (both); focused T13R-A **45/5**, T13R-B **171/7**, T08
130/2, T09 1259/17, T10 98/6, T11 39/2, T12 22/3, T13 320/12; real local D1
**92/5**; browser **60/60** (20 cases × 360/390/430, serial, last) both pre-freeze
and detached; `pnpm check:migrations` ok; fresh 32-migration real local D1 apply +
schema gate + FK 0; legacy populated 0030→0031→0032 replay on real local D1 (0
fabricated rows, pre-existing columns identical, schema gate PASS); **32**
migrations, 0031 `c580d30b…` and 0032 `48f26f7c…` unchanged, 0033 absent; writer/
reader UNKNOWN **0/0** (src/packages statement sets identical to `fc0f9c5` and
`7b7bb69`); `git diff --check` PASS; detached `git status --porcelain` EMPTY.
Retained failure: first full browser run on the `7e68e3b` tree was 3 failed/51
passed (fixture collision, fixed by `bd2f5f3`). **NO HOSTED GITHUB CI STATUS FOR
T13R_APPLICATION_FREEZE.** Record: [T13R_FINAL_CERTIFICATION.md](inventory-truth/t13/T13R_FINAL_CERTIFICATION.md).

**T13R_DOCS_HEAD=`42e0037f92104fd5dc3c89c633d91f67fa892724`** is remote on
`hoplite/delos-f0bb1d04` (local == remote verified; freeze→docs application-path
diff EMPTY). `hoplite/medma-164548ce` remains at `83248df…` (broker base-branch
restriction; pure fast-forward ancestor). Only next step: **INDEPENDENT T13 FINAL
REVIEW #2**. No merge/deploy/remote D1/PayOS/T14/repository reconciliation.
`.hoplite/settings.json` overlay uncommitted.

## Historical — T13R-A application checkpoint, 2026-09-13 (superseded)

**T13R-A COMPLETE — READY FOR T13R-B. NOT a final T13 freeze.** Repository
`vn-co3/Frigo-dev` (renamed from `vn-co2`), ID **1368281478**. Branch
`hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership`;
**T13R_A_APPLICATION_CHECKPOINT=`fc0f9c56c53ae7b17f2d1fb4770a6bc231ebc027`**.
Protected main `d1b06732…` unchanged. Rejected freeze `7b7bb69…` remains
**DO NOT RELEASE** and is the comparison baseline.

All six T13R-A findings are **FIXED** with permanent red→green regressions:
P1-1 async raw evidence (`scan-queue.ts`), P2-A complete raw mapping evidence and
P2-B reviewed-expiry round-trip (additive migration **0032**, sync+async writers,
DTO, both review pages), P1-2 canonical identity preserved under free-form rename
(`inventory.ts` PATCH), P1-3 lot-bound edit drafts (`IngredientDetailPage` keyed by
route + owner check), P1-4 receipt review requires `next.id === receiptScanId`
(`ReceiptReviewPage`). Migrations: **32**; 0001–0031 byte-identical; 0032 additive,
no backfill. Authority audit: inventory writer and T11 reader sets identical to the
freeze; UNKNOWN writers 0, UNKNOWN readers 0; no evidence column is stock authority.

Gates at checkpoint: lint/typecheck/build PASS; **3423/137** full Vitest;
**45/5** focused T13R-A; **92/5** real local D1 (workerd); **42/42** browser
(14 cases × 360/390/430); migration smoke with populated 0031→0032 upgrade; fresh
32-migration local D1 apply; legacy 0031→0032 populated upgrade on real local D1
(0 fabricated rows, FK 0); schema gate PASS. Details, commands and per-finding
tests: [T13R_A_REMEDIATION.md](inventory-truth/t13/T13R_A_REMEDIATION.md).

T13R-B blockers remain OPEN (Cloudflare fridge confidence fabrication, inventory
conflict/refetch UX, Home estimated-expiry qualifier, NULL opened-state truth).
No merge/deploy/remote D1/PayOS/T14/repository reconciliation. `.hoplite/settings.json`
overlay remains uncommitted by rule.

## Historical — T13R-A safe stop, 2026-09-13T15:50:34Z (superseded)

**T13R-A SAFELY CHECKPOINTED BEFORE IMPLEMENTATION.** Repository
`vn-co2/Frigo-dev`, ID **1368281478**. Independent audit `b9735b4` (docs-only,
FAIL verdict) is now remote on `hoplite/oropos-eb2d4886` with verified local/remote
equality; protected main and all rejected-freeze lineage are unchanged. Remediation
branch `hoplite/oropos-eb2d4886--t13r-a-data-integrity-ownership` starts at the
audit commit with an **empty non-doc delta** against the rejected freeze.

No remediation code exists yet: all six target findings (P1-1..P1-4, P2-A, P2-B)
are **NOT STARTED**; `NO_NEW_T13R_A_CODE_COMMIT=true`. Migrations remain 31 with
0031 untouched and no 0032. Cheap checks executed: `git diff --check` PASS; no
TypeScript/source file changed, so typecheck and scoped lint were correctly not
run. The pre-existing `.hoplite/settings.json` overlay stays uncommitted by rule.
Per-finding state, exact commands and resume point:
[T13R_A_REMEDIATION.md](inventory-truth/t13/T13R_A_REMEDIATION.md). Do not claim
T13 complete; next task is T13R-A implementation, then T13R-B blockers.

## Current authoritative state — independent T13 final review, 2026-09-13

**T13 INDEPENDENT FINAL REVIEW — FAIL.** The exact application freeze
`7b7bb695ee597a46cf4022a2c534e2fea374be5d` is not accepted for leaving T13.
Repository ID **1368281478** is verified; the provider now calls the same repo
`vn-co2/Frigo-dev`. Protected main and certified docs head remain unchanged.
Freeze → `4fcbc96b5a5d4b3cea2c2ad0bdb5682b1866891a` has an empty non-doc diff.

Fresh exact-freeze checks PASS: lint/typecheck/build, **3372/132** full,
**194/10** focused, **92/5** real local D1, **36/36** browser at 360/390/430,
migration smoke, all **31** fresh local migrations, legacy upgrade/replay,
local schema and diff checks. Detached status remains empty. Hosted checks and
legacy status contexts for the exact freeze are both absent.

Those gates miss confirmed blockers: **P0 0, P1 4, blocking P2 6**. Async queue
processing omits raw evidence and mishandles absent confidence; U7 can clear
canonical identity and submit a draft to another lot; receipt review accepts a
mismatched scan ID. Additional defects affect confidence, retained review fields,
confirmed expiry, conflict recovery, estimated-date labels and opening-state truth.
Independent local/browser counterexamples are retained; no application fix ran.

See [the independent report](release/T13_INDEPENDENT_FINAL_REVIEW.md) for exact
findings, original AC1–AC14, roadmap closure, commands, failed/inconclusive probes,
and evidence. Earlier COMPLETE/all-PASS statements below are historical and
superseded, not current approval. Next: a new T13 remediation branch for confirmed
blockers, then a new freeze and independent review. No merge/deploy/remote D1/
PayOS/T14/repository reconciliation. This review changed documentation only.

## Current authoritative state — T13 detached certification, 2026-09-13

**T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW.** Repository
`vn-ca1/Frigo-dev`, ID **1368281478**. Protected main remains
`d1b06732f8a80db4e77986df31ff28d9f04641fa`.
Continuation: `hoplite/mende-26679a14--browser-harness-final-cert`, started at
`3262eaff86333da142ada1135e5a20c58ea640eb` with application WIP fd32aa8.
Browser-proven U7 metadata correction was committed separately as
`47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2`.
**T13B_APPLICATION_FREEZE=7b7bb695ee597a46cf4022a2c534e2fea374be5d** was
published, fetched and matched; subsequent changes are documentation only.

The repository-owned Playwright harness removes the Managed Preview dependency:
`pnpm test:browser` owns `node scripts/security-preview.mjs`, with synthetic
in-memory SQLite, blocked external application traffic and no remote bindings.
Pre-freeze and clean-detached browser **36/36** at 360/390/430; full baseline and
detached full suite both **3372/132 files**. Detached focused: T08 **130/2**,
T09 **1259/17**, T10 **98/6**, T11 **39/2**, T12 **22/3**, T13/T13B **271/12**;
current hardening/privacy/operator gate **194/10** (26 hardening, 26 actual CLI).
Fresh real local workerd/D1 **92/5**. Lint/typecheck/build/migration smoke/fresh
local D1 replay/legacy replay/schema/diff PASS; detached status **EMPTY**.
Writer/reader UNKNOWN **0/0**, **31 migrations**, 0031 unchanged/no 0032.
Original AC1–AC14 PASS; R3/R4/R5/R6/R7/R8/R11 and
U1/U4/U6/U7/U8/U12/U13/U14 DONE. P0/P1/blocking P2/unresolved scoped P3: 0.

Failure retained: concurrent detached browser initially passed 35/36 because the
full suite's existing source-writing generator triggered Vite reload during H.
The entire unchanged browser suite then passed 36/36 serially. Run source-writing
checks before browser certification, never alongside it in the same worktree.
HTML report credential leakage was fixed before freeze by removing that reporter
and adding actual lifecycle sanitization coverage. No freeze file changed afterward.
**NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE**; local gates are not hosted CI.

Exact commands, evidence, resolved failures and next action:
[T13B_FINAL_HARDENING.md](inventory-truth/t13/T13B_FINAL_HARDENING.md).
No main merge/deploy/remote D1/PayOS/T14/repository reconciliation.
All earlier current-state sections below are historical checkpoints, superseded here.

## Current authoritative state — fresh-session Preview safe-stop, 2026-09-13

**T13 NOT COMPLETE — BROWSER VERIFICATION BLOCKED.** Fresh-session public metadata
confirmed `vn-ca1/Frigo-dev`, ID **1368281478**. Trusted refs remain guarded main
`d1b06732f8a80db4e77986df31ff28d9f04641fa` and continuation
`hoplite/kos-9d39545d--t13b-b-final-certification` at
`a9b5904aeba0fc7e4d649165770a4e86701312a2`; fresh branch `hoplite/mende-26679a14` started at the
same SHA with an empty status/diff. The required ancestry
`2334a6f -> c37a9b8 -> f845d04 -> fd32aa8 -> a9b5904` and the empty non-doc delta
from `fd32aa8` to `a9b5904` were reverified.

The effective isolated run is `node scripts/security-preview.mjs`; no settings,
scripts, application code, tests, or final T13 documents changed. Three schema-valid
managed-Preview attempts (`preview`, 120 seconds, promotion `preview:3000`) failed
before harness startup with: `Preview port must be a currently discovered HTTP
listener owned by the managed preview run`. Port 3000 is the harness default, but
no managed harness listener existed; `sandbox_ports` showed only browser processes.
No ad-hoc server or unsupported workaround was used.

Flows A–I and widths 360/390/430 are **NOT RUN**; real viewport-emulation capability
was not tested. No current focused/full/type/lint/build/D1/migration-replay/schema/authority
audit ran. Historical 176/9 and 26 hardening/adoption results remain historical only;
`CURRENT_FULL_TEST_COUNT` and `CURRENT_FULL_FILE_COUNT` are not established. No defect,
freeze, final docs head, merge, deploy, remote D1, PayOS, or T14 work is claimed.
Migration integrity passed: 31 tracked migrations, unchanged 0031, no 0032; replay is
not certified. `git diff --check` passed. The platform fault was reported and recorded.
Next: repair the supported managed Preview interface, then resume the mandatory WIP
browser flows before baseline, acceptance closure, freeze, and independent review.

## Current authoritative state — confirmed-review UX WIP, 2026-09-13 12:40 UTC

**T13 NOT COMPLETE — BROWSER VERIFICATION BLOCKED.** New continuation branch
`hoplite/kos-9d39545d--t13b-b-final-certification` starts exactly at f845d04; prior
WIP branch and guarded main are unchanged. Repository ID 1368281478 and canonical
`vn-ca1/Frigo-dev`/historical redirect were freshly verified.
Published application WIP: `fd32aa8deaee7df454245591015780c59f909352` (not freeze).
Confirmed scans now show completed/read-only wording, hide manual addition and
replace the confirm CTA with `Xem tủ lạnh`; terminal remount/privacy guards remain.
PASS: **176 tests/9 files**, including **26 hardening** and **26 actual operator**
tests; typecheck, scoped lint, diff check. All 31 migrations unchanged/no 0032.
One fresh managed Preview attempt reproduced the mandatory-promotion platform
error; no existing isolated server was available. Reported again; stopped before
freeze per owner instruction. No browser/full-suite baseline/final certification
was fabricated. Required next baseline is the actual current runtime count, **not**
historical 3177/124. See the latest `inventory-truth/t13/T13B_B_WIP_HANDOFF.md`
section for exact checks and resume gates. No settings commit/merge/deploy/remote D1/PayOS.

## Current authoritative state — T13B-B hardening WIP, 2026-09-13

**T13 NOT COMPLETE — browser/final certification blocked.** Current repository is
`vn-ca1/Frigo-dev`, ID **1368281478**; historical `Tungjpstore/Frigo-dev` redirects to
that same ID. All guarded SHAs/ancestry passed; continuation starts exactly at
`2334a6f41cf68d42ae1eba7a30440b8fe324eb31`, never main.
Branch: `hoplite/kos-9d39545d--t13b-b-final-hardening`.
Published application-bearing **WIP**, not freeze:
`c37a9b8d7afc66507052bbc8f1e8a24fdc896e8d` (fetched remote equality verified).
Route/store ownership, private-session async fencing, fridge domain-error recovery,
and confirmed-review status retention are fixed with **23 new regressions**.
Final focused **173/173 (9 files)**; T13B-A backend **1122/1122 (17 files)**;
typecheck, scoped lint, operator syntax and diff check PASS. Migration count 31,
0031 unchanged/no 0032; current-source writer/reader UNKNOWN 0/0.
Managed Preview is blocked by its mandatory promotion schema; no browser/final
detached/full-suite/D1/schema/build certification or application freeze is claimed.
Full evidence, corrected intermediate check failures, transfer/docs-lineage proof
and exact next action: [T13B_B_WIP_HANDOFF.md](inventory-truth/t13/T13B_B_WIP_HANDOFF.md).
Main remains `d1b06732f8a80db4e77986df31ff28d9f04641fa`; no merge/deploy/remote D1/PayOS.

## Current authoritative state — T13B-B quota-safe WIP, 2026-09-13

Implementation stopped on the owner's instruction. The focused Part B preflight
completed **109/109 tests in 6 files**; full/frozen verification and final acceptance
are not complete. Initial 404/fetch failures were followed by successful broker
publication/fetch equality for WIP `a8cefd13505bc6b45dd11f45a6323539deb60f93`;
main was reverified unchanged. Fresh public numeric metadata still returns 404.
Actual branch base is `c31567ec7dfa8f95808c20c834b327cbb3425f9c`, not the
safe-stop expected documentation base `69b0dc676fcb4136861a8ca0c66994259eba5116`.
Read [T13B_B_WIP_HANDOFF.md](inventory-truth/t13/T13B_B_WIP_HANDOFF.md) for changed
files, executed checks, pending review, migration status and exact resumption steps.
No further implementation, main merge, deployment or remote D1 work is authorized.

## Current authoritative state — T13B-A backend checkpoint, 2026-09-13

**T13B-A COMPLETE — READY FOR T13B-B.** This is backend-only continuation,
not final T13 certification. The older T13 completion claim below is historical.
Repository ID **1364064929**, current owner/name **vn-2l/frigo-dev**; branch
`hoplite/megara-hyblaia-888f1514`, exact base `3458c6cb971f5d96fce8eda3abc3d708437ce713`.
Main remains `d1b06732f8a80db4e77986df31ff28d9f04641fa`; no merge/rebase/deploy.

**T13B_A_CHECKPOINT=c31567ec7dfa8f95808c20c834b327cbb3425f9c** was committed,
published without force, fetched and verified equal to the remote branch.
Documentation follows separately; this is not a final application freeze.

Adopted receipts create one new T09 RECEIPT lot per accepted line, preserving old
manual/receipt lots and separate purchase facts, storage and expiry. Fridge SCAN
retains grouped CORRECT addition. Raw/confirmed correction evidence is validated
command intent in the existing receipt fingerprint and event metadata fingerprint;
`correctionOf()` is used in production. T10 rawName uses retained OCR, not the
reviewed name; absent raw stays null with a real subject identity. Concurrent and
post-commit response-loss attempts recover through scoped confirmed-status replay,
without repeating stock writes. Review/observation/command/status atomicity remains.

Executed: focused backend **1,122/1,122 (17 files)**; real local D1 **92/92
(5 files; 11 new)**; `pnpm typecheck`; scoped ESLint on all six changed code/test
files; `git diff --check`, scope/ancestry/migration checks — PASS. Four new regressions
fail on the exact pre-fix base as expected. Full commands, initial failures and fixes:
`inventory-truth/t13/T13B_A_HANDOFF.md`. In particular, the initial D1 race failure
(91/92) was fixed rather than weakening its both-success/exactly-once assertions.

Migration count **31**; 0001–0031 unchanged, no 0032. Focused writer UNKNOWN **0**,
canonical reader UNKNOWN **0**; T09/T11 authority unchanged. No frontend, protected
payment/auth, Week, setup or infrastructure change.

**NOT RUN — DEFERRED TO T13B-B FINAL VERIFICATION:** full application suite,
full lint/build, dedicated migration smoke/schema/upgrade gates, browser/mobile
checks, receipt/scan UX and adoption path, final T13 matrix/certification.
Next: continue from the published documentation HEAD with this exact application
checkpoint, following `T13B_A_HANDOFF.md` and DEC-016; do not start from main.

## Current authoritative state — T13 Receipt/Vision Truth & Inventory UX V2, 2026-09-13

**Verdict: T13 IMPLEMENTED AND VERIFIED on branch `hoplite/lindos-0368e413`; NOT merged to
main.** Repository ID 1364064929 (`vn-2i/frigo-dev`); `origin/main` still `d1b0673` (NOT
advanced). Base commit `578f705` (ROADMAP_AUDIT_HEAD). `T13_APPLICATION_FREEZE` =
`ad342703fb31a2b97d2798f1161fb83d4d0ed090`.

Scope closed: receipt/vision provenance truth (RECEIPT vs SCAN from server-side `scan_type`
only), purchase facts (real merchant/date/price or absent), truthful expiry kind
(KNOWN/ESTIMATED/UNKNOWN in distinct columns), raw-vs-confirmed OCR evidence retention,
T10 observation integration inside the existing atomic batch, additive read/decision routes,
and the Inventory UX V2 surfaces (lot detail + provenance, edit/MOVE, receipt review with
real confidence/price/date and per-line rejection, reconciliation page).

Migration `0031_scan_evidence_retention.sql` is additive only (adds `ocr_raw_name`,
`ocr_quantity`, `ocr_unit`, `ocr_confidence`, `review_state` to `scan_items` with
insert/update triggers coupling `review_state` and `is_confirmed`). Migrations 0001-0030
untouched. Fresh 0001→0031 replay and legacy-upgrade replay both PASS.

Authority unchanged: **exactly one inventory writer (T09)**. T13 adds exactly one new write
statement — a guarded INSERT into `inventory_observations` that rides the existing atomic
batch and writes evidence, not stock. Zero new writes to `inventory_lots`, `inventory_items`
or `inventory_events`; zero new `inventory_items` readers. Writer/reader audits UNKNOWN = 0.

Executed checks (clean detached worktree @ `ad34270`, `pnpm install --frozen-lockfile`):
full suite **3,177/3,177 across 124 files**; real D1 **81/81**; lint, typecheck, build,
`check:migrations` (`migration-smoke=ok`), `schema:check:local`, `git diff --check` all PASS;
`git status --porcelain` empty. Baseline before T13 was 3,092/120 and 70 real-D1.

Browser verification against the isolated preview (`scripts/security-preview.mjs`, in-memory
SQLite, `AI_MOCK_MODE`, external fetch disabled) found **7 defects that a fully green test
suite had not caught**, including a lot-id collision that made every line of one receipt
share a single lot id, and two identifier-bound errors that made every real receipt
observation permanently undecidable. All seven are fixed with permanent regression tests.

Main NOT merged; nothing deployed; remote D1 NOT touched; PayOS untouched;
`MEAL_PLANNER_ENABLED` and cutover flags unchanged.

## Current authoritative state — Roadmap reconciliation / gap audit of RC 64c5501, 2026-09-12

**Verdict: T13 REQUIRED** (receipt: `docs/ai/release/INVENTORY_TRUTH_ROADMAP_RECONCILIATION.md`;
scope definition only: `docs/ai/release/T13_PROPOSED_SCOPE.md`). Repository ID 1364064929
(now `vn-2g/frigo-dev`); `origin/main` still `d1b0673` (NOT advanced). Audit branch
`hoplite/delphoi-499ad774` (requested logical name `hoplite/inventory-truth-roadmap-reconciliation`)
created at exact re-certification docs HEAD `1cae11e`; application tree = certified RC
`64c5501` (docs-only delta verified). Roadmap mismatch **CONFIRMED**: pre-implementation
sources `MASTER_CONTEXT.md@43718c2` and `tasks/T08-…@b5577ea` define T11 = "receipt/vision
truth and inventory UX V2"; implemented T11 = read authority (assigned to T12 by the T09
packet); T11 continuation handed the scope to T12; T12 never addressed it; no DEC/ADR
supersedes it. Matrix: Receipt/Vision R1–R12 = DONE 5 / PARTIAL 2 / MISSING 5; UX V2
U1–U17 = DONE 4 / PARTIAL 9 / MISSING 4; SUPERSEDED/OUT_OF_SCOPE 0. Release safety of
`64c5501` unchanged: P0/P1/P2 = 0; P3 notes — inferred shelf-life/day-chip expiry written
as `expiryKind:'KNOWN'` (DEC-003 conflict), Cloudflare provider fabricates defaults,
`FINAL_WRITER_MAP` scan row overstates changed-payload conflict, pre-existing outbox
head-of-line block on permanent 409. Actual receipt pipeline = pre-T08 legacy scan
draft → user confirm → T09 adapter with `sourceType:'SCAN'` (no `RECEIPT` lots, no
observation integration, price/date dropped, no reconciliation/lot/provenance UX,
`POST /inventory/adopt` has no product caller). Executed checks (clean worktree @ `64c5501`):
targeted vitest 55/55 (5 files) + a temporary uncommitted probe (4/4, deleted). Main NOT
merged; nothing deployed; remote D1 NOT touched; PayOS untouched; no application change.

## Current authoritative state — Independent final re-certification of RC 64c5501, 2026-09-12

**Verdict: RELEASE CANDIDATE `64c5501ab0110658718b3752bd84e537f0854e12` TECHNICALLY
CERTIFIED** (docs HEAD reviewed `bc1532e`; receipt
`docs/ai/release/INVENTORY_TRUTH_RECERTIFICATION.md`). Repository ID 1364064929
(`vn-2f/frigo-dev`); `origin/main` still `d1b0673` (RC 57 ahead / 0 behind). Lineage
16/16 ancestors, no rewrite; remediation delta exactly the six D3/D1 files; D3 code,
tests (A–L incl. route boundary), negative control (3/6 fail on pre-fix AuthPage) and
browser reproduction re-verified; D1 blob `3818a00` byte-identical to main; D2
SAFE_DEFERRED with `MEAL_PLANNER_AUTHORITY_CUTOVER`; fresh reader/writer audits
UNKNOWN = 0 (sets identical to `d156001`); no second ledger; task survival by tree
comparison PASS. Clean detached checkout @ `64c5501`: install frozen (lockfile unchanged);
full **3,092/3,092 across 120 files**; D3 32/32; real D1 70/70; T09 654 · T10 98 ·
T11 39 · T12 22; lint/typecheck/build/migrations(30)/schema gate/diff-check PASS;
status empty; fresh real-D1 0001→0030 replay and legacy-upgrade replay PASS. P0/P1/P2:
none (two P3/informational notes). **Main NOT merged** — next is the separate ROADMAP
RECONCILIATION / GAP AUDIT; nothing deployed; remote D1 NOT touched; PayOS untouched.

## Current authoritative state — Final RC targeted remediation (D3/D1/D2), 2026-09-12

**NEW_APPLICATION_FREEZE `64c5501ab0110658718b3752bd84e537f0854e12`** on
`hoplite/akraiphia-akraiphnion-a03445c7--inventory-truth-final-remediation` (published; requested name `hoplite/inventory-truth-final-remediation`; base `32b6ec1` → `5cb4caa` → `d156001`;
main `d1b0673` unchanged, 57 ahead / 0 behind). D3 P1 closed: client-only fix —
`ApiError.code`, `isInventoryTransferDeferred`, AuthPage deferral notice + explicit
“Tiếp tục không chuyển dữ liệu khách” that retries the same OTP without
`migrateFromHouseholdId`; guest session/outbox untouched until success; DEC-012
server unchanged (DEC-015 addendum). D1 P2 closed: `.hoplite/settings.json`
restored from main (blob `3818a00`, raw `48507643…`; overlay never committed).
D2 P2 documented: planner snapshot reader = `SAFE_DEFERRED` in the T11/T12 maps
with `MEAL_PLANNER_AUTHORITY_CUTOVER` as the removal condition; flag stays off.
Clean detached checkout of `64c5501`: install frozen (lockfile unchanged); full
**3,092/3,092 across 120 files**; D3 32/32; real D1 70/70; T09 654 · T10 98 ·
T11 39 · T12 22; lint/typecheck/build/migration smoke (30)/schema gate/diff-check
PASS; status empty. Browser reproduction of the guest→register flow PASS (no
dead-end, no raw JSON, session switches only after the retry). Receipt:
`docs/ai/release/INVENTORY_TRUTH_REMEDIATION.md`. Main NOT merged; nothing
deployed; remote D1 NOT touched; PayOS untouched.

## Current authoritative state — Final Release Integration Review (T08→T12), 2026-09-12

**Verdict: RELEASE CANDIDATE NOT READY** (docs: `docs/ai/release/INVENTORY_TRUTH_RELEASE_CERTIFICATION.md`,
`INVENTORY_TRUTH_ANCESTRY.md`, `INVENTORY_TRUTH_CHANGE_MANIFEST.md`). Reviewed from
exact docs HEAD `5cb4caa0d5b3c86b00954d77cd40b16027c21df1`; application RC
`d15600186c3e73faba011eb690ac6cd70e8d3d2d`; repository ID 1364064929
(`vn-2f/frigo-dev`; `vb-2f` now redirects). `origin/main` is still `d1b0673`
(RC 54 ahead / 0 behind). Lineage 11/11 ancestors; no later task overwrote an
earlier task; UNKNOWN production readers/writers = 0 after classification; no
second stock ledger. Clean detached checkout of `d156001`: `pnpm install
--frozen-lockfile` (Node v24.19.0, pnpm 10.26.0, lockfile unchanged); full
**3,085/3,085 across 119 files (199.68 s)**; T09 654/654 (1,432 across all 22
T09-lineage suites); T10 98/98; T11 39/39; T12 22/22; real local D1 **70/70**;
lint/typecheck/build PASS; `migration-smoke=ok`; `pnpm schema:check:local` PASS;
`git diff --check` clean; `git status --porcelain` empty. Fresh 0001→0030 replay
on sqlite3 and on real workerd/D1 (30 applied; 200 schema objects identical);
legacy-upgrade simulation (0001–0022 + legacy rows → 0023–0030) on real D1: no
data loss, no automatic cutover, non-adopted writes still legal, FK clean.
Defects: **D3 P1** — web guests cannot finish email registration on the RC
(`AuthPage` always sends `migrateFromHouseholdId` for `hh_guest_*` sessions →
`409 INVENTORY_TRANSFER_DEFERRED` with no retry-without-transfer UI; reproduced by
curl and in the browser on the isolated preview); **D1 P2** — tracked
`.hoplite/settings.json` deleted from the RC tree by `4553b8a`; **D2 P2** —
flag-gated `/meal-planning` reader of `inventory_items` missing from the authority
maps (classified SAFE_DEFERRED). No P0. Main NOT merged; nothing deployed; remote
D1 NOT touched; PayOS untouched; no application code changed by this review.

## Current authoritative state — T12 closed-loop runtime verification, 2026-09-12

**New T12 application freeze: `d15600186c3e73faba011eb690ac6cd70e8d3d2d`** — `fix(t12): complete
closed-loop runtime verification` — published/fetched (direct publication, no
PR tooling), local == remote == clean-checkout SHA; `22f675d` superseded.
Closed the independent-review gaps: P1 real workerd/D1 closed-loop suite (8
cases; real D1 62 → 70), P2 route-level proof through the real Hono handlers
(`POST /week/plans/:id/shopping/complete`, `POST /recipes/:id/cook/complete`,
`GET /inventory`; 5 tests, stale KV injected), P2 reconciliation-vs-manual race
now requires the explicit `STALE_SNAPSHOT` loser (no `PERSISTENCE_FAILED`).
Route fix surfaced by the proof: adopted cook replays its durable receipt before
re-planning (response-loss retry → replay, not INSUFFICIENT_INVENTORY). Gates:
full 3,085/3,085 across 119 files; T09 654; T10 98; T11 39; T12 22; real D1
70/70; lint/typecheck/build/30-migration smoke/schema/diff PASS — repeated from
the clean detached exact-SHA checkout with empty status. UNKNOWN readers/writers
= 0. No migration. Main NOT merged; production NOT deployed; remote D1 NOT
touched; PayOS untouched; Final Release Integration Review NOT started.

## Historical T12 state — first freeze 22f675d (superseded)

**T12 application freeze: `22f675d1cca76d05c93ebb2ed40bbaea11a72238`** — `feat(t12): close the inventory truth
loop` — the final Inventory Truth release-train task. The loop
evidence → observation → reconciliation → T09 command authority →
inventory_lots → T11 read authority → consumers is closed and proven by a
permanent 9-test closed-loop suite (E2E reconciliation exactly-once, DISMISS
inert, recipe/planner/shopping/cook/notification loops, single-winner races,
drift matrix). Display aliases tightened: tampered projection rows drop to
canonical presentation. FINAL_AUTHORITY_MAP/FINAL_WRITER_MAP: UNKNOWN
production readers/writers = 0. Gates: full 3,072/3,072 across 117 files; real
D1 62/62; all static/30-migration/schema gates PASS. No migration; no new
writers. Main NOT merged; production NOT deployed; remote D1 NOT touched;
PayOS untouched; **release train T08–T12 COMPLETE**.

## Historical T12 baseline state — T11 hardening (superseded by T12)

**New T11 application freeze: `c15c9a81fc4367b3506a7e2693798ebe1424b0a9`** — `fix(t11): complete read
authority runtime hardening` — published/fetched (direct commit publication,
no PR tooling), local == remote == clean-checkout SHA; `657201f` superseded.
Closed: real workerd/D1 proof of T11 (11 cases; real D1 51 → 62), adopted-but-
empty regression on integration + real D1 + HTTP (native mode, `[]`, no legacy/
KV/auto-adoption), READ vs MOVE/DISCARD/FEFO barrier coverage (matrix now
CORRECT/MOVE/USE/DISCARD/FEFO/T10), `activeCount` = filtered summary, explicit
kg↔g / l↔ml display-alias compatibility with canonical authority intact, and
fail-closed freshness (`computeReadFreshness`, invalid dates → CORRUPT_LOT_ROW).
Gates: full 3,063/3,063 across 116 files; T09 654/654; T10 98/98; T11 39/39;
real D1 62/62; lint/typecheck/build/30-migration smoke/local schema/diff PASS —
repeated from the clean detached exact-SHA checkout with empty status. Readers/
writers UNKNOWN = 0. No migration. Main NOT merged. Production NOT deployed.
Remote D1 NOT touched. T12 NOT STARTED. **T11 COMPLETE — READY FOR INDEPENDENT
REVIEW.**

## Historical T11 state — first freeze 657201f (superseded)

Branch `hoplite/himera-6d3eda84-t10-observation-reconciliation-t11-inventory-read-authority`
(start_branch successor; base = train merge `30ce4ea` containing exactly the
required T10 docs HEAD `c71692a`). **T11 application freeze: `657201f3a12f18dd96cc96adeac0dd1d3b75e6f4`**
published as **PR #3** (base `hoplite/kydonia-2785bb72` — the release train,
NOT main); corrective `4553b8a` removed the platform auto-committed
workspace overlay (`c7e2296`; overlay preserved byte-for-byte uncommitted).
The T09/T10 truth layer is now the canonical READ authority: adopted
households read `inventory_lots` + validated mapping evidence through
`packages/db/src/inventory-read-authority.ts`; `inventory_items` never decides
truth; no dual-truth fallback; corruption fails closed; reads never write.
Read consumer audit: production UNKNOWN=0 (`docs/ai/inventory-truth/t11/
READ_CONSUMER_MAP.md`). Gates: full 3,041/3,041 across 115 files; real D1
51/51; lint/typecheck/build/30-migration smoke/local schema/diff PASS —
repeated from a clean detached exact-SHA checkout with empty status. No
migration. Main NOT merged. Production NOT deployed. Remote D1 NOT touched.
T12 NOT STARTED. **T11 COMPLETE — READY FOR INDEPENDENT REVIEW.**

## Historical T10 state — observation claim fence (superseded by T11)

Branch `hoplite/himera-6d3eda84-t10-observation-reconciliation`. **New T10 application
freeze: `7393edcd4fb9cc8bb4df2a06628fb5dc57f8607b`** — `fix(t10): atomically fence competing reconciliation
decisions` — published/fetched, local == remote == clean-checkout SHA; `4c414fa` is
superseded (historical ancestor). Reproduced P1: two decision keys racing one OPEN
observation relied on a trigger side effect — the final guarded observation UPDATE with zero
rows is a silent D1 success, losers surfaced raw SQLite errors, and with the 0030 receipt
trigger absent both decisions committed. Fix: an in-batch `changes()` claim guard (T09
write-guard technique) makes a lost OPEN/vN → RECONCILED/vN+1 claim abort the whole atomic
batch (T09 commands, events, projection, receipt, observation all roll back); losers get
`OBSERVATION_VERSION_CONFLICT`; a committed same-key twin replays (response-loss preserved),
altered twin → `IDEMPOTENCY_CONFLICT`. 13 regressions (13 fail pre-fix) + 2 real-D1 proofs
incl. a controlled race under workerd. Gates: full 3,024/3,024 across 114 files; T10
focused 98/98; T09 focused 323/323; real local D1 51/51; lint/typecheck/build/30-migration
smoke/local schema/diff PASS — repeated from the clean detached exact-SHA checkout. No
migration. Main NOT merged. Production NOT deployed. Remote D1 NOT touched. T11 NOT STARTED.
Verdict: **T10 PASS — READY FOR INDEPENDENT REVIEW.**

## Historical T10 state — composition fix 4c414fa (superseded by 7393edc)

Branch `hoplite/himera-6d3eda84-t10-observation-reconciliation`.
**New T10 application freeze: `4c414fa7eb33329ee12936c0899644af67e48f07`** — `fix(t10): compose multi-field
reconciliation commands atomically` — published/fetched, local == remote ==
clean-checkout SHA; the previous freeze `6c28858` is superseded (historical ancestor).
Reproduced P1: the planner collected per-dimension proposals independently, so one
lot could receive 2–3 CORRECT proposals (quantity/expiry/openedAt) plus a MOVE, mixed
claims took an expiry-only verdict, and split CORRECTs shared the `<decisionKey>#CORRECT`
client key (idempotency/CAS hazard). Fix: `composeProposals` merges all compatible
CORRECT changes into exactly one CORRECT plus at most one MOVE bound to the matched
lot/version (contradictions → CONFLICT `PROPOSAL_COMPOSITION_CONFLICT`); the decision
boundary independently enforces max one CORRECT / one MOVE / same lot+version / type
consistency and fails closed; CORRECT+MOVE composes through T09 `useCurrentLotVersion`
atomically. 19 permanent regressions (16 fail pre-fix). Gates: full 3,009/3,009 across
113 files; T10 focused 78/78; real local D1 49/49; lint/typecheck/build/30-migration
smoke/local schema/diff PASS — repeated from the clean detached exact-SHA checkout.
No migration; 0023–0030 untouched. Main NOT merged. Production NOT deployed. Remote D1
NOT touched. **T10 COMPLETE — READY FOR INDEPENDENT REVIEW.** T11/T12 NOT STARTED.

## Historical T10 state — initial freeze 6c28858 (superseded by 4c414fa)

Repository `vb-2f/frigo-dev` (repository ID 1364064929; task lineage `vn-2e/frigo-dev`).
Branch `hoplite/himera-6d3eda84-t10-observation-reconciliation`, the platform-verified
successor created from the configured train base after PR #1 merged the frozen T09
branch internally (train merge `668920fa462524e65a79d31a7b0844720baf38e0`; main
`d1b06732f8a80db4e77986df31ff28d9f04641fa` is untouched and NOT merged).
**T10 application freeze: `6c28858acd0627d2d602998107c2e260c5e4f0d5`** —
`feat(t10): add inventory observation reconciliation authority` — published/fetched
with local == remote == clean-checkout equality. T10 adds the observation/evidence/
reconciliation layer above T09 authority without any second stock writer: additive
`0030` observation/decision persistence (evidence never mutates inventory), a pure
deterministic planner (MATCH / NO_ACTION / STALE / AMBIGUOUS / CONFLICT /
PROPOSE_CORRECTION / PROPOSE_MOVE / PROPOSE_EXPIRY_UPDATE / UNSUPPORTED) with exact
milli quantities, name-matching refusal, contextual-unit refusal and confirmed-expiry
precedence, and a decision authority that composes existing T09 CORRECT/MOVE commands
in one atomic batch with receipt-backed response-loss replay and IDEMPOTENCY_CONFLICT
on altered semantics. Baseline before edits: 2,926/108 full, 44 real D1, all static
gates PASS. At the freeze: 2,990 full/112 files; T10 focused 1,097/19 files; real
local-D1 49/49; lint/typecheck/build/30-migration smoke/local schema gate (requires
0030)/diff PASS — all repeated from the clean detached exact-remote-SHA checkout with
empty status. No HTTP routes added (T09 precedent; T11 owns UX surfaces).
**T10 COMPLETE — READY FOR INDEPENDENT REVIEW.** T11 and T12 are NOT STARTED.
Exact evidence: `inventory-truth/t10/VERIFICATION.md`, `inventory-truth/t10/TEST_MATRIX.md`.

## Historical T09 state — FEFO v2 backfill compatibility (superseded as current; freeze remains a verified ancestor)

Repository `vn-2e/frigo-dev` (live origin `vb-2f/frigo-dev`, same lineage), branch
`hoplite/himera-6d3eda84`, the platform-verified successor checked out at the exact
previous docs HEAD `8552fe5337245f2ac8349933c02946bf7d9dcc8f` (`hoplite/kydonia-2785bb72` tip unchanged there).
**New final T09 application freeze: `bf391c5fdcdd9e9c2f2257db515815e082cb4381`** — `fix(t09): support backfilled
mappings in fefo authority` — published/fetched with local/remote equality PASS.
The last remaining P1 is fixed: FEFO v2 now serves legitimate adopted/backfilled
synthetic lot mappings. Equal-ID authority was replaced, not bypassed: additive
`0029_inventory_fefo_backfill_compatibility.sql` recreates only the two v2 FEFO
triggers so a lot acts under its legacy projection identity only when LEGACY_BACKFILL
provenance, source identity and the immutable adoption receipt prove the mapping with
a preserved version offset; prestate parity accepts the exact kg/l display aliases;
poststate guards stay strict and native equal-ID lots pass unchanged. P1 reproduced
first (13/13 new tests fail DRIFT_DETECTED on the pre-fix tree, zero mutation).
Fresh PASS: 1,237 focused/15 files (59.52s); 2,926 full/108 (118.20s); 44 real
local-D1; lint/typecheck/build/29-migration smoke/local schema/diff. Clean detached
exact-remote-SHA checkout repeated every gate: 2,926/108 (119.10s), 44 D1, empty
git status. NO GITHUB CI STATUS for the branch. No route invokes v2 FEFO; the adopted
cook path already uses synthetic-compatible v1 commands. Verdict: **READY FOR FINAL
MAIN MERGE REVIEW** (main not merged by this agent). Exact evidence:
`inventory-truth/t09/FINAL_PATCH_VERIFICATION.md`.

## Historical backfill compatibility state — superseded by bf391c5

Repository `vn-2e/frigo-dev`, branch `hoplite/kydonia-2785bb72`.
Final backfill compatibility application freeze: **`df73bc035c2938b6fd082c57f6bca89a82d8e443`**.
The inherited backfilled PATCH P1 is reproduced and fixed without migrations:
synthetic lot IDs are authenticated by the immutable mapping and exact household
adoption witness. Projection CAS, event IDs, replay and composition retain both identities.
Fresh PASS: 619 focused/nine files; 2,910 full/107; 42 isolated real local-D1;
all lint/typecheck/build/migration/local-schema/diff gates. Exact fetched SHA also
passed frozen install, full 2,910/107, all gates and 42 D1 tests in a clean worktree.
**NOT READY FOR MAIN**: the bounded shared-caller check found v2 FEFO still rejects
synthetic mappings in unchanged 0027 SQL. Its fail-closed boundary is preserved;
further compatibility needs separately authorized schema work, not a guard bypass.
Exact evidence and next action: `inventory-truth/t09/FINAL_PATCH_VERIFICATION.md`.

## Historical PATCH parity checkpoint — superseded by df73bc0

Repository `vn-2e/frigo-dev`, branch `hoplite/kydonia-2785bb72`.
New final application freeze: `e796f695bdb4228853992cdedc4e3cecf3437adb` (published/fetched equality).
External final review's storage replay and category parity defects were reproduced
and fixed. Complete normalized request presence/value is retained in native receipts;
CORRECT/MOVE/category commit atomically; historical response replay no longer reads
today's stock. Native commands without PATCH metadata are unchanged.
Fresh gates: 515 focused / six files, 2,865 full / 106 files, 40 isolated local-D1,
lint/typecheck/build/28-migration smoke/local schema/diff PASS.
Recommendation: **NOT READY FOR MAIN**. An inherited P1 remains: PATCH of an
adopted backfilled legacy lot rejects its legitimate distinct mapping with
`500 DRIFT_DETECTED`. No adoption/migration fix was attempted in this narrow task.
Exact clean-source evidence, historical SHAs and next action:
`inventory-truth/t09/FINAL_PATCH_VERIFICATION.md`.

## Historical evidence — all prior freeze/readiness claims below are superseded

## T09 F/G/H complete — 2026-09-11

Independent review follow-up `27427383d61930ea1b67ccbc1d69bb1cc069f931` is published on the same branch. It restores exact adopted PATCH response-loss replay before legacy version preflight, rejects altered key reuse, and retains normal CAS for a distinct key. Fresh full verification: 2,838 tests / 105 files PASS (165.25s), lint/typecheck/build and 28-migration smoke PASS.

T09F = COMPLETE, T09G = COMPLETE, T09H = COMPLETE (freeze + evidence). Application
freeze SHA: `9bf9ac0fe7b5e0d39615f39ae5cc30f84569af2f`, published/fetched on **hoplite/kydonia-2785bb72** with exact
local/remote equality; branch base `hoplite/kos-2a686759` is the platform read-only
configured base at `aa44d2a2f80ea33fd4b328aba906660c0129051e` and refused publication, so the verified successor
continues that exact lineage (same pattern as the prior transfer). A–E unchanged.
Full gates at this checkpoint: **2,837 tests / 105 files PASS** (155s), including the new 19-test adoption suite, 9-test G concurrency matrix and rewritten 14-test writer-fence suite; 38 isolated real local-D1 tests PASS; lint PASS; typecheck PASS; build PASS; 28-migration smoke PASS; local D1 schema gate PASS (0028 required).
Adoption: atomic receipt-backed `executeInventoryAdoption` (migration 0028), empty-household
activation evidence, executor-owned snapshot/authority validation, projection-compatibility
preflight. Every inventory writer now serves adopted households through the lot authority
(manual create/edit/discard, scan confirm, shopping import, cook) and fails closed with
`INVENTORY_AUTHORITY_REQUIRED` when mappings are incomplete; DEC-012 remains SAFE-DEFERRED.
G matrix: USE/USE, USE/DISCARD, USE/CORRECT, DISCARD/DISCARD, MOVE/MOVE, OPEN/OPEN,
FEFO/FEFO, receipt replay, duplicate event identity, household isolation, cross-tenant
identities, adoption races and stale-legacy-post-activation all pass with property sweeps.
Not authorized/started: main merge, deployment, remote D1, PayOS, T10. Independent
review readiness: READY FOR EXTERNAL ASTRA REVIEW (reviewer decides next steps).

## Historical continuation record — 2026-09-11 (superseded)

Latest verified/published application: `aa43e069edbff7843e9eb7532ff386b27be96a17`.
Same task, A–E COMPLETE; F IN_PROGRESS; G/H NOT_STARTED. F now has pure adoption
preparation, in-transaction legacy writer refusal for mapped households, scan/
shopping stock-revision fences, shopping claim/lease/response-loss recovery, and
server-scan confirmation recovery without duplicate manual additions. DEC-012 is
unchanged. No adoption activation or functional mapped-household adapters yet.
Fresh gates: **1,347 focused / 19 files**, **2,808 full / 103 files**, 38 actual
isolated local-D1 tests within those gates, lint/typecheck/27-migration smoke/build
and diff/protected-path checks PASS. Two scoped independent-review P2 findings
were fixed/retested; no remaining P1/P2 in this partial increment. Full F still
requires retained scan-intent validation, atomic adoption and all writer adapters.
Next: additive v3 atomic adoption authority, then functional adapters, G and H.
Detailed evidence/failures: `inventory-truth/t09/VERIFICATION.md`.

Canonical repository: **vn-2d/frigo-dev**. Writable successor:
**hoplite/kos-2a686759**, directly from verified interrupted F
`66858c5296b38715e4bfca77fca5eefe5adadf5a` on read-only prior continuation
`hoplite/orchemenos-e002591e`. Transfer/ancestry PASS; baseline 2,685 tests / 99
files, typecheck/lint/27-migration smoke/build PASS. At takeover: 18 ahead / 0
behind unchanged origin/main. Exact authority/evidence: `inventory-truth/t09/CONTINUATION.md`.
Earlier repository references are historical provenance only.

The following pre-transfer chronology is historical. Continuation was based on frozen T09D remote
811f7e8463303e010199741d66f88ab8a817212d. Successor documentation checkpoint
8bf32ed4e41ed3341215c6376e0c13ef13043616 was published/fetched before E code.
A–E complete; E published as `9bd1e6bc000cd2e94121469babb1a5eb63a5047f`.
Fetch/equality/ancestry PASS. F is in progress; G–H pending.
E adds deterministic 1–32-effect atomic FEFO, version-2 receipts/events and additive
0027; v1 authority and migrations 0023–0026 remain intact. No adoption, live writer,
HTTP or UI cutover. Latest post-fence gates: 1,172 focused / 11 files (35 actual
local D1 tests), 2,659 full / 98 files, lint/typecheck/build and migration smoke
PASS. Scoped independent E review has no remaining P1/P2 findings. Earlier
1,170 focused / 2,657 full results predate the ordered-receipt fence.
F first safety change implemented: DEC-012 guest transfers explicitly reject
before OTP/account/session or data mutation. Guest/auth/outbox focused 143 PASS;
full 2,685 / 99 files and lint/typecheck/build/27-migration smoke PASS. General
adoption and manual/scan/shopping/cook adapters remain next per
`inventory-truth/t09/F_ADOPTION_PLAN.md`. Full F completion is not claimed.
Exact chronology, limits and corrected failures: `inventory-truth/t09/VERIFICATION.md`.
See `inventory-truth/t09/CONTINUATION.md` for exact branch authority, checks,
publication restriction and preserved pre-existing settings overlay. All protected
surfaces untouched; no application freeze or independent-review readiness.

## Historical T09D checkpoint — 2026-09-10

Program: Inventory Truth Layer. Canonical repository: vn-2b/frigo-dev (user
confirmed). Branch: hoplite/euhesperides-d77023a5. Exact T08 base:
8f8788c1a0c9e486657751ef3875a5baa5334dec. Main anchor: d1b06732f8a80db4e77986df31ff28d9f04641fa.
Publication-first and A/B checkpoints published/fetched. T09C now implements
internal native command persistence with membership, CAS/revision fence, immutable
receipt/event and exact legacy projection; additive 0024 and actual local D1
rollback/executor tests. No HTTP exposure, historical adoption or old writer cutover.
Mixed legacy households fail closed with ADOPTION_REQUIRED. Full/native gates and
corrected findings are recorded in inventory-truth/t09/VERIFICATION.md.
Published C checkpoint 13133b3: 507 focused, 1,994 full / 93 files PASS;
lint/typecheck/build, 24-migration/local schema PASS; remote-source worktree 507 PASS.
T09D now validates retained receipt/event evidence, binds new events to declared
effects and actual written stock (additive 0025/0026), and rejects paired evidence
corruption. Final D gates: 1,031 focused / 2,518 full tests (95 files), lint,
typecheck, build, 26-migration replay/local schema PASS. D code checkpoint
b036b257a8ad775dd6f1a445dcfdcce38a6babf1 published/fetched with exact equality;
separate fetched-source worktree: 1,031 tests and typecheck PASS, clean tree.
Next: E FEFO and F legacy adoption/writer integration.
T09 remains IN_PROGRESS; no application freeze or independent-review readiness.
No main, legacy Frigo, production/staging, remote D1 or PayOS changes; no T10.
The release/T08 sections below are historical evidence, not current work authority.

## T08 COMPLETE — authorized publication (2026-09-10)

Repository `vn-2c/Frigo`. The user explicitly approved publication on
`hoplite/xanthos-7d942897` instead of the blocked original feature name (DEC-006).
That branch is now the canonical cross-account handoff; publish and fetch confirmed
`fb00f46d4633c9659e812be9f86119533973a8bd`, followed by this docs-only completion
receipt. Last code: `dd2ecc6f7066250dfdc5214a3d6c356e1479b61e`.
Base/final fetched main: `d1b06732f8a80db4e77986df31ff28d9f04641fa`, unchanged.

Implemented additive 0023 storage/lot schema, strict quantity/money/expiry/source
contracts, guarded insert-only legacy backfill, compatibility projection/parity.
No legacy API/read/write path cutover. Fresh final-session **130 focused tests**,
**1,617 full tests / 89 files**, lint/typecheck/build, 23-migration replay/local
schema and diff checks PASS. Prior sandbox-local D1 apply passed 23/23. Early
failures and publication denial are resolved and preserved in the evidence log.
No source/test/schema change since dd2ecc6; later commits are documentation-only.

Next action: next account checks out `origin/hoplite/xanthos-7d942897`, reads the
handoff and final report, and waits for a separately authorized T09 task. No T09
implementation, main integration or deployment is implied by T08 completion.

Read `inventory-truth/MASTER_CONTEXT.md`, `CURRENT_STATE.md`, `TASK_BOARD.md`,
`DECISIONS.md`, `VERIFICATION.md`, `SESSION_LOG.md` and
`inventory-truth/T08_VERIFICATION.md` and `tasks/T08-inventory-truth-foundation.md`
for exact evidence, final Git anchors, limitations and T09 prerequisites.
Main, production/staging, remote D1, PayOS and release operations untouched.

## Preserved T01–T07 release snapshot (not T08 deployment evidence)

## Production integration candidate (2026-09-15)

- Active branch: `integration/t13-takosan-qwen`, created from current production
  `main` at `05423f2ad675006a4c7913e696f1979b3fcaae59`.
- Production repository identity: `Tungjpstore/Frigo`, ID `1360256196`.
- Development source identity: `vn-dlo/Frigo-dev`, ID `1368281478`.
- Common ancestor with Takosan application `ff63edfb...`:
  `d1b06732f8a80db4e77986df31ff28d9f04641fa`.
- Integration analysis and migration bridge mapping are in `docs/integration/`.
- Status: analysis checkpoint in progress; no candidate designation, merge,
  deployment, remote migration, production resource mutation, PayOS change, or
  T14 work has occurred.

> This checkpoint retains the historical production receipt and separately tracks
> the unreleased OCR recovery candidate dated 2026-09-12.

## Release status

- T01-T07: COMPLETE.
- T01: **COMPLETE**
- T02: **COMPLETE**
- T03: **COMPLETE**
- T04: **COMPLETE**
- T05: **COMPLETE**
- T06A: **COMPLETE**
- T06B: **COMPLETE**
- T07: **COMPLETE**
- Release Integration: **COMPLETE**
- Release Publication: **COMPLETE**
- Main Integration: **COMPLETE**
- Main CI: **PASS**
- Production reconciliation: **COMPLETE - SCHEMA AND WORKER CUTOVER VERIFIED** (2026-09-10).
- OCR production recovery: **COMPLETE - DEPLOYED AND VERIFIED** (2026-09-13).

## Authoritative source

- GitHub source of truth: main.
- Deployed application SHA: `bdb0dda0b1123c4fd940058091e3cb285d5e8eb8`.
- Commits after the deployed application are documentation-only receipt merges;
  verify the current `main` head from GitHub when preparing a later release.
- Current `github-frigo/main` observed 2026-09-12: `db2377fd9f63d1be38ce3882c6d8173e0bf9e497`.
- GitHub API redirects `vn-2c/Frigo` to canonical public repository
  `Tungjpstore/Frigo`; the configured `github-frigo` remote remains the alias.
- OCR recovery branch: `codex/ocr-production-recovery`, based at `d8ca112a5ac5eb215f36a3f89b4218e2fc691371`;
  candidate implementation is committed at `ec87aec` and deployed through
  merge commit `bdb0dda0b1123c4fd940058091e3cb285d5e8eb8`.
- The 2026-09-13 PR #17 merge added the OCR recovery implementation to `main`;
  production now reports the merge SHA and Worker version recorded below.
- PRODUCTION_APPLICATION_BASE_SHA:
  `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`.
- PRE_CLEANUP_MAIN_HEAD: `41d2de6bc76331322cc63e8038432b0b02f60da1`.
- APPLICATION INTEGRATION: complete in main at `23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`.
- Verified application SHA: `0b20061e7dc7405df68b18a18da4166e09494ecd`.
- Verified release head: `0420807968538f61b669569d064c404f67032174`.
- Main head before this correction: `41d2de6bc76331322cc63e8038432b0b02f60da1`.
- The main merge tree is source-equivalent to the verified release head.
- Changes after the historical application base now include the merged OCR
  recovery implementation and its additive migration; the production receipt
  is anchored to `bdb0dda0…`.

## Verification snapshot

| Gate | Result |
| --- | --- |
| Full suite | 1,487 tests / 87 files PASS |
| Focused T02-T07 | 819 tests / 40 files PASS |
| Clean D1 | 22 / 22 migrations PASS |
| Upgrade sanity | 0020 -> 0022 PASS |
| Existing data | 776 rows / 58 tables preserved |
| Browser | 264 assertions / 36 phases PASS |
| Payment-adjacent | 82 tests / 7 files PASS |
| Main CI | 34396319671 SUCCESS |
| Previous final-head CI | 34405307196 SUCCESS |

These are the preserved release gates; the post-cutover local gates and remote
schema/Week checks are recorded in the receipt below.

## Deployment and production boundary

- Previous release deploy workflow `34396457582`: **SUCCESS**.
- Previous docs-cleanup deploy workflow `34405457796`: **SUCCESS**.
- Release packaging completed.
- Staging was not provisioned; no staging deployment occurred.
- Production DB migration: **COMPLETE** - D1 `frigo-db` ledger contains exactly `0001` through `0023`; `0023` was applied additively on 2026-09-13 after the retained backup.
- Production deployment: **COMPLETE** - Worker deployed with Wrangler OAuth from candidate SHA `bdb0dda0b1123c4fd940058091e3cb285d5e8eb8`.
- Production reconciliation: **COMPLETE** - post-cutover source, schema, health and traffic checks passed.
- Active deployment: Cloudflare version `df7225c9-6f20-4206-9f16-573de6a69c43`, 100% traffic, deployed 2026-09-13T01:01:24Z.
- OCR recovery: **DEPLOYED AND VERIFIED**. Remote D1 `0023` is applied and gated;
  Qwen secret and non-PII smoke passed; readiness reports commit `bdb0dda0…`.
- Planner rollout: NOT STARTED.
- Production secret `QWEN_API_KEY` was added from the operator clipboard; its
  value is never stored in the repository or logs. Existing secret names include
  `JWT_SECRET`,
  `OTP_HASH_SECRET`, `TURNSTILE_SECRET_KEY`, `QWEN_API_KEY` and optional
  `GROQ_API_KEY`. The Qwen key value is not written to the repository or logs.

## Production cutover receipt (2026-09-10)

Verified against `https://frigo.tungjpstore.net` after the cutover:

- Worker readiness: HTTP 200, `status=degraded`, `environment=production`, and
  full `commit=d1b06732f8a80db4e77986df31ff28d9f04641fa`; database/queue/AI/email
  are `ok`/`configured`, rate limiting is `kv-best-effort`, and the only issue is
  the non-blocking warning `CONFIG_PLUS_GRANT_SECRET_MISSING`.
- Liveness and landing smoke: `GET /` and `GET /api/v1/health` returned HTTP 200;
  readiness smoke passed with database `ok` and no fatal configuration issue.
- Exact remote schema gate: PASS; migration ledger is exactly 22 entries
  (`0001`-`0022`), foreign-key violations are `0`, and the Week strict
  reconciliation is 2/2 plans with 0 orphan rows and 0 mismatches.
- Key preserved row counts: users 28, households 28, inventory items 13,
  recipes 59, meal plans 2, scan queue jobs 15, sessions 2, auth OTPs 0.
- CORS verification: the exact trusted origin receives its own ACAO header;
  path-bearing, localhost and arbitrary origins receive no ACAO header.
- Backup retained at `.artifacts/frigo-db-pre-main-d1b0673-20260910T205627Z.sql`,
  mode 600, 521095 bytes, SHA-256
  `000c9cb88d6045afb19cca6ce3e1caa308b20ffa214dbb2cddfca0cb78d722eb`.
- Deployment used a clean detached checkout at the approved main SHA and
  `GIT_COMMIT` injection only; no planner flag, PayOS/payment path or secret
  value was changed.

## OCR production-recovery candidate (2026-09-12)

The candidate addresses provider/model recovery and scan failure handling without
changing the production receipt above:

- Candidate schema now includes additive migration `0023_scan_request_fingerprint.sql`;
  local replay and schema checks cover `0001`-`0023`. Production D1 migration
  `0023` was applied after backup `.artifacts/frigo-db-pre-ocr-20260913T005253Z.sql`
  (SHA-256 `bc62e5844c6a838a3b1b98d29dffa39c9d6cf6e1d570617e843c9e3e820bb088`).

- Qwen `qwen3.7-flash` is the primary provider for vision, receipt OCR, chat and
  recipe ranking through the DashScope international OpenAI-compatible endpoint
  (`QWEN_BASE_URL`, `QWEN_MODEL`); structured requests disable thinking. Groq is
  retained only as an explicit legacy fallback (`GROQ_FALLBACK_ENABLED=true`),
  and is disabled in the candidate vars.
- Native Cloudflare vision remains opt-in through
  `CLOUDFLARE_VISION_FALLBACK=false`. DeepSeek remains the optional text/ranking
  fallback when `DEEPSEEK_FALLBACK_ENABLED=true`, and Z.ai/GLM the optional
  vision/text extension path when `GLM_FALLBACK_ENABLED=true`; a GLM-5.3 Flash
  upgrade is future work and is not claimed as active.
- Vision and receipt responses pass Zod validation plus a deterministic quality
  gate: generic/placeholder labels and confidence below `0.6` are removed;
  no usable rows return `AI_SCAN_NO_USABLE_ITEMS` instead of a fabricated draft.
- Typed provider errors classify permanent `MODEL_NOT_FOUND`, auth/permission,
  license, schema/invalid-response and quality failures separately from retryable
  `REQUEST_TIMEOUT`, `NETWORK_ERROR`, `RATE_LIMITED` and `UPSTREAM_ERROR` errors;
  queue retries remain bounded by the existing attempt/DLQ contract.
- Scan status responses expose bounded error codes and retry metadata; OCR output
  remains untrusted draft data requiring review and confirmation.
- Focused local checks on 2026-09-13: Qwen provider ESLint PASS;
  provider/recovery, queue, quota, scan-route and UI tests PASS. The complete
  candidate `pnpm check` gate is green: 1,579 tests / 93 files PASS, lint,
  typecheck, migration replay through `0023` and production build all PASS.
- Live provider access is **VERIFIED**: non-PII chat smoke returned HTTP 200 from
  DashScope with model `qwen3.7-flash` and response `OK`. Production readiness
  returned HTTP 200 with `ai=configured`, database/queue `ok`, and only the
  existing non-blocking `CONFIG_PLUS_GRANT_SECRET_MISSING` warning.

## Verification commands

- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm check:migrations`: PASS (`migration-smoke=ok`).
- `pnpm build`: PASS.
- `pnpm test`: 1,427/1,487 passed; 60 failures are confined to the two known
  shell/jsdom UI suites (`localStorage`/`container` unavailable). Hosted exact-SHA
  CI run `34413458369` remains the authoritative 1,487/87 PASS gate.
- `pnpm schema:check:remote`: PASS; `pnpm week:reconcile:remote -- --strict --json`: PASS.
- `pnpm audit --prod`: 2 moderate `react-router` advisories via
  `react-router-dom` (patched upstream at 7.18.0; major upgrade not included in
  this cutover). Full dependency audit reports 21 findings, with the remainder
  confined to development/tooling paths (`wrangler`/`miniflare`/`jsdom`).
- Read-only lineage checks: `git ls-remote --heads github-frigo main` returned
  `db2377fd9f63d1be38ce3882c6d8173e0bf9e497`; `git rev-list --left-right --count
  HEAD...github-frigo/main` returned `0 2`; no remote fetch or mutation was run.
- `git diff --check`: PASS for this documentation checkpoint.
- OCR candidate local lint/typecheck/test/build/migration checks: **PASS** on
  2026-09-13. Hosted PR #17 CI run `34728606704` also passed (1,579 tests / 93
  files). Live non-PII Qwen smoke, migration `0023`, deployment and readiness
  evidence are verified; only the non-blocking Plus Grant warning remains.
- Wrangler OAuth is authenticated as `tungbipdz@gmail.com` (account
  `ef250a88911fd24073cb73d1c07e0218`).

## PR #8 metadata

PR #8 METADATA:

Authoritative GitHub state: `MERGED`, `isDraft=false`,
`mergedAt=2026-09-09T19:38:59Z`, `closedAt=2026-09-09T19:38:59Z`,
`mergeCommit=23ef51d6ec12a5a3e319a2d941dca39d2775cb9d`, base `main`, head
`hoplite/kirrha-5f4057f0` at `0420807968538f61b669569d064c404f67032174`.

Application integration and PR metadata are separate facts: application
integration is complete in main at `23ef51d`; PR #8 was already merged and was
not reopened, re-merged or modified.

## Kirrha archival state

Kirrha is two commits ahead of current main and differs in four `docs/ai/` files
only. There are no application differences on that historical branch that are
absent from main. Do not merge or revert kirrha.

## Protected areas

PayOS/payment code untouched.

No real payment performed.

## Next task

Next task: MONITOR OCR QUALITY/LATENCY AND SCHEDULE REACT ROUTER UPGRADE

Keep the deployed Worker and planner flags at their safe defaults while the OCR
candidate is validated. Run the focused provider/queue/UI tests, all required
local gates and an authorized live-provider smoke against the exact candidate SHA;
then obtain hosted CI, readiness and canary evidence before any production deploy.
No remote migration or production secret change has been performed for this
candidate. Migration `0023_scan_request_fingerprint.sql` is required before a
guarded deploy; do not touch PayOS/payment or use a down-migration. Until a new
readiness receipt exists, the production receipt remains the direct Wrangler
deployment above; rollback is code-only to a schema-compatible SHA.

The deployed receipt is anchored to main SHA
`d1b06732f8a80db4e77986df31ff28d9f04641fa`; the pre-cleanup main head is
`41d2de6bc76331322cc63e8038432b0b02f60da1`.

## OCR image payload optimization (2026-09-13)

- Local candidate `src/web/lib/private-image.ts` now decodes gallery images in
  memory, caps the longest side at 2,000 px, and emits JPEG quality `0.82` only
  when the derivative is smaller; small images are never upscaled.
- The original `File` is not modified or persisted. Private-session fencing and
  cancellation cover the async bitmap/canvas path; unsupported browsers fall
  back to the existing `FileReader` data URL flow.
- The attached 1,086x1,448 receipt measured 2,116,353 bytes as PNG. A local
  JPEG quality-0.82 conversion measured 382,334 bytes (81.9% reduction) without
  changing pixel dimensions. Provider OCR recall has not yet been re-run on the
  browser-generated derivative.
- Regression coverage: `tests/unit/scan-privacy.test.tsx` now has 11 passing
  tests, including resize, no-upscale and cancellation cases.
- Status: **COMMITTED LOCALLY / NOT DEPLOYED** at `ba3d872eea2d677e38f94adb8355f493c4c45852`.
  Next action is device/browser OCR smoke with the attached receipt, then open
  the release review for promotion.

## Qwen runtime governance candidate (2026-09-13)

- Working branch: `feat/qwen-ai-runtime-cost-router`.
- Base SHA: `05423f2ad675006a4c7913e696f1979b3fcaae59` (`github-frigo/main`).
  Canonical `main` is unchanged; no production deployment is authorized.
- Application checkpoint: `21c442d` (`feat(ai): add governed qwen task runtime`).
  Documentation remains a separate local checkpoint after this implementation.
- Added `QwenTaskRuntime`, model-role governance, versioned prompt registry,
  centralized pricing, bounded budgets/escalation, structured validation and
  isolate-safe usage telemetry. Production Worker composition now explicitly
  builds this path with `AI_QWEN_ONLY=true` and the role aliases in
  `wrangler.jsonc`.
- Scan HTTP, scan queue and meal explanation constructors share the same
  server-side AI config helper. Legacy non-Qwen adapters remain only for
  compatibility when Qwen-only mode is not selected; they are not constructed
  by the production path.
- Inventory boundary is intentionally limited to this repository: the final
  T08-T12 Inventory Truth AI-to-observation-to-reconciliation certification is
  pending later unification with `frigo-dev`; no code or migrations were
  imported from that lineage.
- Offline golden fixtures and `pnpm ai:eval -- --dry-run` were added. No live
  Alibaba request is made by tests or CI. Optional shadow traffic is disabled
  by default and now reserves its call/token budget before launching.
- Final local verification: `pnpm check` PASS with 1,606 tests / 95 files,
  lint, typecheck, migration replay and production build all PASS. The check
  intentionally skipped remote D1 schema and Week parity because no release
  flag was supplied. `pnpm ai:eval -- --dry-run` and `git diff --check` PASS.
- Focused recertification command covered Qwen runtime/provider, router,
  configuration, explanation, image privacy and scan queue paths: **119 tests /
  8 files PASS**. No concrete runtime defect was found during the final review;
  readiness already probes the additive scan columns from migration `0023`.
- `pnpm audit --prod` remains a known non-blocking follow-up: two moderate
  `react-router` advisories are fixed upstream at `>=7.18.0`; this task did not
  change dependencies.
- Candidate publication is complete: `feat/qwen-ai-runtime-cost-router` was
  pushed normally to `github-frigo`, and `git ls-remote` verified the remote
  SHA against the local candidate. Canonical `main` remains unchanged at
  `05423f2`; no merge, remote migration or deployment occurred. Next action is
  code review or a separately authorized Qwen benchmark.

## Qwen pre-unification hardening (2026-09-13)

- Application implementation/publication SHA: `f8468eaa7d7fed3cbcf5ac7e780eca07ad3d71e4`.
- Final pre-documentation branch head (including the scheduler-failure
  regression test) is `a145ef5`; the docs checkpoint is a subsequent commit.
- The normal push was verified against `github-frigo/feat/qwen-ai-runtime-cost-router`
  at that SHA; this documentation checkpoint is a subsequent local commit.
- OCR capability metadata is centralized in `packages/ai/src/model-governance.ts`.
  `qwen-vl-ocr` is treated as a rolling alias (`pinned=false`), omits both
  provider `response_format` and `enable_thinking`, and continues application
  JSON parsing, normalization, Zod validation and quality gates. Supported
  Qwen multimodal models retain provider JSON mode.
- Singapore low-context estimates are now versioned as
  `estimate-2026-09-sg-low-context` for the fast/multimodal/OCR/reasoning tiers;
  judge remains an explicitly documented planning estimate. Cost telemetry is
  still estimated and reconstructable from model, token counts, cache counts and
  pricing version.
- Vision payloads are rejected before provider inference using decoded base64/data
  URL byte estimates. Defaults are 5 MiB for `AI_MAX_IMAGE_BYTES` and
  `AI_MAX_OCR_IMAGE_BYTES`, bounded to 64 KiB-20 MiB; remote URLs remain unknown
  at this layer and rely on upstream storage/upload limits.
- Shadow canary remains `AI_SHADOW_CANARY_PERCENT=0` by default. When enabled,
  it reserves call/token budget and is scheduled only through the optional
  `backgroundExecutor` (`ExecutionContext.waitUntil` in HTTP routes); queue and
  other hosts without an executor skip shadow safely. Scheduler invocation
  failures are isolated so the primary response remains successful.
- Focused regression command: **134 tests / 8 files PASS**. Full `pnpm check`:
  **1,623 tests / 95 files PASS**, lint/typecheck/migration replay/build PASS.
  `pnpm ai:eval -- --dry-run` and `git diff --check` PASS. `pnpm audit --prod`
  remains FAIL with the two pre-existing moderate React Router advisories
  (patched upstream at `>=7.18.0`); no dependency upgrade was made.
- No live Qwen benchmark, production deploy, remote migration, secret change,
  merge, or PayOS/payment change was performed. T08-T12 Inventory Truth work
  remains pending U01/U02 and is not imported here.
- Branch publication target remains `feat/qwen-ai-runtime-cost-router`; verify
  the final commit SHA with `git ls-remote` after the normal push. Next action:
  code review, then a separately authorized benchmark/release decision.
Record the new post-merge main SHA in the final operator receipt; the
pre-cleanup main head is `41d2de6bc76331322cc63e8038432b0b02f60da1`.

## SAFE STOP — T13R-B — 2026-09-13T21:35Z

Branch `hoplite/medma-164548ce`, WIP `7e68e3b` (P2-1 `4d587eb` below it).
T13R-B truthful presentation + conflict remediation code/tests complete and
green on executed checks (typecheck, t13r-b-presentation 12/12, full
Playwright 51 passed); certification and freeze not started. Details:
`docs/ai/inventory-truth/t13/T13R_B_REMEDIATION.md`.
## Canonical promotion CLI checkpoint (2026-09-15)

- GitHub CLI identity: `Tungjpstore`; target `vn-dlo/Frigo-dev` (repository ID
  `1368281478`) is reachable with push access, but the account has no admin or
  maintain permission.
- PR #1 remains open from `canonical/5f6853d-promotion`. The promotion head was
  advanced by one empty commit, `ae1689c1f5525262da3478137b402692e4e4ed45`,
  solely to retrigger pull-request validation; its tree is unchanged.
- Exact hosted CI is still absent: no workflow run, check run, or status exists
  for the promotion head. Manual dispatch was rejected by GitHub with HTTP 422:
  `Actions has been disabled for this user`.
- No merge, deployment, remote migration, production KV/R2/D1 mutation, or
  payment/PayOS change was performed. Promotion remains blocked pending hosted
  CI and maintainer/admin authorization.
- Repository-owner authentication is now active in `gh` as `vn-dlo`, with
  admin/maintain access. `main` protection was enabled: PR required, one
  approving review, `validate` status required, force-push and deletion blocked.
- Promotion head is now `6ec7ff08ef258ef2ca95fb5d24b581b939ef1c92` after a
  second empty, tree-neutral CI trigger commit. Hosted CI still has no run.
- A clean owner-visible PR #2 is now at
  `8eb6d2b8d54e5e2fd08c0a11acd9f57a1e068b24`; exact hosted CI run
  `34968012294` passed validate, lint, typecheck, Vitest, migration smoke, and
  build. The PR remains blocked only by the required independent approval.
