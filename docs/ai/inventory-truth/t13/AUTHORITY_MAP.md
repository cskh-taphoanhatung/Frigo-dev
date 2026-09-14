# T13 authority map — certified writer and reader audit

**T13 REMEDIATION CERTIFIED — READY FOR INDEPENDENT FINAL REVIEW #2.** Audited
application freeze: **`32ddbb4f2bb636fdcf201e9ca99c4689d3655477`** (T13R, 2026-09-14);
the rejected freeze `7b7bb695ee597a46cf4022a2c534e2fea374be5d` is the comparison
baseline. **Writer UNKNOWN=0; reader UNKNOWN=0.** These are classification
results, not a claim that the repository contains no legacy SQL or deferred
projection reader. The existing [T12 authority map](../t12/FINAL_AUTHORITY_MAP.md)
remains the baseline; T13 does not remove its compatibility or cutover conditions.

### T13R re-audit at the exact freeze

Run in the clean detached worktree at `32ddbb4` against `fc0f9c5` (T13R-A
checkpoint) and `7b7bb69` (rejected freeze):

- Writer statement set (`INSERT INTO|UPDATE|DELETE FROM inventory_lots|inventory_items|inventory_events`
  over `packages src scripts`): `src/` + `packages/` statements **identical** to
  both baselines (line numbers only shift). The only delta is two synthetic seed
  `INSERT INTO inventory_items` rows in `scripts/planner-preview-fixtures.mjs`
  (`preview-stock-cheese` with a recorded `opened_at`, `preview-stock-spinach` with
  an ESTIMATED expiry) — preview bootstrap for the T13R-B browser cases, classified
  with the existing fixture row as synthetic local bootstrap, not a deployed writer.
- Reader call set (`readInventoryAuthorityMode|runLegacyInventoryBatch|fetchHouseholdInventoryFromDb|MEAL_PLANNER_ENABLED|readInventoryLot|readInventorySummary|loadMealPlanningSnapshot`
  over `packages src scripts wrangler.jsonc`): **identical** to both baselines (69
  lines).
- T13R-A/T13R-B touched no inventory writer and no T11 reader: P1-1/P2-A write
  `scan_items.ocr_*` evidence columns only; P1-2 changes which `ingredient_id`
  value the existing PATCH adapter passes (identity preserved), not the statement;
  P1-3/P1-4/P2-4/P2-5/P2-6 are frontend presentation/ownership; P2-1 is the AI
  provider parser. **T09 mutation authority and T11 canonical read authority are
  preserved.** The `SAFE_DEFERRED` meal-planner condition below is unchanged.

## Writer classifications

| Path / source | Classification and boundary | Permanent proof |
| --- | --- | --- |
| `packages/db/src/inventory-lot-commands.ts` | T09 adopted stock authority: versioned/idempotent commands, lots, events and same-batch compatibility projection | T09 command/event/parity/fence/concurrency suites; real local D1 |
| `src/worker/routes/scans.ts` → `confirmAdoptedScan()` | Adapter, not a second stock writer. Receipt lines compose separate `CREATE` lots; fridge matches retain existing grouped `CORRECT` behavior | `t13-receipt-vision-truth.test.ts`: manual 3 + receipt 2, receipt A/B, grouped fridge corrections, replay/rollback |
| `packages/db/src/inventory-observations.ts` → `guardedObservationInsertStatement()` | T10 evidence-only insert, sharing scan confirmation's READY predicate and batch | T13 observation/event/final-status rollback tests; real D1 atomicity |
| `scan_items` / `scans` writes in scan routes | Scan draft, retained OCR and explicit review lifecycle; evidence, not stock | Raw/review retention, reject and confirmed replay tests |
| `src/worker/routes/inventory.ts` and `src/worker/utils/inventory-authority.ts` | Existing adopted PATCH adapter → T09 `CORRECT` / `MOVE`. U7 supplies dirty name/unit/category/storage/expiry fields; conversion stays backend-owned | `t13b-inventory-detail.test.tsx`; PATCH parity suites; browser F/G/U7 |
| `src/worker/routes/inventory-truth.ts` → T10 decision services | Re-derive authorized proposals; `confirmReconciliationDecision()` composes T09 commands, not route-owned stock SQL | T10 composition/fence suites; browser accept/dismiss |
| `scripts/inventory-adopt.mjs` → existing adoption endpoint | Explicit operator adapter to certified adoption/bootstrap, not a new inventory ledger or bypass | Actual executable integration suite (26 cases); browser I |
| Existing legacy inventory/scan/cook/Week writers | `LEGACY_COMPATIBILITY`: reachable only for non-adopted households; `runLegacyInventoryBatch` fences native authority | T09 writer-fence and T12 closed-loop regressions |
| Existing backfill/adoption SQL | Controlled T08/T09 migration/bootstrap authority, not ongoing competing native mutation | T08 populated/fresh replay, T09 adoption and real D1 |
| `scripts/{planner,t13}-preview-fixtures.mjs`, query-plan fixtures | Synthetic local fixture/bootstrap only; not deployed production writers | Preview fixture origin/production-404 tests; browser reset/isolation |

The previous statement “T13 adds exactly one SQL write statement” was not a valid
whole-scope audit: it confused one observation helper with all draft/review,
fixture and compatibility writes. The invariant is **one adopted mutation
authority (T09)**, not a textual count of SQL statements.

### Atomic evidence and stock

Reviewed rows, T10 observations, T09 command/effects/events and completion-last
scan status commit in one guarded D1 batch. An injected failure in any stage
rolls back all stages. Rejected lines keep raw/review evidence but contribute no
stock command or stock observation. No standalone observation becomes stock.

`scanEvidence` is validated command intent retained in the command fingerprint
and the existing event metadata fingerprint; no second ledger or top-level event
schema extension is introduced. Same-key changed evidence conflicts. Distinct
receipt purchases stay distinct lots; manual 3 plus receipt 2 reads as total 5
without rewriting the original lot.

T13R-A (0032): `scan_items.ocr_canonical_id/ocr_category/ocr_storage` retain the
ingested mapping and `reviewed_expiry_date/reviewed_expiry_kind` retain the
reviewer's accepted expiry per line. These are **evidence columns only**, read by
`src/worker/utils/scan-evidence.ts` → `scanItemDto()`; no inventory writer or T11
reader consults them, so no evidence column becomes stock authority. The async
queue writes the same evidence as the synchronous route.

## Reader classifications

| Consumer / route | Classification and boundary | Permanent proof |
| --- | --- | --- |
| `GET /inventory`, scan candidate/replay reads and existing recipe/Week funnels | `READ_AUTHORITY` for adopted households through `fetchHouseholdInventoryFromDb` / T11; no native empty-result legacy fallback | T11/T12 strict read, cache bypass and closed-loop tests |
| `GET /inventory/lots/:lotId` | T11 `readInventoryLot`, household-bound lot truth | T13 route tenancy/detail tests; browser A/B/F/U7 |
| `GET /inventory/summary` | T11 `readInventorySummary`, canonical aggregate truth | T13 summary integration; manual 3 + receipt 2 total 5 |
| `GET /inventory/observations` | T10 `readInventoryObservations` + `planInventoryReconciliationForHousehold`, evidence/verdict/proposals | T13 decision route and real D1 tests; browser reconciliation |
| `POST /inventory/observations/:id/decision` | T10 server revalidation of version/intent/proposal; frontend does not confer authority | T10 fences and T13 stale/ID-bound/replay tests |
| `IngredientDetailPage`, receipt/fridge review, reconciliation UI | Present T11 lot truth or retained T10/scan evidence as such; no client projection becomes adopted authority | T13B DOM→real route tests, detail/hardening units, 36 browser cases |
| Non-adopted legacy funnel and matching/preflight reads | `LEGACY_COMPATIBILITY`, explicit `readInventoryAuthorityMode` / writer fencing; legacy KV behavior preserved | T09/T11/T12 compatibility and adoption suites |
| `packages/db/src/meal-planning-snapshot.ts` → `loadMealPlanningSnapshot()` | **`SAFE_DEFERRED`**, not canonical T11 authority; details below | Retained T12 audit and production flag boundary |

### Meal-planner cutover remains deferred

`loadMealPlanningSnapshot()` still reads `inventory_items` for planner ranking and
shopping suggestions without an adoption gate. If enabled, adopted households
could reach that projection reader. It is read-only and normally sees the T09
same-batch mirror, but is **not drift-immune canonical authority**.

Production `MEAL_PLANNER_ENABLED` remains unbound/off; disabled routes return
`MEAL_PLANNER_DISABLED`. Synthetic preview enabling is not a production cutover.
Before enabling for adopted households, **`MEAL_PLANNER_AUTHORITY_CUTOVER`** must
route inventory reads through T11 (or an equivalent canonical adapter), keeping
projection reads only for non-adopted households behind the authority-mode gate.
T13 COMPLETE does not remove this `SAFE_DEFERRED` condition or authorize the flag.

## Tenancy, errors and replay

New truth routes are protected by `tenancyGuard` and server-owned household scope.
Foreign lot/observation identities do not disclose existence; cross-household
access is indistinguishable from absence. Existing CSRF/rate-limit behavior is
preserved. Operator adoption verifies the requested household and session owner;
it does not weaken authentication or retry mutations automatically.

Real scan IDs are 64-character digests. `scanCommandKey()` (200-character command
key), `scanObservationSourceRef()` (200-character source ref) and
`boundedDecisionKey()` (160-character decision key) preserve deterministic identity
without truncation collisions. Observation IDs include the household/type prefix
and can exceed 200 characters; route validation follows `observationIdentity()`.

## Audit reproduction and evidence

The detached source audit and its classification were recorded at the exact
freeze, not inferred from an empty working-tree diff. Inspect candidates with:

```sh
FREEZE=32ddbb4f2bb636fdcf201e9ca99c4689d3655477   # T13R; 7b7bb69… is the rejected baseline
git grep -n -E '(INSERT INTO|UPDATE|DELETE FROM) +(inventory_lots|inventory_items|inventory_events)' \
  "$FREEZE" -- packages src scripts
git grep -n 'inventory_items' "$FREEZE" -- packages src scripts
git grep -n -E 'readInventoryAuthorityMode|runLegacyInventoryBatch|fetchHouseholdInventoryFromDb|MEAL_PLANNER_ENABLED|readInventoryLot|readInventorySummary|loadMealPlanningSnapshot' \
  "$FREEZE" -- packages src scripts wrangler.jsonc
```

These searches enumerate candidates; review their callers and gates against the
classifications above. Preview/bootstrap/legacy paths are not “unknown” merely
because they contain stock SQL. T13R gates and evidence locations are in
[T13R_FINAL_CERTIFICATION.md](T13R_FINAL_CERTIFICATION.md); the historical `7b7bb69`
audit is in [T13B_FINAL_HARDENING.md](T13B_FINAL_HARDENING.md). No remote D1, production
credentials, PayOS, main merge or deployment was used for certification.
