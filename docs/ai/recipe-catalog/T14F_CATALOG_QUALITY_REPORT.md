# T14F catalog quality report — pilot 30

## Scope and provenance

This report covers the existing reviewed pilot, not the unstarted 399-recipe scale batch.
T14F-A resolves the historical routing-fixture failures; all local pilot gates and
implementation CI pass (171 files / 3911 tests). Final exact-head certification is
bound by the [PR #25 receipt](https://github.com/frigo-4/Frigo-dev/pull/25#issuecomment-5714709031)
and `T14F_NEXT_HANDOFF.md`. No scale preflight or Batch B was started.
The takeover did not author, regenerate, or alter recipe data or review decisions.

- Source: `data/recipe-import/t14f/pilot-30.jsonl`.
- Review: `data/recipe-import/t14f/pilot-review.json` (30 accepted, 0 rejected,
  1 thin-step finding corrected before the recovery checkpoint, 0 open findings).
- Provenance: `data/recipe-import/t14f/provenance.md`; `sourceType=ai_generated`,
  `sourceNamespace=frigo.t14f.original.v1`, batch `t14f-pilot-30-v1`.
- Batch hash: `4d13915c075cd1b418d2454f7f03968349b779766cdb96b92df90f4138bc8cce`.

## Executed offline checks — 2026-09-17

```sh
node scripts/recipe-catalog-qa.mjs --input data/recipe-import/t14f/pilot-30.jsonl --out .artifacts/recipe-import/t14f-pilot-30-v1/qa-report.json
pnpm recipe:seed:check
pnpm recipe:import:check
pnpm vitest run tests/integration/recipe-catalog-growth.test.ts tests/integration/recipe-catalog-growth-authority.test.ts
```

The focused invocation passed 21/21 twice after the timestamp-comparison fix.
It also independently recompiles the reviewed input twice and verifies the committed
migration against compiler output. No promotion or source regeneration was performed.

| Check | Pilot result |
| --- | --- |
| Present / valid / reviewed / publishable | 30 / 30 / 30 / 30 |
| Ingredient lines / steps | 183 / 128 |
| Compiler errors / warnings | 0 / 0 |
| Hard / possible duplicates / waivers | 0 / 0 / 0 |
| Unresolved / ambiguous ingredients | 0 / 0 |
| Unsupported units / cuisines | 0 / 0 |
| Automated editorial findings | 0 |
| Canonical ingredient coverage | 41 distinct out of 45 |
| Difficulty | 22 easy, 8 medium |
| Nutrition assertions / evidence rows | None fabricated; 0 imported nutrition rows |
| New media | 30 pending hero slots; no uploads |

Cuisine distribution: Vietnamese 14, Japanese 4, Chinese 3, Italian 3, Korean 3,
Thai 3. The pilot does not use `BITTER_MELON`, `CHAYOTE`, `CRAB_MEAT`, or `RICE_PAPER`.
Automated heuristics and compiler validation are not independent culinary or nutrition
certification; they supplement, not replace, the existing recorded editorial review.

## Immutable promotion and release

`0036_recipe_catalog_pilot.sql` SHA-256 remains
`04228788e60d59a2427d70956d4d8a108d0a6c1c4a643c47641402f658120ba9`.
The 71-recipe legacy fingerprint remains
`9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f`.
Manifest `rel-193ac2b16c64a260` expects 101 recipes and one approved batch.

For certification gates, failure diagnosis, scale decision, and next action, see
`T14F_REAL_CATALOG_GROWTH.md` and `T14F_NEXT_HANDOFF.md`. These documents do not
claim a 500-recipe catalog or authorize Ingredient Truth changes.
