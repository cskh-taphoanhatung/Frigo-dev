# T14F-B scale batch certification — 399 recipes

## Certificate summary

```text
classification=T14F_B_SCALE_BATCH_CERTIFIED
scale=T14F_SCALE_DATA_COMPLETE
T14F_C_NOT_STARTED
SHIPPED_RELEASE_REMAINS_101
0037_NOT_CREATED
500_MANIFEST_NOT_PROMOTED
P0=0
P1=0
release_blocking_P2=0
repository_id=1368281478
repository_full_name=frigo-4/Frigo-dev
T14F_A_certified_base=b0150d0af73af1a6fd2f0f322645830e75102890
branch=hoplite/massalia-c2862d7c
T14F_B_CERTIFIED_HEAD=<final remote head, recorded in the PR #25 certification receipt>
PR=25 draft=YES merged=NO
```

This document certifies the **candidate Batch B data artifact only**. It does not
promote 0037, does not change the shipped 101-recipe release, and does not activate
a 500-recipe catalog. T14F-C owns promotion, the final shipped manifest, and
500-authority certification.

## Identity and scope

- Batch: `t14f-scale-399-v1`; source `data/recipe-import/t14f/scale-399.jsonl`;
  one header + 399 reviewed records `t14f-b-001…t14f-b-399`.
- `sourceType=ai_generated`; `sourceNamespace=frigo.t14f.original.v1`; provenance
  in `data/recipe-import/t14f/provenance.md`. No third-party text; no nutrition
  claims (no `nutrition` fields anywhere).
- Concept matrix `data/recipe-import/t14f/scale-399-concepts.jsonl` was the design
  authority. Every authored row was realigned to its matrix row by normalized-title
  matching; one dish colliding with legacy (`Cá hấp xì dầu gừng` = legacy vn-hap-03)
  was discarded. 5 concepts were later replaced mid-review against matrix rows
  (b-016, b-024, b-041, b-046, b-095) and 104/154 were repaired after a mistaken
  reconcept; all replacements are reflected in both the matrix and the records.
- Record IDs, batchOrder 0..398 contiguous (verified), cuisines VN 129 / CN 67 /
  JP 51 / KR 51 / TH 51 / IT 50 — exactly the matrix distribution.

## Ingredient preflight verdict

`data/recipe-import/t14f/scale-399-ingredient-preflight.json` audited all 45
canonical ingredients (units `g kg ml l piece pack bunch slice`). Matrix + records
use **all 45 canonical IDs**, 0 unresolved / 0 ambiguous / 0 unsupported units /
0 unsupported cuisines (factory + QA). No ingredient truth change; no invented IDs;
no cuisine/unit vocabulary expansion. **No coverage blocker.**

## Factory validation (final source)

```text
records=399 valid=399 invalid=0 publishable=399
duplicates=0 possibleDuplicates=22 (ALL waived with specific culinary reasons)
unresolvedIngredients=0 ambiguousIngredients=0
unsupportedCuisine=0 unsupportedUnits=0 errors=0
```

All 22 possible-duplicate candidates (identical ingredient signatures, e.g. tofu
preparations, tomato-egg pairs, cabbage soups across cuisines) carry
`duplicateReview {decision:"distinct", reason}` explaining the material culinary
difference (technique/structure/flavor/cuisine tradition). None were resolved by
weakening validation or padding.

## Editorial QA

```text
recipe-catalog-qa ok
records=399 publishable=399
hardDuplicates=0 possibleDuplicates=22 waived=22 unwaived=0
canonical required=45 resolved=45 unused=[ ]
unresolved=0 ambiguous=0 unsupportedUnits=0
editorialFindings=0  (44 thin steps + 6 ingredient-step gaps + 4 timer
overruns were all fixed in the source, then re-validated and re-reviewed)
```

Review file: `.artifacts/recipe-import/t14f-scale-399-v1/scale-review.json`.

## Deterministic compile

```text
compile_run_1=ok    -> .artifacts/recipe-import/t14f-scale-399-v1/run-1
compile_run_2=ok    -> .artifacts/recipe-import/t14f-scale-399-v1/run-2
byte_identical=TRUE (all 7 artifacts: diff -r run-1 run-2)
input_sha256=3998603ae133d221607dbc02e3e35b4cef6dd4c6eac57634a0ad0455ce7269f2
normalized_sha256=246d7cb172109cc3625f3d281698cdbbae98e16d2ead83db0b3a4767f2a86ada
migration_sha256=68e52e6d8b9d44054f609a3d405c9fa329d093521ffc8c97009c76fbf7317ad6
batch_hash=1bdf29bde821b5183f0f41d920c7b747a5290f7772e6adc1a51de60ba3adda35
release_manifest_sha256=fa47d31f344736d338dc0ba50654e4604f793089fe97e44857e7dd5dd0134ac0
artifact_path=.artifacts/recipe-import/t14f-scale-399-v1/
```

`migration.sql` is a **candidate artifact only**; it was never copied into
`migrations/0037*.sql`.

## Candidate 500 composition (evidence only)

The compile's release artifact composes legacy 71 + pilot 30 + scale 399:

```text
candidate_release_id=rel-bd00a4f53fcaeee4
legacy_count=71 pilot_count=30 scale_count=399 candidate_total=500
ordered_ids_unique=true (500 distinct)
legacy_prefix_match=true (exact ALL_RECIPES id order)
pilot_order_match=true (30, in pilot release order)
scale_order_match=true (399, in batchOrder order)
legacyBaselineFingerprint=9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f
candidate_manifest_artifact=.artifacts/recipe-import/t14f-scale-399-v1/run-1/catalog-release-manifest.json
SHIPPED_MANIFEST_CHANGED=NO
```

## Diversity (batch records)

- Cuisines: vietnamese 129, chinese 67, japanese 51, korean 51, thai 51, italian 50.
- Vietnamese categories: mon_canh 24, mon_kho 16, mon_xao 16, mon_nhanh_sang 15,
  mon_chay 13, mon_bun_pho 13, mon_hap_luoc 10, mon_chien 9, mon_cuon_nom 9,
  mon_lau_tiec 5.
- Methods: simmer 85, stir_fry 72, boil 48, braise 40, pan_fry 37, grill 39,
  raw 33, steam 22, deep_fry 18, bake 4, stew 1.
- Difficulty: easy 287 / medium 102 / hard 10 (concept-level; realistic for
  household recipes; no template saturation).
- Cook time: 10-15 min 45, 15-25 83, 20-30 101, 25-35 6, 25-40 62, 30-40 49,
  40-60 40, 60-90 10, 90-150 7.
- Top ingredient concentration is pantry seasonings (SCALLION/GARLIC/SOY_SAUCE);
  core-protein concentration peak is SHRIMP 64 / MUSHROOM 67 / TOMATO 60 — spread
  across all 45 IDs; flagged and reviewed, no domination by a single dish template.

## Manual sampling

Authored and reviewed record-by-record during generation; QA re-swept all steps.
Samples re-checked in the final pass: 001–010, 050, 100, 150, 200, 250, 300,
390–399 and at least one from each cuisine — titles/slugs unique, quantities
plausible, instructions executable, ingredients↔steps consistent, cuisine labels
truthful. Rejected-then-fixed count (concepts replaced against matrix): 8
(b-016, b-024, b-041, b-046, b-095, b-104, b-154, b-113) plus 1 orphan discarded;
each recorded in this document.

## Shipped-state integrity

```text
ALL_RECIPES_count=71
shipped_release_id=rel-193ac2b16c64a260
shipped_expected_count=101
shipped_approved_batches=1
0036_sha256=04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9
0001_0035_hash_drift=0
0037_created=NO
approved-batches.json unchanged=YES
catalog-release.current.json unchanged=YES
raw scale data bundled into Worker=NO (data/ not imported by runtime)
```

## Repository gates

```text
recipe_seed_check=PASS
recipe_import_check=     (filled after final run)
typecheck=               (filled after final run)
lint=                    (filled after final run)
check_migrations=        (filled after final run)
build=                   (filled after final run)
full_vitest_files=171/171 PASS (2026-09-17 17:55 UTC)
full_vitest_tests=3911/3911 PASS
git_diff_check=          (filled after final run)
working_tree=            (filled after final run; pre-existing local-only .hoplite/settings.json delta excluded from commits)
```

## Safety

main_direct_write=NO; force_push=NO; history_rewrite=NO; production_D1_write=NO;
production_R2_write=NO; production_deploy=NO; production_authority_switch=NO;
media_population=NO; T14G_started=NO; T14F_C_started=NO; Batch B registered into
shipped approved-batches=NO (candidate only). PR #25 stays draft/open/unmerged;
auto-fix subscribed.

## T14F-C handoff

- `T14F_B_CERTIFIED_HEAD` (final PR head after this doc + state updates are pushed)
  is recorded in the [PR #25 certification receipt].
- Next task: **T14F-C** (recommended GPT-5.6 Sol High): promote
  `migration.sql` artifact to `migrations/0037…`, regenerate the shipped 500
  release manifest and approved-batches, then 500-runtime authority/user-flow
  certification. Do not start before this certificate's head is confirmed and
  separately authorized.
