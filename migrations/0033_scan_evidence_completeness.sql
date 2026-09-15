-- T13R-A additive scan-evidence completeness (0032). Migrations 0001-0031 are
-- immutable; this migration only adds nullable columns to scan_items.
--
-- WHY_EXISTING_SCHEMA_INSUFFICIENT
--   1. Raw mapping evidence (independent review P2-2). 0031 retains the raw
--      name/quantity/unit/confidence, but confirmation still rewrites
--      scan_items.canonical_id/category/storage in place, so the ingested
--      canonical mapping, category and storage are destroyed. Nothing else
--      holds them: inventory_observations.evidence is a five-value quality
--      enum, and the T09 command fingerprint retains only the name/quantity/
--      unit comparison the confirmation itself composed. A storage-only or
--      category-only correction is therefore unexplainable after the fact.
--   2. Reviewed expiry (independent review P2-3). Confirmation maps the
--      reviewer's expiry into the lot authority but never records what was
--      accepted on the scan line, so a reopened confirmed review shows
--      "unknown" for a date the stock actually carries as KNOWN. The lot is
--      not a substitute: a rejected or grouped line has no lot of its own,
--      and the review must report the review, not re-derive it from stock.
--
-- NULL means unknown. No backfill: rows written before this migration lost
-- their original mapping at confirmation (or never recorded it), and the
-- reviewer's expiry basis for a pre-0032 confirmation is genuinely unknown.
-- Fabricating either from the mutable working columns would be false
-- evidence. These columns are evidence only; no reader treats them as stock
-- authority (T09 write / T11 read authority are unchanged).
ALTER TABLE scan_items ADD COLUMN ocr_canonical_id TEXT REFERENCES ingredients(id);
ALTER TABLE scan_items ADD COLUMN ocr_category TEXT;
ALTER TABLE scan_items ADD COLUMN ocr_storage TEXT
  CHECK (ocr_storage IS NULL OR ocr_storage IN ('fridge', 'freezer', 'pantry'));

-- What the reviewer accepted for this line at confirmation. Present only for
-- CONFIRMED lines; a REJECTED or PENDING line has no accepted expiry. A date
-- must be a real calendar day: date() normalises an impossible day, so an
-- unchanged round-trip proves validity. `IS` keeps the comparison two-valued.
ALTER TABLE scan_items ADD COLUMN reviewed_expiry_date TEXT
  CHECK (reviewed_expiry_date IS NULL
    OR (length(reviewed_expiry_date) = 10 AND date(reviewed_expiry_date) IS reviewed_expiry_date));
ALTER TABLE scan_items ADD COLUMN reviewed_expiry_kind TEXT
  CHECK (reviewed_expiry_kind IS NULL OR reviewed_expiry_kind IN ('KNOWN', 'ESTIMATED', 'UNKNOWN'));

-- The kind/date pairing is the same invariant the lot authority enforces:
-- KNOWN and ESTIMATED carry a date, UNKNOWN carries none, and only a
-- CONFIRMED line carries a reviewed kind at all. ADD COLUMN evaluates a CHECK
-- against existing rows, so the cross-column coupling lives in fail-closed
-- triggers (the technique 0019 and 0031 already use). Every sub-expression
-- uses IS / IS NOT so a NULL never makes the WHEN clause silently false.
CREATE TRIGGER trg_scan_items_reviewed_expiry_insert BEFORE INSERT ON scan_items
WHEN NOT (
  (NEW.reviewed_expiry_kind IS NULL AND NEW.reviewed_expiry_date IS NULL)
  OR (NEW.reviewed_expiry_kind IS 'UNKNOWN' AND NEW.reviewed_expiry_date IS NULL)
  OR ((NEW.reviewed_expiry_kind IS 'KNOWN' OR NEW.reviewed_expiry_kind IS 'ESTIMATED')
      AND NEW.reviewed_expiry_date IS NOT NULL)
) OR (NEW.reviewed_expiry_kind IS NOT NULL AND NEW.review_state IS NOT 'CONFIRMED')
BEGIN
  SELECT RAISE(ABORT, 'scan_items.reviewed_expiry must be a CONFIRMED KNOWN/ESTIMATED date or UNKNOWN without a date');
END;

CREATE TRIGGER trg_scan_items_reviewed_expiry_update
BEFORE UPDATE OF reviewed_expiry_date, reviewed_expiry_kind, review_state ON scan_items
WHEN NOT (
  (NEW.reviewed_expiry_kind IS NULL AND NEW.reviewed_expiry_date IS NULL)
  OR (NEW.reviewed_expiry_kind IS 'UNKNOWN' AND NEW.reviewed_expiry_date IS NULL)
  OR ((NEW.reviewed_expiry_kind IS 'KNOWN' OR NEW.reviewed_expiry_kind IS 'ESTIMATED')
      AND NEW.reviewed_expiry_date IS NOT NULL)
) OR (NEW.reviewed_expiry_kind IS NOT NULL AND NEW.review_state IS NOT 'CONFIRMED')
BEGIN
  SELECT RAISE(ABORT, 'scan_items.reviewed_expiry must be a CONFIRMED KNOWN/ESTIMATED date or UNKNOWN without a date');
END;
