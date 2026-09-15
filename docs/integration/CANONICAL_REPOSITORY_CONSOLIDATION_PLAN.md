# Canonical repository consolidation plan

Date: 2026-09-15
Status: **PLAN ONLY - NO PUSH, PR, MAIN MERGE OR DEPLOYMENT AUTHORIZED**

## 1. Decision and current verdict

`vn-dlo/Frigo-dev` (repository ID `1368281478`) is the selected long-term
canonical repository for Frigo/Takosan. Consolidation must preserve the existing
integration Git graph; it must not re-integrate production, replay T08-T13,
rewrite history, copy trees, squash, rebase or alter migrations.

The promotion source in the earlier proposal is superseded by verified local
history:

| Role | Verified SHA | Treatment |
| --- | --- | --- |
| Historical integration candidate | `e34ed16777166407acf67b2c76d733d89c7d64ca` | Failed later independent review; never promote as the final application freeze |
| Pre-remediation docs head | `231d1e76e0320133e047624eea2be546ff779bd6` | Two docs-only commits after `e34ed167`; also superseded |
| Canonical application freeze | `5f6853d0ed11415871dca0fd31d4981d60518310` | Required application remediation; this is the application tree to certify |
| Current integration docs head | `f26003b6bd9f32f8cddda4119d0ced2f532c9017` | One docs-only commit after `5f6853d`; promotion branch must start here unless a later verified docs-only head replaces it |

Promoting `231d1e76` would omit `5f6853d`, including Qwen error preservation,
the real Qwen-to-queue integration regression, and restoration of protected
payment UI. That older head is therefore not an acceptable promotion target.

Canonical repository consolidation is not production release certification.
The rolling schema/code incompatibility at canonical migration `0032` remains a
separate production blocker documented in `SAFE_PRODUCTION_MERGER_PLAN.md`.

## 2. Verified repository identity and access

| Item | Verified value |
| --- | --- |
| Canonical repository | `vn-dlo/Frigo-dev` |
| Repository ID | `1368281478` |
| Default branch | `main` |
| Current remote `main` | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| Current GitHub login | `Tungjpstore` |
| Current permission | `WRITE` (`push=true`, `admin=false`, `maintain=false`) |
| Merge methods | Merge commit, squash and rebase are enabled at repository level |
| Rulesets | None returned |
| Branch protection | No protected-branch document returned; current account is not admin |
| Existing explicit remote | `frigo-dev=https://github.com/vn-dlo/Frigo-dev.git` |
| Unsafe local remote | `origin=https://github.com/Tungjpstore/yaji.git` |

Current access is sufficient for read-only verification, branch publication and
opening a PR. It is not sufficient to configure branch protection. An admin
login for `vn-dlo` (or another repository admin) is required before configuring
protection or authorizing a protected main merge. Do not request that login for
planning, local certification, branch push or PR creation.

## 3. Frozen source authorities

| Source | Full SHA | Required relationship |
| --- | --- | --- |
| Historical Frigo-dev main/common base | `d1b06732f8a80db4e77986df31ff28d9f04641fa` | Ancestor of canonical application/docs heads |
| Legacy production main | `05423f2ad675006a4c7913e696f1979b3fcaae59` | Ancestor of canonical application/docs heads |
| T13 certified application | `32ddbb4f2bb636fdcf201e9ca99c4689d3655477` | Ancestor of canonical application/docs heads |
| T13 independent review | `9c3c3d3b842685f1b8ad82746621f4f5c41962f1` | Review evidence; not required as application ancestry |
| Takosan hardened application | `ff63edfbde2857769d466b232d96b432c67f02d2` | Ancestor of canonical application/docs heads |
| Qwen hardening | `f8468eaa7d7fed3cbcf5ac7e780eca07ad3d71e4` | Ancestor of canonical application/docs heads |
| Qwen scheduler regression | `a145ef5e2f9cc8b8a06fb0ddc92d9edba0406aeb` | Ancestor of canonical application/docs heads |
| Qwen final source head | `da41686bb8613af9d0a487496d72479d04cb0d70` | Ancestor of canonical application/docs heads |
| Canonical application freeze | `5f6853d0ed11415871dca0fd31d4981d60518310` | Application certification target |
| Current integration docs head | `f26003b6bd9f32f8cddda4119d0ced2f532c9017` | Initial promotion pointer |

Every object above is present locally as a commit. Network access to the legacy
production repository is optional if these objects and their ancestry remain
verifiable in the local object database.

Expected graph:

```text
d1b06732
  |\
  | +-- production 05423f2 -- Qwen da41686 --+
  |                                             |
  +-- T08..T13 32ddbb4 -- Takosan ff63edf -----+-- e34ed167
                                                        |
                                                   docs 231d1e76
                                                        |
                                              remediation 5f6853d
                                                        |
                                                   docs f26003b
```

## 3A. Independent strengths, weaknesses and merge decisions

This matrix is the decision record for selecting the best combined version. It
separates capabilities already present in production from capabilities that
exist only on the certified Frigo-dev lineage, so no upgrade is either silently
dropped or applied twice.

| Area | `Tungjpstore/Frigo` production main | `vn-dlo/Frigo-dev` certified lineage | Canonical decision |
| --- | --- | --- | --- |
| Runtime baseline | Proven deployed baseline with cookie sessions, CSRF, household guards, rate limits, queue leases/fencing, request fingerprinting, quota/idempotency, R2 handling, health/readiness and cleanup | Contains the same production lineage through the integration merge, plus T08-T13/Qwen/Takosan changes | Preserve production behavior as the compatibility baseline; retain the integrated lineage only where its source and tests prove the extension |
| AI/Qwen | Production has the hardened scan pipeline and operational recovery, but final governed task runtime `da41686` is not in `main` | Adds governed Qwen task runtime, typed errors, model governance, serialization/parsing hardening and scheduler regression coverage | Keep Qwen from `da41686`; do not reapply older production Qwen/frontend tips already represented in `main` |
| Scan truth | Legacy scan rows and confirmation path; confidence is not yet a nullable raw-evidence authority | T13 retains raw OCR fields, exact nullable confidence, rejection/review state, reviewed expiry and sync/async evidence parity | Make T13 evidence the truth layer, with production queue/fingerprint/quota/R2 guarantees retained |
| Inventory writes | Multiple legacy `inventory_items` writers remain in inventory, recipes, scans and Week; safe for existing households but not a single authority | T09 provides adopted-stock commands, CAS/idempotency, FEFO, event authority and writer fencing; legacy paths remain explicitly compatibility-gated | T09 is the only adopted-household mutation authority; keep legacy writers only behind the existing non-adopted fence |
| Inventory reads | Existing production projections are stable but do not provide T11 canonical lot/read authority | T10 reconciliation and T11 canonical reads exist; meal-planner snapshot remains explicitly `SAFE_DEFERRED` | Use T11 for adopted households; do not enable meal-planner cutover until its reader is routed through T11 |
| Closed-loop behavior | Week/cooking compatibility and legacy dual-write are deployed and must not regress | T12 adds durable observation/reconciliation/replay behavior and atomic composition through T09 | Preserve Week compatibility while using T10/T12 for adopted-household truth; prove replay and rollback before release |
| Database history | Production owns immutable migrations `0001`-`0023`, including `0023_scan_request_fingerprint.sql` | Dev owns T08-T13 migrations originally numbered `0023`-`0032` | Keep production `0001`-`0023` byte-identical; map dev `0023`-`0032` byte-for-byte to canonical `0024`-`0033` |
| Migration risk | Has no T13 evidence/review schema and cannot receive the bridge safely with the old Worker | Canonical `0032`/`0033` add triggers/columns that the old Worker cannot satisfy and the new Worker assumes | Treat the bridge as repository history plus a release blocker until a pre/post-`0032` compatibility Worker passes a rolling rehearsal |
| Frontend/platform | Production `main` already contains the later adapted query/offline/loading/error, CSP, fail-closed config and deployment-traceability lineages | T13/Takosan add review UX, route ownership, PWA assets and visible brand; historical brand diff touched protected payment UI | Preserve production frontend/platform hardening; apply T13/Takosan UI only after protected payment paths are byte-checked against production |
| Payments | Deployed payment/billing/checkout/webhook behavior is the protected baseline | Earlier Takosan branding touched payment components; remediation `5f6853d` restores them byte-identically | Production payment files are immutable in this consolidation; brand tests must exclude them |
| Security/tenancy | Mature production cookie/session/CSRF/household and private-resource fences | T13 adds route/lot/receipt/observation ownership and cross-household tests; guest-transfer deferral is intentional | Keep both layers; fail closed on household mismatch and retain DEC-012 transfer behavior |
| Test evidence | Production has operational regression coverage and deployed-history evidence | Certified lineage adds T08-T13 D1/browser/replay/authority suites, Qwen integration and Takosan brand tests | Re-run exact candidate gates; historical counts are evidence, not current certification |
| Repository governance | Production is admin-accessible but is not the selected long-term repository | Frigo-dev is the required canonical repository but current account has `WRITE`, no demonstrated protection/rulesets | Promote only to explicit `canonical-frigo-dev`; require admin action for protection/no-deploy controls and withhold merge if unavailable |

### Confirmed gaps that remain after composition

These are not reasons to discard either repository; they are explicit follow-up
gates that prevent a false "best of both" claim:

1. **Rolling schema compatibility:** old production Worker writes only
   `is_confirmed`; canonical `0032` requires `review_state` agreement, while the
   integrated Worker selects T13 columns before they exist. A compatibility
   Worker and pre/post-`0032` rehearsal are mandatory before any remote bridge
   migration or production rollout.
2. **Legacy authority perimeter:** T13's audit classifies the meal-planner
   snapshot as `SAFE_DEFERRED`; it must not be treated as T11 authority until a
   later cutover task proves adopted-household reads use T11.
3. **Canonical branch governance:** `vn-dlo/Frigo-dev` currently lacks
   demonstrated branch protection and the current account is not admin. An
   admin must configure protection and deployment blocking, or the PR remains
   open and unmerged.
4. **Environment ledger shape:** a database with original dev `0023`-`0032`
   history must not receive the production-shaped `0024`-`0033` bridge in place;
   disposable dev databases are rebuilt and non-disposable mixed staging is
   reprovisioned rather than repaired by renaming ledger rows.

### What is deliberately not a merge candidate

- Superseded application candidate `e34ed167` and pre-remediation docs head
  `231d1e76`; both omit required remediation present in `5f6853d`.
- Historical production upgrade tips `fafe1cc`, `2052932` and `089c406` when
  their adapted behavior is already represented by later production commits.
- Any second copy of T08-T13, any mixed migration numbering chain, any bulk
  `ours/theirs` resolution, and any payment/UI "branding cleanup".

## 4. Absolute safety boundaries

Do not:

- force-push, rebase, squash or rewrite the integrated lineage;
- recreate the integration, replay production, cherry-pick T08-T13 again, or
  copy a repository tree over another;
- use `--allow-unrelated-histories`;
- change application, tests, package/lock files, Wrangler configuration,
  workflows or migrations as part of repository promotion;
- rename or edit an applied migration or D1 ledger row;
- push to `origin` or any remote selected only by name;
- deploy Worker/Pages, apply remote D1 migrations, mutate D1/KV/R2/queues,
  modify PayOS/secrets/DNS, rename/archive repositories or start T14;
- merge canonical `main` without the explicit merge gate in this plan.

The old production repository and all historical branches remain intact until a
separate retirement task is approved.

## 5. Phase A - clean local preflight

Execution must start in a clean worktree or a new clean worktree rooted at the
verified integration lineage. Existing uncommitted planning documents must be
checkpointed as documentation or isolated before promotion work; never hide or
discard them.

Record:

```text
LOCAL_REPOSITORY_ROOT
LOCAL_BRANCH
LOCAL_HEAD
LOCAL_WORKTREE_STATUS
```

Run read-only checks for repository root, branch, HEAD, status, remotes, refs
and the recent all-branch graph. Verify every source object with `git cat-file`
and require type `commit`. Never commit `.hoplite/settings.json`.

Stop with `REQUIRED_INTEGRATION_OBJECT_MISSING` if any critical object is absent.

## 6. Phase B - resolve canonical target and advance guard

Resolve `https://github.com/vn-dlo/Frigo-dev` by repository ID, API metadata and
`git ls-remote`. Create or reuse a clearly named write remote:

```text
canonical-frigo-dev=https://github.com/vn-dlo/Frigo-dev.git
```

Do not rename or delete existing remotes during promotion. Every future fetch
or push must explicitly name `canonical-frigo-dev`.

Fetch branches and tags, then freeze:

```text
CANONICAL_REPO_ID=1368281478
CANONICAL_BASE=<current canonical main SHA>
```

Current verified `CANONICAL_BASE` is `d1b06732...`. If it changes, inspect every
new commit and path. Continue only when the new main is already an ancestor of
the selected promotion head. If it contains any unrepresented application,
config, migration, workflow or test change, stop with:

```text
CANONICAL MAIN ADVANCED
NEW RECONCILIATION REQUIRED
```

Do not merge, rebase or cherry-pick the new target changes automatically.

## 7. Phase C - independent ancestry certification

Create a machine-readable table for each frozen source showing whether it is an
ancestor of `5f6853d` and `f26003b`. Required application-source relationships
must all pass:

```text
d1b06732 -> 5f6853d -> f26003b
05423f2  -> 5f6853d -> f26003b
32ddbb4  -> 5f6853d -> f26003b
ff63edf  -> 5f6853d -> f26003b
f8468eaa -> 5f6853d -> f26003b
a145ef5e -> 5f6853d -> f26003b
da41686b -> 5f6853d -> f26003b
```

The T13 review commit `9c3c3d3` is independent documentation evidence and need
not be an ancestor of the application merge. Its review target and verdict must
be validated from its content instead.

Any missing required ancestry stops promotion. Do not rebuild the graph.

## 8. Phase D - certify the application freeze

Reconfirm these ranges independently:

| Range | Verified current result | Required use |
| --- | --- | --- |
| `e34ed167..231d1e76` | Two commits; docs-only paths | Historical evidence only |
| `231d1e76..5f6853d` | One application remediation commit; 8 files in `packages`, `src` and `tests` | Mandatory application delta |
| `5f6853d..f26003b` | One commit; docs-only paths | Valid promotion documentation head |

The application freeze is `5f6853d`, not `e34ed167`. The promotion pointer is
`f26003b`, not `231d1e76`.

Required checks:

- all paths after `5f6853d` are documentation-only;
- `src/web/components/payment/*` and
  `src/web/pages/PlusPaywallPage.tsx` at `5f6853d` are byte-identical to legacy
  production `05423f2`;
- no application/config/migration/test change is introduced by canonicalization
  documentation;
- `APPLICATION_MODIFICATIONS_DURING_PROMOTION=0`.

If a later docs head contains a non-doc path, stop with
`APPLICATION FREEZE INVALID`.

## 9. Phase E - migration and release-blocker certification

Compare every production migration at `05423f2` byte-for-byte with `5f6853d`.
Require `PRE_EXISTING_PRODUCTION_MIGRATIONS_CHANGED=0`, including production
`0023_scan_request_fingerprint.sql`.

Rebuild the bridge table from T13 source `0023`-`0032` to canonical
`0024`-`0033`. Require:

```text
BRIDGE_CONTENT_MATCH=10/10
MIGRATION_COUNT=33
UNIQUE_MIGRATION_NUMBERS=33
MIGRATION_RANGE=0001..0033
```

Canonical promotion does not apply these migrations anywhere. Preserve the
known production-release blocker in all handoff documentation:

- old production Worker fails confirmation after canonical `0032`;
- integrated Worker queries T13 columns before `0032`;
- a compatibility Worker and rolling rehearsal are required before deployment.

Repository promotion may complete while production deployment remains blocked.

## 10. Phase F - authority, Qwen, security and brand review

Re-run the existing inventory writer/reader audit at `5f6853d`. Inspect T09/T11
database/domain/Worker authority files and require:

```text
T09_MUTATION_AUTHORITY=PASS
T11_CANONICAL_READ_AUTHORITY=PASS
UNKNOWN_INVENTORY_WRITERS=0
UNKNOWN_CANONICAL_READERS=0
PARALLEL_QUEUE_STOCK_WRITER=NO
```

Inspect Qwen runtime, provider, typed errors, model governance, quality gate,
quota, fingerprint, queue, R2 and readiness behavior. Behavioral integration
tests, not byte equality, govern the intentionally composed scan route/queue.
Missing, `0`, `0.11` and `0.9` confidence must remain exact evidence.

Recheck household/receipt/lot/queue/R2 tenancy, private-session fencing,
cross-household isolation and secret scanning.

Verify Takosan visible identity, assets, PWA/service-worker references, tokens,
icons and generator. Keep technical compatibility identifiers such as
`@frigo/*`, database names, storage keys, migration names and headers unchanged.

## 11. Phase G - create the history-preserving promotion pointers

Before any branch write, re-fetch and rerun the target-main advance guard.

Create the promotion branch directly at the verified docs head:

```text
canonical/5f6853d-promotion -> f26003b6bd9f32f8cddda4119d0ced2f532c9017
```

Do not create it from canonical `main` and do not merge the integration into a
fresh branch. The branch creation itself must add zero commits and preserve all
parents.

Before a main merge, create a non-forced rollback pointer only if absent:

```text
archive/pre-canonical-consolidation -> CANONICAL_BASE
```

If that archive branch already exists at a different SHA, stop and request a
new explicitly approved archive name. Never move it with force.

## 12. Phase H - canonicalization documentation

On the promotion branch, add only repository-authority documentation. Create:

```text
docs/integration/CANONICAL_REPOSITORY_MIGRATION.md
```

Update the integration/AI state and handoff plus `PROJECT_STATUS.md` as needed.
Record old development main, legacy production source, T13/Takosan/Qwen sources,
`5f6853d` application freeze, `f26003b` prior docs head, target repository ID,
promotion branch, no-history-rewrite proof and the unresolved `0032` production
rollout blocker.

Commit only those documentation paths and record `CANONICAL_DOCS_HEAD`. Require:

```text
git diff --name-only 5f6853d..CANONICAL_DOCS_HEAD
```

to contain only approved documentation. No workflow/config change is allowed in
this docs commit.

## 13. Phase I - exact-candidate validation

Test the application at exact `5f6853d` in a clean worktree. Do not test only a
docs head and infer the result.

Run repository gates and focused suites for Qwen/runtime, Qwen-to-queue-to-T13,
migration bridge, T08-T13, Takosan, tenancy/security, real local D1 and browser.
Historical counts are evidence only and must be remeasured.

Migration certification must cover fresh `0001`-`0033`, production-shaped
`0001`-`0023` plus bridge, populated legacy/Inventory Truth upgrade, replay,
foreign keys and integrity. It must also retain the two negative rolling probes
as known production blockers rather than incorrectly expecting either unsafe
order to pass.

Browser tests run last and serially. Record exact commands, versions, counts,
failures and environment limitations.

## 14. Phase J - publish branch and open PR

Push only explicit pointers to `canonical-frigo-dev`, without force:

```text
archive/pre-canonical-consolidation
canonical/5f6853d-promotion
```

Fetch immediately and require local/remote SHA equality. Open a PR:

```text
base: main
head: canonical/5f6853d-promotion
title: Promote certified Frigo/Takosan integration to canonical main
```

The PR must identify `5f6853d` as application freeze and `f26003b` as the prior
docs head; it must explicitly mark `e34ed167`/`231d1e76` as superseded. Include
all source SHAs, migration hashes, authority audits, test results and the
statement that no production deployment occurred.

Never select squash or rebase merge. The allowed final strategy is a merge
commit, or a true fast-forward performed under an explicitly reviewed process.

## 15. Hosted CI, protection and no-deployment gate

Require hosted CI for the exact PR head. Local results do not substitute for
hosted checks.

The canonical repository currently has active `CI` and `Deploy` workflows. The
Deploy workflow listens to successful CI on `main` and would enter its staging
job. At the verified heads, `wrangler.staging.jsonc` is absent, so the workflow
would currently record staging as unconfigured and skip deployment. This state
must be reverified immediately before merge; it is not a permanent safety
guarantee.

For an absolute no-deployment merge, a repository admin must temporarily disable
the Deploy workflow or establish an equivalent repository-level block, then
verify no deployment job can run from the merge. The current `Tungjpstore`
login lacks admin permission, so this is the point where `vn-dlo`/admin login or
manual admin action is required.

The current repository has no returned ruleset and main is not demonstrably
protected. Before merge, an admin should configure at least:

- block force pushes and branch deletion;
- require PR review;
- require exact-head CI/status checks;
- disallow squash/rebase for this promotion, or enforce merge-commit selection;
- prevent deployment workflow execution for this repository-only operation.

If admin action is unavailable, leave the certified PR open and report
`MAIN PROTECTION REQUIRES MANUAL ADMIN ACTION`. Do not merge.

## 16. Merge authorization gate

Default scope is prepare, verify, publish, open PR and observe CI. Main merge is
not authorized merely by this plan.

Merge only when all checks pass, the target main has not advanced incompatibly,
branch protection/no-deployment controls are active, and the maintainer gives
explicit merge authorization. After a merge commit, fetch canonical main and
prove every frozen source plus `5f6853d` remains reachable. Verify the merge tree
equals the reviewed PR result.

No Cloudflare deployment, remote migration, production resource mutation,
PayOS/DNS/secret change or T14 work follows the repository merge.

## 17. Stop rules

Stop without mutation when any of these occurs:

- repository ID is not `1368281478`;
- target main contains unrepresented changes;
- required source ancestry is missing;
- a post-`5f6853d` non-doc change appears;
- production migration or bridge blob mismatches;
- unknown inventory writer/reader, tenancy regression or payment diff appears;
- exact-head local/hosted validation fails;
- promotion/archive remote branch already exists at an unexpected SHA;
- branch protection or no-deployment control requires unavailable admin access.

Leave a docs-only handoff with exact completed, failed and unrun checks. Never
claim canonical certification based on historical test counts.

## 18. Completion criteria

The canonical consolidation candidate is ready for maintainer merge only when:

1. target repo ID/access/main are reverified and target main is reconciled;
2. every frozen source is proven reachable from `5f6853d` and the promotion head;
3. application modifications after `5f6853d` equal zero;
4. production migrations are unchanged and bridge matches `10/10`;
5. T09/T11, Qwen/queue/T13, tenancy/security and Takosan checks pass;
6. exact `5f6853d` local, D1 and browser gates pass;
7. promotion/archive pointers match locally and remotely;
8. exact PR-head hosted CI passes;
9. main protection and no-deployment controls are confirmed by an admin;
10. the PR clearly states canonicalization does not authorize production rollout.

Future T14+ work may branch from canonical main only after the authorized
history-preserving merge is complete. The legacy production repository remains
read-only historical evidence until separately retired.
