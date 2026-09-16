#!/usr/bin/env bash
set -euo pipefail

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for the migration smoke test"
  exit 1
fi

sqlite3 ':memory:' <<'SQL'
.bail on
PRAGMA foreign_keys = ON;
.read migrations/0001_initial_schema.sql
.read migrations/0002_seed_data.sql
.read migrations/0003_weekly_planner.sql
.read migrations/0004_auth_system.sql
.read migrations/0005_meal_plans_relational.sql
.read migrations/0006_vietnamese_recipe_bank.sql
.read migrations/0007_week_integrity.sql
.read migrations/0008_week_snapshot_metadata.sql
.read migrations/0009_inventory_optimistic_version.sql
.read migrations/0012_scan_queue_jobs.sql

-- Seed a mixed legacy/current Week dataset before the shadow migration. The
-- fixture exercises metadata preservation and legacy-only recovery.
INSERT INTO meal_plans (id, household_id, start_date, end_date, status)
VALUES ('migration_smoke_plan', 'demo_household_01', '2026-09-07', '2026-09-13', 'READY');
INSERT INTO meal_plan_days (id, plan_id, day_of_week, date, day_type)
VALUES ('migration_smoke_day', 'migration_smoke_plan', 1, '2026-09-07', 'flexible');
INSERT INTO meal_plan_days (id, plan_id, day_of_week, date, day_type)
VALUES ('migration_smoke_sunday', 'migration_smoke_plan', 0, '2026-09-13', 'cooking');
INSERT INTO meal_plan_slots (id, day_id, plan_id, slot_type, recipe_id, servings, status, notes, snapshot_json)
VALUES ('migration_smoke_slot_current', 'migration_smoke_day', 'migration_smoke_plan', 'dinner', 'vn-canh-01', 2, 'PLANNED', 'current metadata', '{"category":"current"}');
INSERT INTO meal_slots (id, day_id, plan_id, slot_type, status, recipe_id, servings, source, is_locked, leftover_source_id, notes)
VALUES ('migration_smoke_slot_current', 'migration_smoke_day', 'migration_smoke_plan', 'dinner', 'PLANNED', 'vn-canh-01', 3, 'USER', 1, 'source_slot_1', 'legacy metadata');
INSERT INTO meal_slots (id, day_id, plan_id, slot_type, status, recipe_id, servings, source, is_locked, leftover_source_id, notes)
VALUES ('migration_smoke_slot_legacy_only', 'migration_smoke_day', 'migration_smoke_plan', 'lunch', 'LEFTOVER', NULL, 1, 'USER', 0, NULL, 'legacy only');
INSERT INTO meal_plan_shopping_items (id, plan_id, ingredient_id, name, quantity, unit, checked, cannot_buy, snapshot_json)
VALUES ('migration_smoke_shop_current', 'migration_smoke_plan', 'TOMATO', 'Cà chua', 3, 'piece', 1, 0,
        '{"category":"vegetable","requiredQuantity":5,"existingInventoryQuantity":2,"missingQuantity":3,"recommendedPurchaseQuantity":3,"estimatedPriceMin":10000,"estimatedPriceMax":15000}');
INSERT INTO meal_plan_shopping_items (id, plan_id, ingredient_id, name, quantity, unit, checked, cannot_buy)
VALUES ('migration_smoke_shop_enriched', 'migration_smoke_plan', 'GARLIC', 'Tỏi', 2, 'piece', 1, 0);
INSERT INTO meal_plan_ingredient_requirements
  (id, plan_id, ingredient_id, name, category, required_quantity, inventory_quantity, missing_quantity, purchase_quantity, unit, estimated_price_min, estimated_price_max, is_checked)
VALUES ('migration_smoke_req_legacy', 'migration_smoke_plan', 'GARLIC', 'Tỏi', 'spice', 2, 0, 2, 2, 'piece', 5000, 7000, 0);
INSERT INTO meal_plan_ingredient_requirements
  (id, plan_id, ingredient_id, name, category, required_quantity, inventory_quantity, missing_quantity, purchase_quantity, unit, estimated_price_min, estimated_price_max, is_checked)
VALUES ('migration_smoke_req_only', 'migration_smoke_plan', 'GINGER', 'Gừng', 'spice', 1, 0, 1, 1, 'piece', 3000, 5000, 0);

-- Replay once to prove this additive backfill is safe if an operator executes
-- the SQL directly after an interrupted bootstrap.
.read migrations/0010_week_schema_shadow_canonical.sql
.read migrations/0010_week_schema_shadow_canonical.sql
.read migrations/0011_meal_plan_tenant_ownership.sql
.read migrations/0011_meal_plan_tenant_ownership.sql
.read migrations/0013_scan_receipt_metadata.sql
.read migrations/0014_scan_queue_fencing.sql
.read migrations/0015_auth_session_otp_hardening.sql
.read migrations/0016_scan_quota_ledger.sql
.read migrations/0017_auth_otps_remove_plaintext.sql
.read migrations/0018_payments.sql
.read migrations/0019_recipe_domain_foundation.sql
.read migrations/0020_t01_foundation_hardening.sql
.read migrations/0021_recipe_personalization.sql
.read migrations/0022_generated_meal_plans.sql
.read migrations/0023_scan_request_fingerprint.sql
.read migrations/0024_inventory_truth_foundation.sql
.read migrations/0025_inventory_lot_commands.sql
.read migrations/0026_inventory_event_authority.sql
.read migrations/0027_inventory_event_poststate.sql
.read migrations/0028_inventory_fefo_authority.sql
.read migrations/0029_inventory_adoption_authority.sql
.read migrations/0030_inventory_fefo_backfill_compatibility.sql
.read migrations/0031_inventory_observation_reconciliation.sql

-- T13: seed pre-0032 scan lines so the legacy upgrade is exercised, not just a
-- fresh replay. One unreviewed line (raw evidence still intact) and one already
-- confirmed line (its extraction is genuinely lost and must stay NULL).
INSERT INTO scans (id, user_id, household_id, status, scan_type, purchase_date)
VALUES ('migration_smoke_receipt', 'demo_user_01', 'demo_household_01', 'ready', 'receipt', '2026-09-10');
INSERT INTO scan_items (id, scan_id, raw_name, estimated_quantity, unit, confidence, is_confirmed)
VALUES ('migration_smoke_line_open', 'migration_smoke_receipt', 'Thit heo', 2.0, 'kg', 0.55, 0);
INSERT INTO scan_items (id, scan_id, raw_name, estimated_quantity, unit, confidence, is_confirmed)
VALUES ('migration_smoke_line_done', 'migration_smoke_receipt', 'Trung ga', 6, 'piece', 0.9, 1);

.read migrations/0032_scan_evidence_retention.sql

-- T13R-A: seed representative post-0032 / pre-0033 rows so the 0033 upgrade
-- is exercised over populated data: a T13 pending line with retained 0031
-- evidence, a T13 confirmed line (its reviewed expiry basis is genuinely
-- unknown and must stay NULL, never backfilled from the lot), and a T13
-- rejected line. The two 0031-era legacy rows above stay as they are.
INSERT INTO scan_items (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
  is_confirmed, review_state, ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
VALUES ('migration_smoke_t13_pending', 'migration_smoke_receipt', 'Ca chua', 'TOMATO', 3, 'piece', 0.9, 'vegetable', 'fridge',
  0, 'PENDING', 'Ca chua OCR', 3, 'piece', 0.42);
INSERT INTO scan_items (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
  is_confirmed, review_state, ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
VALUES ('migration_smoke_t13_confirmed', 'migration_smoke_receipt', 'Dau phu', 'TOFU', 2, 'piece', 0.9, 'other', 'pantry',
  1, 'CONFIRMED', 'Dau hu OCR', 1, 'piece', NULL);
INSERT INTO scan_items (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, confidence, category, storage,
  is_confirmed, review_state, ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
VALUES ('migration_smoke_t13_rejected', 'migration_smoke_receipt', 'Vet ban', NULL, 1, 'piece', 0.9, 'other', 'fridge',
  0, 'REJECTED', 'Vet ban', 1, 'piece', 0);

.read migrations/0033_scan_evidence_completeness.sql

CREATE TEMP TABLE assert_zero (value INTEGER NOT NULL CHECK (value = 0));
INSERT INTO assert_zero SELECT COUNT(*) FROM pragma_foreign_key_check;
INSERT INTO assert_zero SELECT COUNT(*) FROM pragma_integrity_check WHERE integrity_check <> 'ok';

CREATE TEMP TABLE assert_one (value INTEGER NOT NULL CHECK (value = 1));
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'inventory_lots';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'inventory_commands';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_lots') WHERE name = 'legacy_item_id';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_events') WHERE name = 'command_id';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('households') WHERE name = 'inventory_version';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_lots_live_update';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_events_command_update';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_events_command_authority_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_events_command_poststate_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_commands_fefo_authority_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_commands_fefo_envelope_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_events_command_fefo_authority_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'inventory_adoption_receipts';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_adoption_receipts_immutable_update';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_adoption_receipts_immutable_delete';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'inventory_observations';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'inventory_reconciliation_decisions';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_observations') WHERE name = 'evidence';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_observations') WHERE name = 'authoritative_inventory_version';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_observations') WHERE name = 'quantity_milli';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_reconciliation_decisions') WHERE name = 'decision_key';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_reconciliation_decisions') WHERE name = 'expected_observation_version';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_observations_immutable_update';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_observations_immutable_delete';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_observations_lot_household_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_observations_projection_household_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_reconciliation_decisions_observation_guard';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_reconciliation_decisions_immutable_update';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_inventory_reconciliation_decisions_immutable_delete';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'storage_locations';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('ingredient_aliases') WHERE name = 'normalized_alias';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_items') WHERE name = 'expiry_source';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('recipes') WHERE name = 'verification_state';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'recipe_family_options';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_ingredients_canonical_id_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_recipe_nutrition_version_update';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_recipe_families_source_reference_update';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'household_ranking_preferences';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'member_ranking_preferences';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'recipe_feedback_events';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'generated_meal_plans';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'generated_meal_plan_annotations';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_cooked_meals_ranking_recent';
INSERT INTO assert_zero SELECT COUNT(*) FROM sqlite_master WHERE name = '_t01_hardening_guard';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('meal_plan_days') WHERE name = 'day_type';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('meal_plans') WHERE name = 'snapshot_json';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('meal_plan_slots') WHERE name = 'snapshot_json';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('meal_plan_shopping_items') WHERE name = 'snapshot_json';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('inventory_items') WHERE name = 'version';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_queue_jobs') WHERE name = 'attempts';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_queue_jobs') WHERE name = 'claim_token';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('sessions_v2') WHERE name = 'token_hash';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('auth_otps') WHERE name = 'attempt_count';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('auth_otps') WHERE name = 'used_at';
INSERT INTO assert_zero SELECT COUNT(*) FROM pragma_table_info('auth_otps') WHERE name = 'code';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_quota_ledger') WHERE name = 'idempotency_key';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_quota_periods') WHERE name = 'used_count';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scans') WHERE name = 'request_fingerprint';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scans') WHERE name = 'image_mime_type';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_scans_request_fingerprint';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('meal_plan_days_v2') WHERE name = 'snapshot_json';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('meal_plan_slots_v2') WHERE name = 'leftover_source_id';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('meal_plan_shopping_items_v2') WHERE name = 'required_quantity';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master
  WHERE type = 'trigger' AND name = 'trg_meal_plans_household_immutable';
INSERT INTO assert_one SELECT COUNT(*) FROM meal_plan_days_v2
  WHERE id = 'migration_smoke_day' AND day_type = 'flexible';
INSERT INTO assert_one SELECT COUNT(*) FROM meal_plan_days_v2
  WHERE id = 'migration_smoke_sunday' AND day_of_week = 7;
INSERT INTO assert_one SELECT COUNT(*) FROM meal_plan_slots_v2
  WHERE id = 'migration_smoke_slot_current' AND servings = 2 AND source = 'USER'
    AND is_locked = 1 AND leftover_source_id = 'source_slot_1';
INSERT INTO assert_one SELECT COUNT(*) FROM meal_plan_slots_v2
  WHERE id = 'migration_smoke_slot_legacy_only' AND notes = 'legacy only';
INSERT INTO assert_one SELECT COUNT(*) FROM meal_plan_shopping_items_v2
  WHERE id = 'migration_smoke_shop_current' AND required_quantity = 5
    AND inventory_quantity = 2 AND missing_quantity = 3 AND purchase_quantity = 3;
INSERT INTO assert_one SELECT COUNT(*) FROM meal_plan_shopping_items_v2
  WHERE id = 'migration_smoke_shop_enriched' AND ingredient_id = 'GARLIC'
    AND category = 'spice' AND required_quantity = 2
    AND estimated_price_min = 5000 AND estimated_price_max = 7000;
INSERT INTO assert_one SELECT COUNT(*) FROM meal_plan_shopping_items_v2
  WHERE id = 'legacy_req_migration_smoke_req_only' AND ingredient_id = 'GINGER';

-- Production was originally bootstrapped with direct SQL execution. If an
-- operator later baselines Wrangler history incorrectly, 0006 may be replayed.
-- Seed updates must preserve user-owned rows that reference catalog recipes.
INSERT INTO favorites (id, user_id, recipe_id)
VALUES ('migration_smoke_favorite', 'demo_user_01', 'vn-canh-01');
INSERT INTO recipe_translations (id, recipe_id, language, title)
VALUES ('migration_smoke_translation', 'vn-canh-01', 'ja', 'Migration smoke');
UPDATE recipes SET title = 'stale seed title' WHERE id = 'vn-canh-01';

.read migrations/0006_vietnamese_recipe_bank.sql

INSERT INTO assert_one
SELECT COUNT(*) FROM favorites WHERE id = 'migration_smoke_favorite';
INSERT INTO assert_one
SELECT COUNT(*) FROM recipe_translations WHERE id = 'migration_smoke_translation';
INSERT INTO assert_one
SELECT COUNT(*) FROM recipes
WHERE id = 'vn-canh-01' AND title = 'Canh chua cá lóc Nam Bộ';
INSERT INTO assert_zero SELECT COUNT(*) FROM pragma_foreign_key_check;

-- T10 observation evidence smoke: identity, optimistic lifecycle and the
-- dismissal decision path (evidence-only; no stock mutation is possible here).
INSERT INTO inventory_observations (id, household_id, source_type, source_ref, fingerprint,
  observed_at, recorded_at, raw_name, quantity, unit, quantity_milli, canonical_unit,
  evidence, authoritative_inventory_version, version, created_at, updated_at)
VALUES ('migration_smoke_observation', 'demo_household_01', 'MANUAL', 'migration-smoke',
  '{"claim":{"quantity":2,"unit":"kg"},"sourceRef":"migration-smoke","sourceType":"MANUAL"}',
  '2026-09-11T10:00:00Z', '2026-09-11T10:00:00Z', 'Cà chua', 2.0, 'kg', 2000000, 'g',
  'OBSERVED', 1, 1, '2026-09-11T10:00:00Z', '2026-09-11T10:00:00Z');
INSERT INTO inventory_reconciliation_decisions (id, household_id, observation_id, decision_key,
  fingerprint, decision_type, proposed_verdict, actor_id, expected_observation_version, created_at)
VALUES ('migration_smoke_dismissal', 'demo_household_01', 'migration_smoke_observation',
  'migration-smoke:dismiss', '{"decisionType":"DISMISS"}', 'DISMISS', 'NO_ACTION',
  'demo_user_01', 1, '2026-09-11T10:05:00Z');
INSERT INTO assert_one SELECT COUNT(*) FROM inventory_reconciliation_decisions
  WHERE id = 'migration_smoke_dismissal' AND decision_type = 'DISMISS' AND command_id IS NULL;
INSERT INTO assert_one SELECT COUNT(*) FROM inventory_observations
  WHERE id = 'migration_smoke_observation' AND status = 'OPEN' AND version = 1
    AND quantity_milli = 2000000 AND canonical_unit = 'g';

-- T13 / 0031: raw OCR evidence is retained separately from the reviewable
-- values, the confirmed-before-T13 line keeps NULL raw evidence instead of a
-- fabricated one, and the explicit review lifecycle exists.
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'ocr_raw_name';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'ocr_quantity';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'ocr_unit';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'ocr_confidence';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'review_state';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master
  WHERE type = 'trigger' AND name = 'trg_scan_items_review_state_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master
  WHERE type = 'trigger' AND name = 'trg_scan_items_review_state_update';
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_line_open' AND review_state = 'PENDING'
    AND ocr_raw_name = 'Thit heo' AND ocr_quantity = 2.0 AND ocr_unit = 'kg';
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_line_done' AND review_state = 'CONFIRMED'
    AND ocr_raw_name IS NULL AND ocr_quantity IS NULL AND ocr_unit IS NULL;
-- Explicit rejection is representable and distinct from "never reviewed".
UPDATE scan_items SET review_state = 'REJECTED' WHERE id = 'migration_smoke_line_open';
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_line_open' AND review_state = 'REJECTED' AND is_confirmed = 0;

-- T13R-A / 0032: complete raw mapping evidence and the reviewed expiry exist,
-- and NO populated row gained fabricated evidence: every pre-0032 row keeps
-- NULL ocr_canonical_id/ocr_category/ocr_storage and NULL reviewed expiry,
-- whatever its review state (legacy pending/confirmed, T13 pending/confirmed/
-- rejected). The legacy 0031 evidence and lifecycle are untouched.
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'ocr_canonical_id';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'ocr_category';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'ocr_storage';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'reviewed_expiry_date';
INSERT INTO assert_one SELECT COUNT(*) FROM pragma_table_info('scan_items') WHERE name = 'reviewed_expiry_kind';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master
  WHERE type = 'trigger' AND name = 'trg_scan_items_reviewed_expiry_insert';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master
  WHERE type = 'trigger' AND name = 'trg_scan_items_reviewed_expiry_update';
INSERT INTO assert_zero SELECT COUNT(*) FROM scan_items
  WHERE scan_id = 'migration_smoke_receipt'
    AND (ocr_canonical_id IS NOT NULL OR ocr_category IS NOT NULL OR ocr_storage IS NOT NULL
      OR reviewed_expiry_date IS NOT NULL OR reviewed_expiry_kind IS NOT NULL);
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_t13_pending' AND review_state = 'PENDING' AND is_confirmed = 0
    AND ocr_raw_name = 'Ca chua OCR' AND ocr_quantity = 3 AND ocr_unit = 'piece' AND ocr_confidence = 0.42;
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_t13_confirmed' AND review_state = 'CONFIRMED' AND is_confirmed = 1
    AND ocr_raw_name = 'Dau hu OCR' AND ocr_quantity = 1 AND ocr_confidence IS NULL;
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_t13_rejected' AND review_state = 'REJECTED' AND is_confirmed = 0 AND ocr_confidence = 0;
-- The new writers' shapes are accepted; unlawful shapes are refused fail-closed.
UPDATE scan_items SET is_confirmed = 1, review_state = 'CONFIRMED',
  reviewed_expiry_date = '2030-12-31', reviewed_expiry_kind = 'KNOWN'
  WHERE id = 'migration_smoke_t13_pending';
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_t13_pending' AND review_state = 'CONFIRMED'
    AND reviewed_expiry_date = '2030-12-31' AND reviewed_expiry_kind = 'KNOWN';
INSERT INTO scan_items (id, scan_id, raw_name, estimated_quantity, unit, confidence, is_confirmed, review_state,
  ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence, ocr_canonical_id, ocr_category, ocr_storage)
VALUES ('migration_smoke_t13r_a_new', 'migration_smoke_receipt', 'Trung ga', 6, 'piece', 0.9, 0, 'PENDING',
  'Trung ga', 6, 'piece', 0.77, 'CHICKEN_EGG', 'egg', 'fridge');
INSERT INTO assert_one SELECT COUNT(*) FROM scan_items
  WHERE id = 'migration_smoke_t13r_a_new' AND ocr_canonical_id = 'CHICKEN_EGG' AND ocr_category = 'egg' AND ocr_storage = 'fridge';
INSERT INTO assert_zero SELECT COUNT(*) FROM pragma_foreign_key_check;

-- T14B-B (0034): a cooking/shopping FK anchor for a global recipe may already
-- exist on a populated 0033 database. The parity migration must upgrade it in
-- place (same stable ID, provenance defaults untouched) and reach 71 complete
-- recipes with typed runtime fields, without altering the 59 Vietnamese rows.
INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)
VALUES ('gl-03', 'tomato-egg-stir-fry', 'Cà chua xào trứng Trung Hoa', 'chinese', 10, 2, 'easy');
CREATE TEMP TABLE smoke_vn_recipes AS
  SELECT id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags,
    source_type, source_reference, verification_state, version
  FROM recipes WHERE cuisine = 'vietnamese';
CREATE TEMP TABLE smoke_vn_lines AS SELECT * FROM recipe_ingredients;
CREATE TEMP TABLE smoke_vn_steps AS SELECT * FROM recipe_steps;

.read migrations/0034_global_recipe_catalog_parity.sql

INSERT INTO assert_zero SELECT COUNT(*) FROM pragma_foreign_key_check;
INSERT INTO assert_zero SELECT COUNT(*) FROM pragma_integrity_check WHERE integrity_check <> 'ok';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'recipe_runtime_fields';
INSERT INTO assert_one SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'recipe_runtime_ingredient_order';
INSERT INTO assert_one SELECT COUNT(*) = 71 FROM recipes;
INSERT INTO assert_one SELECT COUNT(*) = 59 FROM recipes WHERE cuisine = 'vietnamese';
INSERT INTO assert_one SELECT COUNT(*) = 12 FROM recipes WHERE id GLOB 'gl-[0-9][0-9]';
INSERT INTO assert_one SELECT COUNT(*) = 71 FROM recipe_runtime_fields;
INSERT INTO assert_one SELECT COUNT(*) = 59 FROM recipe_runtime_fields WHERE category IS NOT NULL AND region IS NOT NULL;
INSERT INTO assert_one SELECT COUNT(*) = 12 FROM recipe_runtime_fields WHERE category IS NULL AND region IS NULL;
INSERT INTO assert_one SELECT COUNT(*) = 71 FROM recipe_runtime_fields WHERE legacy_calories IS NOT NULL;
INSERT INTO assert_one SELECT COUNT(*) FROM recipes
  WHERE id = 'gl-03' AND description IS NOT NULL AND source_type = 'legacy' AND verification_state = 'unverified' AND version = 1;
INSERT INTO assert_zero SELECT COUNT(*) FROM recipes r WHERE NOT EXISTS (SELECT 1 FROM recipe_ingredients l WHERE l.recipe_id = r.id);
INSERT INTO assert_zero SELECT COUNT(*) FROM recipes r WHERE NOT EXISTS (SELECT 1 FROM recipe_steps s WHERE s.recipe_id = r.id);
INSERT INTO assert_zero SELECT COUNT(*) FROM recipe_ingredients l WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE i.id = l.ingredient_id);
INSERT INTO assert_zero SELECT COUNT(*) FROM recipe_runtime_fields f WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = f.recipe_id);
-- Canonical runtime order is a complete 0..70 permutation; every ingredient line has exactly one ordinal.
INSERT INTO assert_one SELECT COUNT(DISTINCT runtime_order) = 71 AND MIN(runtime_order) = 0 AND MAX(runtime_order) = 70 FROM recipe_runtime_fields;
INSERT INTO assert_one SELECT COUNT(*) = 328 + 57 FROM recipe_runtime_ingredient_order;
INSERT INTO assert_zero SELECT COUNT(*) FROM recipe_ingredients l WHERE NOT EXISTS (SELECT 1 FROM recipe_runtime_ingredient_order o WHERE o.recipe_ingredient_id = l.id);
INSERT INTO assert_zero SELECT COUNT(*) FROM recipe_runtime_ingredient_order o WHERE NOT EXISTS (SELECT 1 FROM recipe_ingredients l WHERE l.id = o.recipe_ingredient_id AND l.recipe_id = o.recipe_id);
INSERT INTO assert_zero SELECT COUNT(*) FROM (SELECT recipe_id FROM recipe_runtime_ingredient_order GROUP BY recipe_id HAVING MIN(position) <> 0 OR MAX(position) <> COUNT(*) - 1);
-- Vietnamese rows, lines and steps are byte-for-byte what 0006 left.
INSERT INTO assert_zero SELECT COUNT(*) FROM (
  SELECT id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags,
    source_type, source_reference, verification_state, version FROM recipes WHERE cuisine = 'vietnamese'
  EXCEPT SELECT * FROM smoke_vn_recipes);
INSERT INTO assert_zero SELECT COUNT(*) FROM (SELECT * FROM smoke_vn_recipes EXCEPT
  SELECT id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags,
    source_type, source_reference, verification_state, version FROM recipes WHERE cuisine = 'vietnamese');
INSERT INTO assert_zero SELECT COUNT(*) FROM (SELECT * FROM smoke_vn_lines EXCEPT SELECT * FROM recipe_ingredients);
INSERT INTO assert_zero SELECT COUNT(*) FROM (SELECT * FROM smoke_vn_steps EXCEPT SELECT * FROM recipe_steps);
INSERT INTO assert_one SELECT COUNT(*) = 328 + 57 FROM recipe_ingredients;
INSERT INTO assert_one SELECT COUNT(*) = 295 + 46 FROM recipe_steps;

SELECT 'migration-smoke=ok';
SQL
