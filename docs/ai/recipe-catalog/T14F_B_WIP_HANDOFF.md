# T14F-B handoff — certified scale batch

# T14F-B WIP handoff — safe-stopped during data generation

```text
classification=T14F_B_SAFE_STOPPED_DATA_WIP
scale_data=NOT complete (56 of 399 records)
T14F_B_CERTIFIED_HEAD=NONE (not certified)
repository_id=1368281478
repository_full_name=frigo-4/Frigo-dev
origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954
branch=hoplite/massalia-c2862d7c
T14F_A_certified_base=b0150d0af73af1a6fd2f0f322645830e75102890
wip_head=<recover with git rev-parse HEAD; must be a forward descendant of b0150d0>
PR=25
draft=YES
merged=NO
```

A committed handoff cannot contain its own hash: recover the remote PR head and verify
`b0150d0…` is an ancestor. Do NOT reset. This run stopped during record generation per the
T14F-B packet's credit-exhaustion protocol (§62) — NOT because of any data, importer, or
ingredient-coverage defect.

## Completed in this run

1. Base and identity verified: exact certified head `b0150d0…` checked out; numeric
   repository ID 1368281478 confirmed; PR #25 draft/open/unmerged; no reset/rewrite.
2. T14E factory, schema, canonical catalog (45 ingredients), closed units
   (`g,kg,ml,l,piece,pack,bunch,slice`), duplicate semantics and QA thresholds audited.
3. Ingredient preflight inventory committed: `data/recipe-import/t14f/scale-399-ingredient-preflight.json`
   (all 45 canonical IDs, legacy/pilot usage counts; ingredient truth untouched).
4. 399-concept matrix committed: `data/recipe-import/t14f/scale-399-concepts.jsonl`
   — cuisines VN 129 / CN 67 / JP 51 / KR 51 / TH 51 / IT 50; all 10 VN categories; 11 methods;
   all titles/slugs unique vs the certified 101; 4 concepts replaced mid-review because the
   T14E compiler proved them identical to legacy dishes (b-016, b-024, b-041, b-046).
   Ingredient-scale verdict: **feasible** (no coverage blocker).
5. 56 full reviewed records authored into `data/recipe-import/t14f/scale-399.jsonl`
   (`t14f-b-001` … `t14f-b-056`, batchOrder 0..55, header `t14f-scale-399-v1`,
   sourceNamespace `frigo.t14f.original.v1`).
6. Validation after every tranche: `node scripts/recipe-import.mjs validate --input data/recipe-import/t14f/scale-399.jsonl`
   — **56/56 valid, 56/56 publishable, 0 duplicates, 0 possible duplicates, 0 unresolved
   ingredients, 0 unsupported units/cuisines** (last full pass at 56 records).
7. Shipped release proven unchanged: `pnpm recipe:import:check` ok (101 recipes / 1 batch /
   `rel-193ac2b16c64a260`), `pnpm recipe:seed:check` ok, 0036 SHA-256
   `04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9`, approved-batches and
   `catalog-release.current.json` untouched. No 0037. No production action.

## Exact next steps for the resuming run

1. `git fetch origin main hoplite/massalia-c2862d7c --prune`; verify HEAD is a forward
   descendant of `b0150d0…`; verify PR #25 draft/unmerged; do not reset.
2. Read this file, `T14F_NEXT_HANDOFF.md`, and the concept matrix.
3. Resume authoring at **`t14f-b-057` (batchOrder 56)** — the matrix row `{"i":57}` is
   "Trứng cuộn tamagoyaki" (JP, pan_fry, core `CHICKEN_EGG`+`FRESH_MILK`, 10-15, medium).
   Append records to `data/recipe-import/t14f/scale-399.jsonl` following the matrix order
   through `t14f-b-399` (batchOrder 0..398 contiguous at the end).
4. Record rules distilled (all enforced by the factory + QA script): every ingredient line
   carries an explicit `ingredientId`; units only `g,kg,ml,l,piece,pack,bunch,slice`;
   ≥3 ingredients and ≥3 steps per record; every instruction ≥25 chars and unique;
   timers sum ≤ cookTimeMinutes; servings 1–8; cookTime 5–240; region only for
   `vietnamese` (`bac/trung/nam/toan_quoc`); category only for VN dishes using the legacy
   slugs; NO `nutrition` field (QA flags it); tags ≤6 without health claims;
   classifications `meal_type` + `method`; every non-seasoning ingredient's Vietnamese name
   must appear verbatim in step prose (QA `INGREDIENT_NOT_IN_STEPS`); include a cooking
   verb (xào/kho/chiên/hấp/nấu/nướng…) whenever a protein line exists; avoid duplicating
   any legacy dish — the compiler flags shared ingredient signatures.
5. Validate after every ~10-record tranche with the same command as step 6; fix any
   `POSSIBLE_DUPLICATE` by re-concepting (never by weakening validation). When a legacy dish
   collision occurs, update both the matrix row and the record, and count it in the
   certification report's `rejected_then_fixed`.
6. After `t14f-b-399`: `recipe-import ok: records=399 ... publishable=399` required, then
   continue the packet: editorial QA all 399 (`scripts/recipe-catalog-qa.mjs --input
   data/recipe-import/t14f/scale-399.jsonl --approved data/recipe-import/t14f/pilot-30.jsonl
   --out .artifacts/recipe-import/t14f-scale-399-v1/scale-review.json`), duplicate review,
   double deterministic compile into `.artifacts/recipe-import/t14f-scale-399-v1/run-1` and
   `run-2`, candidate-500 composition evidence ONLY (never promote 0037, never touch the
   shipped manifest/approved-batches), manual samples, certification
   `docs/ai/recipe-catalog/T14F_B_SCALE_BATCH_CERTIFICATION.md`, update this handoff to
   final state, all repository gates, then record `T14F_B_CERTIFIED_HEAD`.

## Blockers

None technical. Stop reason: agent output budget exhausted mid-generation, per §62.
All authored work is committed; nothing is left uncommitted except the pre-existing
local-only `.hoplite/settings.json` delta (intentionally never committed).

## Safety

main_direct_write NO; force_push NO; history_rewrite NO; production_D1/R2_write NO;
production_deploy NO; authority_switch NO; 0037_created NO; 500_shipped_manifest NO;
media_population NO; T14G NO; Batch B registered into approved-batches NO (candidate only).
PR #25 remains draft/open/unmerged with auto-fix subscribed.


## CERTIFIED — supersedes the safe-stop section below

T14F-B completed at certified head `c7ecf909de9f88b2256cce72093311ebd55d9b6d`: **399 records** (`t14f-scale-399-v1`) validated 399/399 publishable, 0 hard duplicates, 0 unresolved ingredients, QA `ok` with 0 editorial findings, byte-identical double compile, candidate-500 composition verified. Full gates green (171 files / 3911 tests). See `T14F_B_SCALE_BATCH_CERTIFICATION.md` and the PR #25 receipt for the certified head. Do NOT promote 0037; T14F-C owns promotion.

## Historical safe-stop WIP (superseded)

# T14F-B WIP handoff — safe-stopped during data generation

```text
classification=T14F_B_SAFE_STOPPED_DATA_WIP
scale_data=NOT complete (56 of 399 records)
T14F_B_CERTIFIED_HEAD=NONE (not certified)
repository_id=1368281478
repository_full_name=frigo-4/Frigo-dev
origin_main=f0c229f2e2b134904a8c0e355479394cbf53c954
branch=hoplite/massalia-c2862d7c
T14F_A_certified_base=b0150d0af73af1a6fd2f0f322645830e75102890
wip_head=<recover with git rev-parse HEAD; must be a forward descendant of b0150d0>
PR=25
draft=YES
merged=NO
```

A committed handoff cannot contain its own hash: recover the remote PR head and verify
`b0150d0…` is an ancestor. Do NOT reset. This run stopped during record generation per the
T14F-B packet's credit-exhaustion protocol (§62) — NOT because of any data, importer, or
ingredient-coverage defect.

## Completed in this run

1. Base and identity verified: exact certified head `b0150d0…` checked out; numeric
   repository ID 1368281478 confirmed; PR #25 draft/open/unmerged; no reset/rewrite.
2. T14E factory, schema, canonical catalog (45 ingredients), closed units
   (`g,kg,ml,l,piece,pack,bunch,slice`), duplicate semantics and QA thresholds audited.
3. Ingredient preflight inventory committed: `data/recipe-import/t14f/scale-399-ingredient-preflight.json`
   (all 45 canonical IDs, legacy/pilot usage counts; ingredient truth untouched).
4. 399-concept matrix committed: `data/recipe-import/t14f/scale-399-concepts.jsonl`
   — cuisines VN 129 / CN 67 / JP 51 / KR 51 / TH 51 / IT 50; all 10 VN categories; 11 methods;
   all titles/slugs unique vs the certified 101; 4 concepts replaced mid-review because the
   T14E compiler proved them identical to legacy dishes (b-016, b-024, b-041, b-046).
   Ingredient-scale verdict: **feasible** (no coverage blocker).
5. 56 full reviewed records authored into `data/recipe-import/t14f/scale-399.jsonl`
   (`t14f-b-001` … `t14f-b-056`, batchOrder 0..55, header `t14f-scale-399-v1`,
   sourceNamespace `frigo.t14f.original.v1`).
6. Validation after every tranche: `node scripts/recipe-import.mjs validate --input data/recipe-import/t14f/scale-399.jsonl`
   — **56/56 valid, 56/56 publishable, 0 duplicates, 0 possible duplicates, 0 unresolved
   ingredients, 0 unsupported units/cuisines** (last full pass at 56 records).
7. Shipped release proven unchanged: `pnpm recipe:import:check` ok (101 recipes / 1 batch /
   `rel-193ac2b16c64a260`), `pnpm recipe:seed:check` ok, 0036 SHA-256
   `04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9`, approved-batches and
   `catalog-release.current.json` untouched. No 0037. No production action.

## Exact next steps for the resuming run

1. `git fetch origin main hoplite/massalia-c2862d7c --prune`; verify HEAD is a forward
   descendant of `b0150d0…`; verify PR #25 draft/unmerged; do not reset.
2. Read this file, `T14F_NEXT_HANDOFF.md`, and the concept matrix.
3. Resume authoring at **`t14f-b-057` (batchOrder 56)** — the matrix row `{"i":57}` is
   "Trứng cuộn tamagoyaki" (JP, pan_fry, core `CHICKEN_EGG`+`FRESH_MILK`, 10-15, medium).
   Append records to `data/recipe-import/t14f/scale-399.jsonl` following the matrix order
   through `t14f-b-399` (batchOrder 0..398 contiguous at the end).
4. Record rules distilled (all enforced by the factory + QA script): every ingredient line
   carries an explicit `ingredientId`; units only `g,kg,ml,l,piece,pack,bunch,slice`;
   ≥3 ingredients and ≥3 steps per record; every instruction ≥25 chars and unique;
   timers sum ≤ cookTimeMinutes; servings 1–8; cookTime 5–240; region only for
   `vietnamese` (`bac/trung/nam/toan_quoc`); category only for VN dishes using the legacy
   slugs; NO `nutrition` field (QA flags it); tags ≤6 without health claims;
   classifications `meal_type` + `method`; every non-seasoning ingredient's Vietnamese name
   must appear verbatim in step prose (QA `INGREDIENT_NOT_IN_STEPS`); include a cooking
   verb (xào/kho/chiên/hấp/nấu/nướng…) whenever a protein line exists; avoid duplicating
   any legacy dish — the compiler flags shared ingredient signatures.
5. Validate after every ~10-record tranche with the same command as step 6; fix any
   `POSSIBLE_DUPLICATE` by re-concepting (never by weakening validation). When a legacy dish
   collision occurs, update both the matrix row and the record, and count it in the
   certification report's `rejected_then_fixed`.
6. After `t14f-b-399`: `recipe-import ok: records=399 ... publishable=399` required, then
   continue the packet: editorial QA all 399 (`scripts/recipe-catalog-qa.mjs --input
   data/recipe-import/t14f/scale-399.jsonl --approved data/recipe-import/t14f/pilot-30.jsonl
   --out .artifacts/recipe-import/t14f-scale-399-v1/scale-review.json`), duplicate review,
   double deterministic compile into `.artifacts/recipe-import/t14f-scale-399-v1/run-1` and
   `run-2`, candidate-500 composition evidence ONLY (never promote 0037, never touch the
   shipped manifest/approved-batches), manual samples, certification
   `docs/ai/recipe-catalog/T14F_B_SCALE_BATCH_CERTIFICATION.md`, update this handoff to
   final state, all repository gates, then record `T14F_B_CERTIFIED_HEAD`.

## Blockers

None technical. Stop reason: agent output budget exhausted mid-generation, per §62.
All authored work is committed; nothing is left uncommitted except the pre-existing
local-only `.hoplite/settings.json` delta (intentionally never committed).

## Safety

main_direct_write NO; force_push NO; history_rewrite NO; production_D1/R2_write NO;
production_deploy NO; authority_switch NO; 0037_created NO; 500_shipped_manifest NO;
media_population NO; T14G NO; Batch B registered into approved-batches NO (candidate only).
PR #25 remains draft/open/unmerged with auto-fix subscribed.
