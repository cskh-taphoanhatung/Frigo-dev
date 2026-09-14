-- T08 foundation only. Legacy readers, writers and event history are unchanged.
-- Backfill is explicitly invoked through the validated repository adapter.
CREATE TABLE storage_locations (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(trim(id)) > 0),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('FRIDGE', 'FREEZER', 'PANTRY')),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0 AND sort_order <= 9007199254740991),
  is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, household_id)
);
CREATE UNIQUE INDEX idx_storage_locations_default
  ON storage_locations(household_id, type) WHERE is_default = 1;

CREATE TABLE inventory_lots (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(trim(id)) > 0),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  ingredient_id TEXT REFERENCES ingredients(id),
  raw_name TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL
    CHECK (typeof(quantity_milli) = 'integer' AND quantity_milli >= 0 AND quantity_milli <= 9007199254740991),
  canonical_unit TEXT NOT NULL CHECK (canonical_unit IN ('g', 'ml', 'piece', 'pack', 'bunch', 'slice')),
  storage_location_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'CONSUMED', 'DISCARDED')),
  purchased_at TEXT,
  opened_at TEXT,
  expiry_at TEXT,
  estimated_expiry_at TEXT,
  expiry_kind TEXT NOT NULL CHECK (expiry_kind IN ('KNOWN', 'BEST_BEFORE', 'USE_BY', 'ESTIMATED', 'UNKNOWN')),
  source_type TEXT NOT NULL CHECK (source_type IN ('LEGACY_BACKFILL', 'MANUAL', 'SCAN', 'SHOPPING', 'RECEIPT')),
  source_id TEXT CHECK (source_id IS NULL OR (length(trim(source_id)) > 0 AND instr(source_id, char(0)) = 0)),
  version INTEGER NOT NULL DEFAULT 1
    CHECK (typeof(version) = 'integer' AND version >= 1 AND version <= 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  currency TEXT,
  amount_minor INTEGER,
  minor_digits INTEGER,
  legacy_expiry_at TEXT,
  legacy_expiry_kind TEXT,
  legacy_expiry_source TEXT,
  legacy_opened_at TEXT,
  legacy_version INTEGER CHECK (legacy_version IS NULL OR (typeof(legacy_version) = 'integer' AND legacy_version >= 1 AND legacy_version <= 9007199254740991)),
  FOREIGN KEY (storage_location_id, household_id) REFERENCES storage_locations(id, household_id),
  CHECK (source_type = 'MANUAL' OR source_id IS NOT NULL),
  CHECK (source_type <> 'LEGACY_BACKFILL' OR legacy_version IS NOT NULL),
  CHECK (
    (expiry_kind = 'UNKNOWN' AND expiry_at IS NULL AND estimated_expiry_at IS NULL)
    OR (expiry_kind = 'ESTIMATED' AND expiry_at IS NULL AND estimated_expiry_at IS NOT NULL)
    OR (expiry_kind IN ('KNOWN', 'BEST_BEFORE', 'USE_BY') AND expiry_at IS NOT NULL AND estimated_expiry_at IS NULL)
  ),
  CHECK (expiry_at IS NULL OR (expiry_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(expiry_at, '+0 days') IS expiry_at)),
  CHECK (estimated_expiry_at IS NULL OR (estimated_expiry_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(estimated_expiry_at, '+0 days') IS estimated_expiry_at)),
  CHECK (purchased_at IS NULL OR (purchased_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(purchased_at, '+0 days') IS purchased_at)),
  CHECK (
    (currency IS NULL AND amount_minor IS NULL AND minor_digits IS NULL)
    OR (currency IS NOT NULL AND amount_minor IS NOT NULL AND minor_digits IS NOT NULL
      AND typeof(amount_minor) = 'integer' AND amount_minor >= 0 AND amount_minor <= 9007199254740991
      AND typeof(minor_digits) = 'integer'
      AND ((currency IN ('VND', 'JPY') AND minor_digits = 0) OR (currency IN ('USD', 'EUR') AND minor_digits = 2)))
  )
);

-- Legacy item IDs are global; no FK to old rows, whose deletion must stay legal.
CREATE UNIQUE INDEX idx_inventory_lots_legacy_source
  ON inventory_lots(source_id) WHERE source_type = 'LEGACY_BACKFILL';
CREATE INDEX idx_inventory_lots_household_location
  ON inventory_lots(household_id, storage_location_id);
CREATE INDEX idx_inventory_lots_ingredient ON inventory_lots(ingredient_id);
