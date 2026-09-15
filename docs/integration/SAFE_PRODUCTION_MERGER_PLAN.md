# Production + Frigo-dev merger plan (evidence-based)

Date: 2026-09-15
Status: **PLAN ONLY — NOT READY TO MERGE OR DEPLOY**

This document replaces the earlier narrow candidate plan. It covers the
current production line, the production Qwen/runtime work, every certified
Frigo-dev T08-T13 application change, Takosan, and the production frontend and
platform upgrades. It is deliberately a rollout plan, not a merge authorization.

## 1. Verified repository and access state

| Item | Verified value |
| --- | --- |
| Production repository | `Tungjpstore/Frigo` (ID `1360256196`) |
| Production permission | GitHub account `Tungjpstore`: `ADMIN` |
| Production default head | `05423f2ad675006a4c7913e696f1979b3fcaae59` |
| Development repository | `vn-dlo/Frigo-dev` (ID `1368281478`) |
| Development permission | GitHub account `Tungjpstore`: `WRITE` |
| Development default head | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| Merge controls | Both active; merge, squash and rebase enabled; no protection/ruleset reported |
| Local remote warning | `origin` is `Tungjpstore/yaji`; never use it for Frigo publication |

Access is sufficient for a controlled branch/PR workflow. It is not evidence
that a production release is safe. Frigo-dev `WRITE` access does not grant
administrative repository settings access; do not change its protection or
secrets as part of this work.

## 2. Source-of-truth commits and branch classification

### Production side

- Production base: `github-frigo/main` at `05423f2`.
- Qwen/runtime source: `github-frigo/feat/qwen-ai-runtime-cost-router` at
  `da41686`. It is 15 commits ahead of and is **not** an ancestor of production
  `main`; it is a required merge source, not functionality already present in
  the production branch. The current local integration candidate contains it,
  but production does not.
- The production frontend upgrade commit `fafe1cc` is **not** an independent
  delta to cherry-pick: its behavior was adapted by `d270cd4` and consolidated
  by `57c88c5`, both ancestors of production `main`.
- The platform hardening commits `2052932` and `089c406` are likewise not
  independent deltas: the equivalent published lineage is `3f33d11`, followed
  by later production hardening/auth/Qwen commits including `af661af` and
  `ec87aec`.
- Therefore the merger must preserve the current production `main` behavior
  and audit semantic differences; it must not cherry-pick `fafe1cc`, `2052932`
  or `089c406` on top of an already-hardened production base.

### Frigo-dev side

- Common ancestor with production: `d1b06732`.
- T13 certified application freeze: `32ddbb4`; independent review #2:
  `9c3c3d3` (P0/P1/blocking-P2 = 0/0/0, AC1-AC14 pass).
- Takosan hardened application source: `ff63edf`; brand docs source: `60ab7d4`.
- T08-T13 WIP/certification branches are historical or superseded. Use the
  final freeze/Takosan sources above, not a sequence of WIP cherry-picks.
- T11 and T12 add no migrations but do add the canonical read authority and
  closed-loop runtime behavior; they are mandatory application changes.

## 3. Complete upgrade inventory (nothing silently omitted)

| Source | Upgrade content that must be retained | Merge treatment |
| --- | --- | --- |
| Production main | Existing auth/session/CSRF/tenant guards, Week dual-write, inventory legacy commands, payments, OCR queue, release hardening | Immutable baseline; preserve unless a reviewed compatibility patch is required |
| Production post-common-base delta | OCR recovery `ec87aec`, scan fingerprint `0023`, provider/quality-gate recovery, quota/retry/reconciliation, health/cleanup/config and deploy/schema-gate changes, receipt/scan polling and error UX | Preserve all 17 commits/60 changed paths from `d1b06732..05423f2`; resolve the 14 T13-overlap paths semantically |
| Production Qwen candidate | Task runtime, Qwen provider/model governance, typed provider errors, quality gate, image normalization and scheduler hardening | Integrate from frozen `da41686` after the compatibility release; retain production scan fingerprint/quota/idempotency/R2/queue behavior during conflict resolution |
| Production frontend line | TanStack Query/server-state split, scoped query keys/offline projections, lazy routes, honest loading/error states, accessible dialogs, retry policy | Already represented in production lineage; verify each affected path after T13/Takosan merge |
| Production platform line | CSP, config fail-closed, health/readiness, cleanup cron, rate-limit degraded/fail-closed modes, CI/deploy traceability, staging template | Already represented in production lineage; keep current later hardening behavior; never commit `.hoplite/settings.json` |
| T08 | Storage locations, inventory lots, exact milli quantity/money/expiry/provenance, legacy backfill and parity diagnostics | Additive migration + domain/db modules; no automatic live cutover |
| T09 | CREATE/USE/DISCARD/OPEN/MOVE/CORRECT commands, CAS/idempotency, FEFO, event authority, adoption receipt, writer fencing | T09 remains the only stock mutation authority |
| T10 | Durable observations and reconciliation decisions, atomic proposal composition, claim/version fences | Compose through T09; no second stock writer |
| T11 | Canonical inventory read authority, adopted-household cutover, freshness/alias truth, fail-closed corruption handling | T11 remains the canonical read authority; legacy reads stay for non-adopted households |
| T12 | Closed-loop cooking/reconciliation runtime verification and response-loss replay semantics | Preserve Week compatibility and durable cooked-meal replay |
| T13/T13R | Receipt/fridge raw evidence, explicit rejection, nullable confidence, reviewed expiry/mapping evidence, route/session ownership, truthful UI | Preserve unknown values; no confidence/date fabrication; async and sync writers must agree |
| Takosan | Brand tokens/assets/PWA metadata and user-facing shell | Apply only to non-protected product surfaces; payment UI is production-owned |

## 4. Migration audit and collision resolution

### Findings

1. Production and Frigo-dev share byte-identical migrations `0001`-`0022`.
2. Production has one later migration: `0023_scan_request_fingerprint.sql`
   (Git blob `777f4b6f9af0ee4229f16d42e5983534b83628ec`).
3. Frigo-dev T08-T13 uses `0023`-`0032` for ten different migrations. The only
   numeric collision with production is intentional and confirmed:

   `production 0023 = scan request fingerprint`
   `dev 0023 = inventory truth foundation`
   blobs: `777f4b6f...` vs `1ec671af2b9d214e9d15e7921008a42873abb687`.

4. Production default `main` and the Qwen source end at production `0023`;
   Frigo-dev default `main` ends at shared `0022`; certified T13 ends at its
   original `0032`. The production remote also contains the already-published
   integration candidate with canonical `0024`-`0033`; that branch is audit
   evidence, not proof those migrations were applied to production.
5. Across **all fetched remote refs**, prefixes `0024`-`0032` have two filename
   variants because the existing integration branch shifted the certified dev
   chain by `+1`. Each shifted file has the same Git blob as its original dev
   source file. These are historical numbering aliases, not additional
   migrations or independent SQL conflicts. Never assemble a candidate by
   collecting migrations from mixed refs; select one source chain and enforce
   the mapping manifest below.
6. The current integration tree has 33 unique contiguous files and no duplicate
   numeric prefix. Its bridge mapping is:

| Canonical number | Source migration | Purpose | Source blob prefix |
| --- | --- | --- | --- |
| `0001`-`0023` | Production unchanged | Existing production schema, including scan fingerprint | production blobs; `0023`=`777f4b6f` |
| `0024` | dev `0023_inventory_truth_foundation.sql` | T08 locations/lots foundation | `1ec671af` |
| `0025` | dev `0024_inventory_lot_commands.sql` | T09 command/CAS/projection guards | `779cf2bd` |
| `0026` | dev `0025_inventory_event_authority.sql` | T09 event evidence authority | `e9204fff` |
| `0027` | dev `0026_inventory_event_poststate.sql` | T09 post-state proof | `b1cfb349` |
| `0028` | dev `0027_inventory_fefo_authority.sql` | T09 FEFO authority | `2d879eb8` |
| `0029` | dev `0028_inventory_adoption_authority.sql` | T09 explicit adoption receipt | `2f8b437f` |
| `0030` | dev `0029_inventory_fefo_backfill_compatibility.sql` | Backfill-safe FEFO guards | `27a78201` |
| `0031` | dev `0030_inventory_observation_reconciliation.sql` | T10 observations/decisions | `6e323d89` |
| `0032` | dev `0031_scan_evidence_retention.sql` | T13 raw evidence/review state | `c580d30b` |
| `0033` | dev `0032_scan_evidence_completeness.sql` | T13 raw mapping/reviewed expiry | `48f26f7c` |

The ten bridge files must be byte-copied from the certified source. Do not
rewrite an applied production migration, rename production `0023`, or edit
bridge SQL comments merely to make historical numbers look current. Keep the
source-to-canonical mapping in the manifest and tests.

### Existing database ledger treatment

- A production-shaped ledger must contain
  `0023_scan_request_fingerprint.sql`. It may receive canonical `0024`-`0033`
  after the compatibility release.
- A dev-shaped ledger containing `0023_inventory_truth_foundation.sql` (and
  possibly original dev `0024`-`0032`) is a different history. Never apply the
  canonical bridge on top of it, never rename ledger rows, and never mark the
  shifted files as applied manually.
- Disposable local/dev databases with the old dev numbering should be rebuilt
  from canonical `0001`-`0033`. A non-disposable environment with dev-shaped
  data requires a separate export/transform/import plan and explicit owner
  approval; it is not a candidate for in-place production promotion.
- Canonical staging must be fresh or production-shaped. If its ledger is
  dev-shaped or mixed, replace the staging database through the environment
  provisioning procedure before any release rehearsal; do not “repair” its
  ledger in place.

### Critical rollout compatibility finding

`0032_scan_evidence_retention.sql` (canonical bridge number) creates triggers
that require `review_state = 'CONFIRMED'` whenever legacy `is_confirmed = 1`.
The current production Worker confirmation SQL writes only `is_confirmed = 1`
(`github-frigo/main:src/worker/routes/scans.ts`, the pre-T13 path). Therefore:

- applying canonical `0032` while the old Worker can still receive traffic can
  abort every confirmation update;
- deploying the current T13 Worker before canonical `0032` exists can fail its
  unconditional `ocr_*`/review-state SELECTs;
- “apply all migrations, then deploy” is not a safe production sequence by
  itself.

The implementation phase must first ship a schema-capability compatibility
release that can run against pre-0032 and post-0032 schemas (conditional column
projection/update, or an equivalent separately reviewed compatibility layer).
Only after that release is serving all traffic may canonical `0032`/`0033` be
applied. This is a release blocker for the current candidate until proven by a
rolling-upgrade rehearsal.

## 5. Semantic conflict rules

No `ours/theirs` bulk resolution is permitted. Resolve by contract:

- **Scan/AI:** retain Qwen task runtime, typed errors, quality gate, quota,
  fingerprint, R2 reference and queue fencing; add T13 nullable raw evidence,
  review state, rejection and reviewed-expiry fields. Missing/zero/low
  confidence remains missing/zero/low; generic labels are rejected.
- **Inventory:** T09 is the only writer and T11 the only canonical reader for
  adopted households. T10 decisions call T09 in one atomic batch. Legacy
  `inventory_items`/Week paths remain compatible and are not silently cut over.
- **Frontend:** retain production cookie-session/private-cache/query isolation,
  offline outbox and Week behavior; layer Takosan presentation and T13 review
  flows without changing payment surfaces. Route identity/session guards must
  survive service-split changes.
- **Auth:** preserve cookie sessions, CSRF, tenancy and the certified
  `INVENTORY_TRANSFER_DEFERRED` behavior. Do not invent a guest-transfer write.
- **Platform:** preserve fail-closed production config, public health route,
  cleanup table names (`sessions_v2` after auth hardening), CSP and release
  traceability. `.hoplite/settings.json` is an overlay, never a product file.
- **Payments:** `src/web/components/payment/*`, billing, checkout and webhooks
  must have zero semantic/code change from production base. Brand tests must
  exclude protected payment files rather than force edits.

## 6. Execution sequence

### Phase 0 — Freeze and evidence

1. Re-fetch `github-frigo` and `frigo-dev`; record both default heads, exact
   source SHAs, merge-base and worktree status.
2. Generate a machine-readable migration manifest for every selected source and
   reject duplicate/gapped prefixes, filename/content mismatches and unknown
   later migrations.
3. Generate a path-and-commit manifest from production `d1b06732..05423f2`,
   Qwen `05423f2..da41686`, T13 `d1b06732..32ddbb4` and Takosan
   `32ddbb4..ff63edf`. Current verified sizes are respectively 17 commits/60
   paths, 15/45, 93/206 and 5/126. Classify every path as already-in-main,
   production-only, Qwen-only, T13-only, Takosan-only or semantic overlap; the
   manifest must finish with `UNCLASSIFIED_PATHS=0`.
4. Freeze the selected source commits. Any later source movement restarts this
   phase.

### Phase 1 — Independent compatibility release (required before schema bridge)

1. Create a dedicated compatibility branch from exact production head
   `05423f2` (or restart from a newly verified production head if it moves).
   This release must not include T08-T13, Takosan or the Qwen task-runtime
   rollout; its only purpose is to let the production Worker coexist with both
   schema shapes.
2. Add a narrowly scoped capability probe for T13 columns/triggers. It must
   preserve existing contracts on a pre-0032 database and use enriched columns
   only when present. Capability detection must fail closed and must not turn a
   transient D1 error into a false permanent schema result.
3. Ensure scan confirmation writes both `is_confirmed` and `review_state` when
   the column exists; retain the legacy statement when it does not.
4. Keep the compatibility release's GET/queue persistence on the production
   column set; only the confirmation writer is schema-aware. The implementation
   must handle a schema change between probe and batch with an atomic,
   bounded retry for the recognized missing-column/trigger mismatch only.
5. Prove existing queue messages, retries, response-loss replay, quota and
   fingerprint behavior under both schema shapes, including a migration racing
   one confirmation request without duplicate inventory/event effects.
6. Rehearse it in isolated staging, obtain exact-SHA review/hosted CI, merge it
   as a separate production PR, and deploy that exact compatibility SHA to
   production only with separate operator authorization. Verify rollout has
   converged and scan confirmation/queue health are stable. Do not apply bridge
   migrations until every serving Worker is on this compatibility lineage.

### Phase 2 — Build a staged release train, not one big-bang candidate

#### Train A — Qwen/runtime only

1. After Phase 1 is merged and deployed, fetch production again and freeze its
   head as `COMPAT_PRODUCTION_BASE`. Start from that commit, not from `05423f2`,
   current `f26003b` or a mutable branch name.
2. Integrate frozen Qwen source `da41686` semantically while preserving the
   compatibility writer. This train has no T08-T13 migration, no Takosan brand
   change and no payment change.
3. Resolve AI/provider, scan route/queue, image-normalization, configuration,
   `package.json` and lockfile overlaps. Do not cherry-pick superseded
   `fafe1cc`/`2052932`/`089c406`; preserve the newer production implementations.
4. Release and soak this train independently. Freeze the resulting production
   head as `QWEN_PRODUCTION_BASE` before beginning Train B.

#### Train B — Certified T08-T13 application and migration bridge

1. Start from exact `QWEN_PRODUCTION_BASE` and apply certified T13 source
   `32ddbb4` semantically. Resolve scan/queue, domain/db, frontend services,
   scripts, tests, `package.json`, lockfile and documentation by contract.
2. Add the ten bridge migrations as `0024`-`0033`, byte-for-byte from the
   certified source. Update migration smoke/schema-gate expectations and every
   hard-coded head assertion.
3. Preserve Qwen runtime, compatibility behavior, production frontend/platform
   hardening, auth/Week invariants and payment files. Release and soak this
   train before any Takosan presentation change.
4. Freeze the resulting production head as `T13_PRODUCTION_BASE`.

#### Train C — Takosan brand-only hardening

1. Start from exact `T13_PRODUCTION_BASE` and apply only the five-commit Takosan
   delta `32ddbb4..ff63edf` semantically.
2. Keep `src/web/components/payment/*`, billing, checkout and webhooks identical
   to `T13_PRODUCTION_BASE`; exclude those paths from brand enforcement.
3. Require `MIGRATION_DIFF=0`, `WORKER_BEHAVIOR_DIFF=0` except explicitly
   reviewed static asset/PWA serving changes, and no new environment variable.
4. Keep `.hoplite/settings.json` out of every train.

The intended production state sequence is:

| Stage | Serving code | D1 schema | Safe rollback target |
| --- | --- | --- | --- |
| Current | production `05423f2` | `0001`-`0023` | current production |
| Compatibility | compatibility SHA | `0001`-`0023` | `05423f2` |
| Train A | Qwen + compatibility SHA | `0001`-`0023` | compatibility SHA |
| Bridge window | Qwen + compatibility SHA | `0001`-`0033` | same Qwen + compatibility SHA |
| Train B | T08-T13 + Qwen + compatibility SHA | `0001`-`0033` | Qwen + compatibility SHA |
| Train C | Takosan + Train B | `0001`-`0033` | Train B SHA |

The current `f26003b` candidate is an implementation/test oracle only. Do not
use it as ancestry for these trains; carry forward its reviewed semantic fixes
through explicit patches and regressions on the new baselines.

### Phase 3 — Database and authority verification

Run all of the following locally before any remote operation:

- fresh `0001`-`0033` replay, FK/integrity/schema gate and ledger uniqueness;
- production-shaped `0001`-`0023` database with representative scans, queue
  jobs, Week rows, auth/session rows and payment rows, then `0024`-`0033`;
- populated legacy inventory upgrade and explicit T08 backfill, proving zero
  fabricated expiry/confidence/price evidence and byte-identical legacy rows;
- populated T09/T10 upgrade, replay and race cases (USE/USE, MOVE/MOVE,
  reconciliation/manual, FEFO and response loss) with no partial commits;
- pre-0032/post-0032 rolling compatibility rehearsal with old/new Worker
  request sequences and the 0032 confirmation trigger;
- migration hash audit: all production `0001`-`0023` unchanged, ten bridge
  blobs match source, no duplicate/gap/unknown migration;
- writer/reader audit: unknown inventory writers = 0, unknown canonical readers
  = 0; T09/T11 are the only authorities.

### Phase 4 — Application validation

Run, in this order, and record exact counts/failures:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm check:migrations
pnpm build
pnpm test
PORT=3100 PREVIEW_API_PORT=8877 pnpm test:browser
git diff --check
```

Focused suites must additionally cover Qwen provider/runtime, real queue
consumer persistence, scan confirmation/rejection, T13 raw evidence and expiry
reopen, T09/T10/T11/T12 authority, auth deferral, payment protection and
Takosan brand boundaries. Browser runs are serial at 360/390/430; no mocked
whole-module `@frigo/ai` test is accepted as integration evidence.

Configuration validation must cover production and staging without printing
secret values. Record binding names and non-secret variables, compare
`wrangler.jsonc`, the deployed configuration receipt and the frozen source, and
prove the new Qwen governance defaults/limits do not silently enable reasoning,
judge or shadow-canary traffic. Any required live variable or secret change is
a separate operator-approved release input, not an inferred merge side effect.

### Phase 5 — Controlled publication and release

Common rules for every train:

1. Publish only immutable candidate branches to the verified production
   repository remote; never `origin` and never force-push. Resolve the canonical
   repository by ID `1360256196`; do not trust a stale owner alias.
2. Obtain independent review and hosted CI for each exact candidate SHA. Rebase
   or source movement invalidates that review and restarts its train.
3. The current workflow automatically deploys staging after successful CI on a
   push to `main`; production requires a manual confirmed dispatch. A missing or
   unconfigured staging environment blocks production release.

Release Train A (Qwen):

4. Merge only after its staging rehearsal proves old schema `0001`-`0023`, the
   compatibility writer, queue processing and pinned Qwen configuration. Verify
   automatic staging exact-SHA receipt, then manually deploy the same SHA to
   production and soak it before Train B.
5. Keep `WEEK_SCHEMA_MODE=dual`, reasoning/judge/shadow canary disabled, and
   payment paths unchanged. Any Qwen alias/limit change must match the reviewed
   configuration receipt and explicit operator approval.

Release Train B (T08-T13):

6. In isolated resources, rehearse exact sequence: old schema +
   `QWEN_PRODUCTION_BASE`, bridge `0024`-`0033`, then Train B SHA. Exercise
   requests before/during/after transitions and prove rollback to
   `QWEN_PRODUCTION_BASE` after `0032`.
7. Before merging Train B, apply `0024`-`0033` from its exact checkout to the
   canonical staging D1 while staging still runs `QWEN_PRODUCTION_BASE`. Verify
   migration ledger, scan confirmation and queue health, then merge so automatic
   staging deployment cannot put T13 code on an old schema.
8. Verify automatic staging exact-SHA receipt and full smoke. For production,
   take a D1 backup/restore checkpoint and obtain migration-owner approval.
   Reverify serving-version convergence on `QWEN_PRODUCTION_BASE`, readiness,
   confirmation and queue health; then apply canonical `0024`-`0033`. Stop if
   ledger/schema differs from the frozen manifest.
9. Manually deploy the exact merged Train B SHA. Inspect scan queue/DLQ, auth
   errors, inventory conflicts, Week health and evidence integrity through the
   defined soak window. The production pipeline remains SELECT-only; migration
   application is a separate operator action with its own receipt.

Release Train C (Takosan):

10. Merge only after brand/accessibility/browser review proves zero payment,
    migration and unintended Worker behavior diff. Verify automatic staging,
    then manually deploy the exact SHA. Rollback target is `T13_PRODUCTION_BASE`.

## 7. Rollback and stop rules

- Code rollback is allowed only to a SHA proven compatible with the applied
  schema. Never roll back to a Worker that writes plaintext OTPs, ignores queue
  fencing, or writes `is_confirmed` without the canonical `0032` compatibility.
- Before bridge application, Train A may roll back to the compatibility SHA.
  After bridge application, Train B may roll back only to the Qwen production
  SHA that already contains compatibility; Train C may roll back to Train B.
- Do not down-migrate production. If a bridge migration is wrong, stop traffic
  changes, preserve the D1 checkpoint and use an approved restore/forward-fix.
- If the 0032 rolling rehearsal fails, stop before remote migration and keep
  production on the previous Worker/schema.
- If migration ledger names differ from the release manifest, stop; do not
  auto-apply or rename files.
- If any environment contains both source and shifted names for the same Git
  blob, classify it as a mixed ledger and stop. Do not delete ledger rows as a
  shortcut.
- If canonical staging has not reached `0033`, do not merge Train B because the
  `main` push would automatically deploy schema-dependent code to that staging.
- If any payment diff, unknown inventory writer/reader, FK failure, fabricated
  evidence, cross-household result, queue lease violation or hosted-CI mismatch
  appears, stop the merge/release and open a remediation task.

## 8. Acceptance criteria

Each train is ready for its production PR only when its applicable criteria are
true, and the full merger is complete only when all are true:

1. Source freeze, repository identity, access and ancestry are reverified.
2. Production `0001`-`0023` path/blob pairs are unchanged; bridge `0024`-`0033`
   matches the certified T08-T13 blobs exactly; no numbering collision remains.
3. The compatibility release passes the pre/post-0032 rolling rehearsal.
4. Train A descends from the exact deployed compatibility SHA; Train B descends
   from exact deployed Train A; Train C descends from exact deployed Train B.
5. T08-T13 behavior, Qwen runtime, production frontend/platform hardening,
   Takosan shell, auth/Week invariants and payment protection all have focused
   evidence and no omitted source path remains unexplained.
6. Fresh, populated-upgrade, replay, race, FK/integrity, static, full-test,
   browser, staging and hosted exact-SHA gates pass.
7. A migration ledger receipt, deployment readiness receipt, rollback SHA and
   operator runbook are recorded. No remote mutation occurs before explicit
   release authorization.

## 9. Reproducible audit evidence

Verified graph and migration facts:

- `git rev-list --left-right --count github-frigo/main...github-frigo/feat/qwen-ai-runtime-cost-router`
  returned `0 15`; `da41686` is not in production `main`.
- `git merge-base github-frigo/main frigo-dev/main` returned `d1b06732...`.
- Ancestry checks confirmed `d270cd4`, `57c88c5`, `3f33d11`, `af661af` and
  `ec87aec` are already in production `main`; `fafe1cc`, `2052932` and
  `089c406` are not ancestors and must not be replayed as independent upgrades.
- Diff inventories returned production post-base 17 commits/60 paths, Qwen
  15/45, T13 93/206 and Takosan 5/126. Production/T13 overlap is 14 paths,
  Qwen/T13 overlap 8 and Qwen/Takosan overlap 5; all require manifest entries.
- `git hash-object migrations/0024_*.sql` through `0033_*.sql` returned the
  same ten blobs as certified T13 source `32ddbb4:migrations/0023_*.sql`
  through `0032_*.sql`.
- A scan over every fetched `github-frigo/*` and `frigo-dev/*` ref found the
  only distinct selected-source collision at `0023`; apparent `0024`-`0032`
  variants are the same blobs under the integration `+1` mapping.

Direct SQLite probes against the repository migration files reproduced both
unsafe orders:

```text
old Worker after canonical 0032:
scan_items.review_state must agree with is_confirmed

integrated Worker before canonical 0032:
no such column: ocr_raw_name
```

Both probes exited `1`. These are confirmed release blockers, not inferred
risks. The implementation task must convert them into permanent pre/post-schema
regression tests before the compatibility PR can be approved.

## 10. Explicit non-goals

No PayOS/payment redesign, guest-transfer implementation, T14 work, automatic
remote migration, production resource mutation, repository permission changes,
historical migration rewrite, or broad cleanup of unrelated WIP branches.
