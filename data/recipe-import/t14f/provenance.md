# T14F recipe source provenance

Source directory for the T14F real catalog growth batches. **Not runtime code**: nothing in
`data/` is imported by the Worker or the web bundle. The runtime receives these recipes only through
the promoted D1 migrations and the compiled Catalog Release Manifest.

## Source strategy

| Field | Value |
| --- | --- |
| `sourceType` | `ai_generated` |
| `sourceNamespace` | `frigo.t14f.original.v1` |
| `sourceReference` | `T14F project-original recipe generation batch <batchId>` |
| `license` | Project-original content authored for Frigo/Takosan (CC0-equivalent internal grant); no third-party recipe text |
| `usageNote` | AI-drafted, editorially reviewed household recipes. Structured ingredient lines are canonical inventory items; pantry seasonings appear in step prose only. No nutrition claims (no evidence). |
| web scraping | **NO** |
| third-party recipe text copied | **NO** |
| third-party dataset | **NONE** (no license to establish) |

Every recipe is an original, concise household description of a well-known dish family written for
this project. Titles/descriptions/steps follow the existing catalog convention (Vietnamese user-facing
text for all cuisines, e.g. `Cơm gà trứng Oyakodon Nhật Bản`). No recipe carries nutrition macros: no
credible evidence exists for AI-drafted recipes, so `nutrition` is omitted and no
`nutrition_profiles`/`recipe_nutrition` rows are generated (T14E evidence-only contract).

## Identity

- `sourceRecordId` is persisted per record (`t14f-a-001` …) and never derived from position, title or slug.
- Canonical recipe ID = T14E `imp-<sha256(frigo.t14f.original.v1:<sourceRecordId>)[0:16]>`.
- `batchOrder` is explicit `0..N-1`; physical line order is not authority (reordering lines yields the same
  `batchHash`, `migration.sql` and manifest).
- Slugs are reviewer-supplied romanized (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).

## Ingredient truth

Structured ingredient lines resolve **only** to the 45 existing canonical ingredients (`CANONICAL_INGREDIENTS`,
D1 `ingredients`), by exact ID. Common pantry seasonings that have no canonical ingredient (salt, sugar,
pepper, shallot, herbs, spices, stock) are mentioned in step prose only and are deliberately **not** structured
lines — inventing IDs is forbidden. Recipes that would need a canonical ingredient the catalog lacks as a
*core* component were not authored (see `T14F_CATALOG_QUALITY_REPORT.md` → ingredient coverage).

## Review

- Editorial QA: `node scripts/recipe-catalog-qa.mjs --input <batch> [--approved <earlier batch> …]`
  (title/description/cuisine plausibility, ingredient↔step consistency, servings/time, tags, duplicates,
  ingredient coverage). Result JSON per batch: `pilot-review.json`, `scale-review.json` (Batch B review file is written only when all 399 records exist).
- Factory gates: `node scripts/recipe-import.mjs validate|compile|verify --input <batch>`.
- Reviewer of record for T14F: Hoplite (AI coding agent) under the T14F packet; independent human review
  happens at PR review before merge (`T14F_READY_FOR_REVIEW`, not merged automatically).

## Batches

| Batch | File | Records | Migration |
| --- | --- | --- | --- |
| A — pilot | `pilot-30.jsonl` | 30 | `0036_recipe_catalog_pilot.sql` |
| B — scale | `scale-399.jsonl` | 399 certified candidate (`t14f-scale-399-v1`, batchHash `1bdf29bd…`) | none yet (T14F-C promotes) |

`../approved-batches.json` is the release-order registry that `pnpm recipe:import:check` recompiles to
prove the committed Catalog Release Manifest and migrations are generated from these sources.
