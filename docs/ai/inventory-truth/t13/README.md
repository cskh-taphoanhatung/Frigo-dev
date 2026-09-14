# T13 — Receipt/Vision truth & Inventory UX V2

**T13 REMEDIATION CERTIFIED — READY FOR INDEPENDENT FINAL REVIEW #2.** The first
freeze `7b7bb69` below was **rejected** by the independent review (4 P1, 6 blocking
P2). T13R-A (`fc0f9c5`) and T13R-B (`4d587eb`, `7e68e3b`) fixed every confirmed
blocker and the new exact application freeze
**`T13R_APPLICATION_FREEZE=32ddbb4f2bb636fdcf201e9ca99c4689d3655477`** passed the
full local pre-freeze and clean-detached gate set on 2026-09-14 (repository
`vn-blo/Frigo-dev`, ID 1368281478, branch `hoplite/delos-f0bb1d04`, main
`d1b06732…` unchanged). Current record:
[T13R_FINAL_CERTIFICATION.md](T13R_FINAL_CERTIFICATION.md); remediation detail:
[T13R_A_REMEDIATION.md](T13R_A_REMEDIATION.md), [T13R_B_REMEDIATION.md](T13R_B_REMEDIATION.md).
This is not independent review approval, a main merge, or a deployment. The
sections below describe the historical `7b7bb69` certification.

## Historical certified checkpoint (`7b7bb69`, rejected by independent review)

| Field | Value |
| --- | --- |
| Repository / ID | `vn-ca1/Frigo-dev` / `1368281478` |
| Continuation branch | `hoplite/mende-26679a14--browser-harness-final-cert` |
| Starting docs HEAD | `3262eaff86333da142ada1135e5a20c58ea640eb` |
| Starting application WIP | `fd32aa8deaee7df454245591015780c59f909352` |
| Separate U7 application fix | `47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2` |
| **T13B_APPLICATION_FREEZE** | **`7b7bb695ee597a46cf4022a2c534e2fea374be5d`** |
| Protected main, unchanged | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |

The application freeze was published, fetched back, and verified equal. Final
documentation follows it; the parent records the docs commit SHA after creation,
with an empty freeze→docs non-doc diff and verified publication. This document
does not claim its own future commit hash.

## Product contract

T08 foundation → T09 mutation authority → T10 observations/reconciliation →
T11 read authority → T12 closed-loop hardening → T13 truthful evidence and UX.

**Evidence is not authority.** Reviewed accepted scan lines produce T10 evidence
and T09 commands in one guarded atomic batch. Reconciliation decisions also
compose T09 commands. Neither OCR, a frontend edit, nor an observation is a
second stock writer. T11 reads adopted stock; legacy compatibility remains fenced.

| Area | Current behavior |
| --- | --- |
| Confidence, merchant, purchase date, price | Real supplied facts or absence; no confident-looking defaults |
| Receipt purchases | Server-owned `RECEIPT` provenance; separate lots, not an overwrite of existing stock (manual 3 + receipt 2 = total 5) |
| Fridge scans | `SCAN` provenance; no invented purchase facts |
| Expiry | Supplied explicit date → `KNOWN`; inferred shelf life/day chip → `ESTIMATED`; no basis → `UNKNOWN` |
| Review evidence | Raw OCR retained beside confirmed values; lifecycle is only `PENDING` / `CONFIRMED` / `REJECTED`; correction is metadata |
| Rejection | Raw/review evidence retained; no stock command or stock observation for that line |
| Inventory detail | Provenance, expiry truth, lot identity/version, purchased/opened facts; existing name/unit/category/storage/expiry editor |
| Safe edits | Dirty-field snapshot preserves unrelated fields; conversion is backend-owned; conflict refetch and no automatic mutation retry |
| Reconciliation/adoption | Real T10 accept/dismiss UI; explicit identity-checked operator adoption path |

## Certification summary

- Original **AC1–AC14 PASS**, using only the numbering in
  [T13_PROPOSED_SCOPE.md](../../release/T13_PROPOSED_SCOPE.md).
- Roadmap **R3, R4, R5, R6, R7, R8, R11, U1, U4, U6, U7, U8, U12, U13, U14 DONE**.
- Pre-freeze full baseline **3372 tests / 132 files**; clean detached full suite
  **3372 / 132**. Focused **194 / 10**, including hardening **26** and actual CLI **26**.
- Browser **36/36** before freeze and **36/36** in the final serial detached run:
  12 cases at actual Chromium widths **360 / 390 / 430**, flows A–I plus U7 metadata
  and T10 reconciliation. Browser tests are separate from the Vitest total.
- Detached T08 **130/2**, T09 **1259/17**, T10 **98/6**, T11 **39/2**, T12 **22/3**,
  T13/T13B **271/12**; real local workerd/D1 **92/5**. These selections overlap.
- Detached lint, typecheck, build, migration smoke, fresh local D1 **31 migration**
  apply/schema gate, populated legacy replay and final empty status/diff: **PASS**.
  The targeted legacy selection was **2 passed / 52 not selected**, not 54 executed.
- Writer **UNKNOWN=0**, reader **UNKNOWN=0**. Migrations 0001–0030 unchanged;
  0031 blob `c580d30b589ace1102cdfda7e61bfbacc57c4253` unchanged; 0032 absent.
- **NO HOSTED GITHUB CI STATUS FOR T13B_APPLICATION_FREEZE**: exact-freeze queries
  returned zero status contexts and zero matching completed push-workflow runs.

The first detached browser run was **35 passed / 1 failed** (H at 430px): a
concurrent source-writing Vitest test triggered a Vite document reload despite
unchanged source bytes. The full browser suite passed serially without editing
the freeze. **Never run Vitest/source-writing checks concurrently with browser
checks in the same worktree.** See the detailed failure record below.

## Documentation and next action

- [TEST_MATRIX.md](TEST_MATRIX.md): original AC and roadmap evidence, named tests.
- [AUTHORITY_MAP.md](AUTHORITY_MAP.md): current writer/reader classification and audit.
- [RECEIPT_VISION_TRUTH.md](RECEIPT_VISION_TRUTH.md): facts, raw evidence, lifecycle, atomicity.
- [UX_V2.md](UX_V2.md): current editable/terminal surfaces and mobile browser proof.
- [CONTINUATION.md](CONTINUATION.md): reproducible local harness and stop boundary.
- [T13B_FINAL_HARDENING.md](T13B_FINAL_HARDENING.md): exact commands, counts, failures,
  immutable checkpoints and private evidence locations.

Next action: **INDEPENDENT T13 FINAL REVIEW**. Do not start T14, merge main, deploy,
access remote D1, touch PayOS, or begin Frigo ↔ Frigo-dev production reconciliation.
`MEAL_PLANNER_ENABLED` remains unbound/off in production;
`SAFE_DEFERRED` / `MEAL_PLANNER_AUTHORITY_CUTOVER` is preserved, not certified away.
