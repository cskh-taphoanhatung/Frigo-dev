WITH
required_migrations(name) AS (
  VALUES
    ('0001_initial_schema.sql'),
    ('0002_seed_data.sql'),
    ('0003_weekly_planner.sql'),
    ('0004_auth_system.sql'),
    ('0005_meal_plans_relational.sql'),
    ('0006_vietnamese_recipe_bank.sql'),
    ('0007_week_integrity.sql'),
    ('0008_week_snapshot_metadata.sql'),
    ('0009_inventory_optimistic_version.sql'),
    ('0010_week_schema_shadow_canonical.sql'),
    ('0011_meal_plan_tenant_ownership.sql'),
    ('0012_scan_queue_jobs.sql'),
    ('0013_scan_receipt_metadata.sql'),
    ('0014_scan_queue_fencing.sql'),
    ('0015_auth_session_otp_hardening.sql'),
    ('0016_scan_quota_ledger.sql'),
    ('0017_auth_otps_remove_plaintext.sql'),
    -- Payment migration remains immutable/protected, but it is part of the
    -- production ledger and must be present for an exact schema check.
    ('0018_payments.sql'),
    ('0019_recipe_domain_foundation.sql'),
    ('0020_t01_foundation_hardening.sql'),
    ('0021_recipe_personalization.sql'),
    ('0022_generated_meal_plans.sql'),
    ('0023_scan_request_fingerprint.sql'),
    ('0024_inventory_truth_foundation.sql'),
    ('0025_inventory_lot_commands.sql'),
    ('0026_inventory_event_authority.sql'),
    ('0027_inventory_event_poststate.sql'),
    ('0028_inventory_fefo_authority.sql'),
    ('0029_inventory_adoption_authority.sql'),
    ('0030_inventory_fefo_backfill_compatibility.sql'),
    ('0031_inventory_observation_reconciliation.sql'),
    ('0032_scan_evidence_retention.sql'),
    ('0033_scan_evidence_completeness.sql'),
    ('0034_global_recipe_catalog_parity.sql'),
    ('0035_recipe_media_layer.sql'),
    -- T14F: reviewed catalog growth (data-only, additive).
    ('0036_recipe_catalog_pilot.sql')
),
required_tables(name) AS (
  VALUES
    ('users'),
    ('households'),
    ('inventory_items'),
    ('inventory_events'),
    ('inventory_commands'),
    ('inventory_lots'),
    ('storage_locations'),
    ('inventory_observations'),
    ('inventory_reconciliation_decisions'),
    ('scans'),
    ('meal_plans'),
    ('shopping_import_commands'),
    ('meal_plan_days_v2'),
    ('meal_plan_slots_v2'),
    ('meal_plan_shopping_items_v2')
    ,('scan_queue_jobs')
    ,('sessions_v2')
    ,('auth_otps')
    ,('scan_quota_periods')
    ,('scan_quota_ledger')
    ,('measurement_units')
    ,('ingredient_tags')
    ,('ingredient_storage_guidelines')
    ,('nutrition_profiles')
    ,('ingredient_nutrition')
    ,('recipe_families')
    ,('recipe_family_slots')
    ,('recipe_family_options')
    ,('recipe_nutrition')
    ,('recipe_classifications')
    ,('recipe_runtime_fields')
    ,('recipe_runtime_ingredient_order')
    ,('recipe_media')
    ,('household_ranking_preferences')
    ,('member_ranking_preferences')
    ,('recipe_feedback_events')
    ,('generated_meal_plans')
    ,('generated_meal_plan_annotations')
),
required_columns(table_name, column_name) AS (
  VALUES
    ('inventory_items', 'version'),
    ('households', 'inventory_version'),
    ('inventory_events', 'command_id'),
    ('inventory_lots', 'legacy_item_id'),
    ('inventory_lots', 'quantity_milli'),
    ('inventory_lots', 'canonical_unit'),
    ('inventory_lots', 'storage_location_id'),
    ('inventory_lots', 'source_id'),
    ('inventory_lots', 'version'),
    ('inventory_items', 'opened_at'),
    ('inventory_items', 'expiry_kind'),
    ('inventory_items', 'expiry_source'),
    ('ingredients', 'default_name'),
    ('ingredients', 'subcategory'),
    ('ingredients', 'allergen_review_state'),
    ('ingredient_aliases', 'language'),
    ('ingredient_aliases', 'normalized_alias'),
    ('recipes', 'family_id'),
    ('recipes', 'prep_time_minutes'),
    ('recipes', 'source_type'),
    ('recipes', 'source_reference'),
    ('recipes', 'verification_state'),
    ('recipes', 'version'),
    ('meal_plans', 'snapshot_json'),
    ('shopping_import_commands', 'request_fingerprint'),
    ('shopping_import_commands', 'lock_token'),
    ('meal_plan_days_v2', 'day_type'),
    ('meal_plan_days_v2', 'snapshot_json'),
    ('meal_plan_slots_v2', 'source'),
    ('meal_plan_slots_v2', 'is_locked'),
    ('meal_plan_slots_v2', 'leftover_source_id'),
    ('meal_plan_slots_v2', 'snapshot_json'),
    ('meal_plan_shopping_items_v2', 'required_quantity'),
    ('meal_plan_shopping_items_v2', 'inventory_quantity'),
    ('meal_plan_shopping_items_v2', 'missing_quantity'),
    ('meal_plan_shopping_items_v2', 'purchase_quantity'),
    ('meal_plan_shopping_items_v2', 'estimated_price_min'),
    ('meal_plan_shopping_items_v2', 'estimated_price_max'),
    ('meal_plan_shopping_items_v2', 'snapshot_json')
    ,('scan_queue_jobs', 'status')
    ,('scan_queue_jobs', 'attempts')
    ,('scan_queue_jobs', 'max_attempts')
    ,('scan_queue_jobs', 'idempotency_key')
    ,('scan_queue_jobs', 'claim_token')
    ,('scan_queue_jobs', 'claim_attempt')
    ,('sessions_v2', 'token_hash')
    ,('sessions_v2', 'revoked_at')
    ,('auth_otps', 'code_digest')
    ,('auth_otps', 'digest_version')
    ,('auth_otps', 'attempt_count')
    ,('auth_otps', 'locked_until')
    ,('auth_otps', 'used_at')
    ,('scan_quota_ledger', 'idempotency_key')
    ,('scan_quota_ledger', 'status')
    ,('scan_quota_periods', 'used_count')
    ,('scans', 'merchant_name')
    ,('scans', 'invoice_number')
    ,('scans', 'purchase_date')
    ,('scans', 'total_amount_vnd')
    ,('scan_items', 'unit_price_vnd')
    ,('scan_items', 'total_price_vnd')
    ,('scans', 'request_fingerprint')
    ,('scans', 'image_mime_type')
    -- T13 bridge (0032): raw OCR/vision evidence retained separately from the
    -- reviewable values, plus the explicit per-line review lifecycle.
    ,('scan_items', 'ocr_raw_name')
    ,('scan_items', 'ocr_quantity')
    ,('scan_items', 'ocr_unit')
    ,('scan_items', 'ocr_confidence')
    ,('scan_items', 'review_state')
    -- T13R-A bridge (0033): complete raw mapping evidence and reviewed expiry.
    ,('scan_items', 'ocr_canonical_id')
    ,('scan_items', 'ocr_category')
    ,('scan_items', 'ocr_storage')
    ,('scan_items', 'reviewed_expiry_date')
    ,('scan_items', 'reviewed_expiry_kind')
    -- T14B-B (0034): persisted canonical runtime order and explicit ingredient ordinals.
    ,('recipe_runtime_fields', 'runtime_order')
    ,('recipe_runtime_ingredient_order', 'position')
    -- T14C (0035): versioned media metadata; bytes live in R2 under the trusted storage_key.
    ,('recipe_media', 'role')
    ,('recipe_media', 'version')
    ,('recipe_media', 'status')
    ,('recipe_media', 'storage_key')
    ,('recipe_media', 'content_hash')
),
-- Indexes and triggers share one sqlite_master lookup: D1 (workerd) caps compound SELECTs at
-- 5 terms (SQLITE_LIMIT_COMPOUND_SELECT), so the gate must stay at five UNION ALL branches.
required_schema_objects(type, name) AS (
  VALUES
    -- T14C (0035): at most one current-ready version per recipe/role; bounded bulk lookups.
    ('index', 'idx_recipe_media_current_ready'),
    ('index', 'idx_recipe_media_recipe_role_status'),
    ('index', 'idx_recipe_media_content_hash'),
    ('trigger', 'trg_meal_plans_household_immutable'),
    -- T14C (0035): ready media versions are immutable.
    ('trigger', 'trg_recipe_media_ready_immutable_update'),
    -- T13 (0031): CONFIRMED review state and is_confirmed must stay one fact.
    ('trigger', 'trg_scan_items_review_state_insert'),
    ('trigger', 'trg_scan_items_review_state_update'),
    -- T13R-A (0032): reviewed expiry kind/date pairing is fail-closed.
    ('trigger', 'trg_scan_items_reviewed_expiry_insert'),
    ('trigger', 'trg_scan_items_reviewed_expiry_update'),
    ('trigger', 'trg_inventory_commands_immutable_update'),
    ('trigger', 'trg_inventory_commands_immutable_insert'),
    ('trigger', 'trg_inventory_commands_immutable_delete'),
    ('trigger', 'trg_inventory_lots_live_insert'),
    ('trigger', 'trg_inventory_lots_no_live_replace'),
    ('trigger', 'trg_inventory_lots_backfill_after_live'),
    ('trigger', 'trg_inventory_lots_live_update'),
    ('trigger', 'trg_inventory_lots_live_delete'),
    ('trigger', 'trg_inventory_items_projection_owner'),
    ('trigger', 'trg_inventory_items_projection_replace'),
    ('trigger', 'trg_inventory_events_command_insert'),
    ('trigger', 'trg_inventory_events_command_authority_insert'),
    ('trigger', 'trg_inventory_events_command_poststate_insert'),
    ('trigger', 'trg_inventory_commands_fefo_authority_insert'),
    ('trigger', 'trg_inventory_commands_fefo_envelope_insert'),
    ('trigger', 'trg_inventory_events_command_fefo_authority_insert'),
    ('trigger', 'trg_inventory_observations_immutable_update'),
    ('trigger', 'trg_inventory_observations_immutable_delete'),
    ('trigger', 'trg_inventory_observations_lot_household_insert'),
    ('trigger', 'trg_inventory_observations_lot_household_update'),
    ('trigger', 'trg_inventory_observations_projection_household_insert'),
    ('trigger', 'trg_inventory_reconciliation_decisions_observation_guard'),
    ('trigger', 'trg_inventory_reconciliation_decisions_immutable_update'),
    ('trigger', 'trg_inventory_reconciliation_decisions_immutable_delete'),
    ('trigger', 'trg_inventory_events_command_update'),
    ('trigger', 'trg_inventory_events_command_replace'),
    ('trigger', 'trg_inventory_events_command_delete'),
    ('trigger', 'trg_inventory_items_revision_insert'),
    ('trigger', 'trg_inventory_items_revision_update'),
    ('trigger', 'trg_inventory_items_revision_delete'),
    ('trigger', 'trg_inventory_lots_revision_insert'),
    ('trigger', 'trg_inventory_lots_revision_update'),
    ('trigger', 'trg_inventory_lots_revision_delete'),
    ('trigger', 'trg_storage_locations_revision_insert'),
    ('trigger', 'trg_storage_locations_revision_update'),
    ('trigger', 'trg_storage_locations_revision_delete'),
    ('trigger', 'trg_ingredients_canonical_id_insert'),
    ('trigger', 'trg_ingredients_canonical_id_update'),
    ('trigger', 'trg_recipe_nutrition_version_insert'),
    ('trigger', 'trg_recipe_nutrition_version_update'),
    ('trigger', 'trg_recipes_nutrition_version_insert'),
    ('trigger', 'trg_recipes_nutrition_version_update'),
    ('trigger', 'trg_recipes_source_reference_insert'),
    ('trigger', 'trg_recipes_source_reference_update'),
    ('trigger', 'trg_recipe_families_source_reference_insert'),
    ('trigger', 'trg_recipe_families_source_reference_update')
)
SELECT 'missing_migration' AS issue, migration.name AS detail
FROM required_migrations migration
WHERE NOT EXISTS (
  SELECT 1 FROM d1_migrations applied WHERE applied.name = migration.name
)
UNION ALL
SELECT 'missing_table', required.name
FROM required_tables required
WHERE NOT EXISTS (
  SELECT 1
  FROM sqlite_master existing
  WHERE existing.type = 'table' AND existing.name = required.name
)
UNION ALL
SELECT 'missing_column', required.table_name || '.' || required.column_name
FROM required_columns required
WHERE NOT EXISTS (
  SELECT 1
  FROM pragma_table_info(required.table_name) column_info
  WHERE column_info.name = required.column_name
)
UNION ALL
SELECT 'missing_' || required.type, required.name
FROM required_schema_objects required
WHERE NOT EXISTS (
  SELECT 1 FROM sqlite_master
  WHERE type = required.type AND name = required.name
)
UNION ALL
SELECT 'foreign_key_violation',
       foreign_keys."table" || '[rowid=' || foreign_keys.rowid || '] -> ' || foreign_keys.parent
FROM pragma_foreign_key_check foreign_keys
ORDER BY issue, detail;
