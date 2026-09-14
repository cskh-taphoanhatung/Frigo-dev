# T13 migration bridge

Production currently ends at migration `0023_scan_request_fingerprint.sql`.
That applied migration is immutable. The bridge therefore starts at `0024` and
renumbers the ten development Inventory Truth migrations contiguously through
`0033`. Renumbering changes filenames only unless local upgrade tests establish
a real production-schema incompatibility.

| Dev | Dev file | Dev blob | Purpose | Production target | Content status | Adaptation |
| --- | --- | --- | --- | --- | --- | --- |
| 0023 | `0023_inventory_truth_foundation.sql` | `1ec671af2b9d214e9d15e7921008a42873abb687` | T08 locations/lots foundation | `0024_inventory_truth_foundation.sql` | BYTE-COPIED | Filename renumber only |
| 0024 | `0024_inventory_lot_commands.sql` | `779cf2bdfd3564872ef4f36100ad67ddae37684d` | T09 commands/live lot guards | `0025_inventory_lot_commands.sql` | BYTE-COPIED | Filename renumber only |
| 0025 | `0025_inventory_event_authority.sql` | `e9204fff461bcd4ed4dac7115f750f723b291ed2` | Event authority | `0026_inventory_event_authority.sql` | BYTE-COPIED | Filename renumber only |
| 0026 | `0026_inventory_event_poststate.sql` | `b1cfb3493bea78805f47182c13c18e4c78ee3d7a` | Event post-state guards | `0027_inventory_event_poststate.sql` | BYTE-COPIED | Filename renumber only |
| 0027 | `0027_inventory_fefo_authority.sql` | `2d879eb86de4b5e88786c7cb2fb3186b62b95c12` | FEFO authority | `0028_inventory_fefo_authority.sql` | BYTE-COPIED | Filename renumber only |
| 0028 | `0028_inventory_adoption_authority.sql` | `2f8b437f2ba2686f44c79e26949a5bdf0ab258c2` | Adoption authority | `0029_inventory_adoption_authority.sql` | BYTE-COPIED | Filename renumber only |
| 0029 | `0029_inventory_fefo_backfill_compatibility.sql` | `27a78201498c3536bd30ed8725209c73ba95534e` | Backfill-compatible FEFO guards | `0030_inventory_fefo_backfill_compatibility.sql` | BYTE-COPIED | Filename renumber only |
| 0030 | `0030_inventory_observation_reconciliation.sql` | `6e323d89aaec0ae5c2873c4b7026d719338349a3` | T10 observations/reconciliation | `0031_inventory_observation_reconciliation.sql` | BYTE-COPIED | Filename renumber only |
| 0031 | `0031_scan_evidence_retention.sql` | `c580d30b589ace1102cdfda7e61bfbacc57c4253` | T13 raw evidence/review state | `0032_scan_evidence_retention.sql` | BYTE-COPIED | Filename renumber only |
| 0032 | `0032_scan_evidence_completeness.sql` | `48f26f7cca8e6aa91fdffd9e68a5f5028e4ccffe` | Raw mapping/reviewed expiry | `0033_scan_evidence_completeness.sql` | BYTE-COPIED | Filename renumber only |

## Immutable production baseline

`PRODUCTION_BASE` contains 23 migrations. Their Git blobs are the baseline table
reported by `git ls-tree -r 05423f2... migrations`; final acceptance requires
every one of those path/blob pairs to remain byte-identical and
`PRE_EXISTING_PROD_MIGRATIONS_CHANGED=0`.

Exact blobs by range: `0001`-`0006` = `9c515ceb`, `911fd88f`, `2427b9e8`,
`2b3de3c0`, `bc6c31ff`, `8ed1a156`; `0007`-`0012` = `3d3e154b`, `5e9e6a2c`,
`8980b7b6`, `f838cfc6`, `8e3ebe3a`, `896be752`; `0013`-`0018` = `b6150f0c`,
`acb5b0e3`, `6cb7e11d`, `5ccac4cd`, `06fe6f38`, `e4d1ee8d`; `0019`-`0023` =
`83d31f1d`, `6b4e49e8`, `d9294c57`, `e1d836e3`, `777f4b6f`. Full 40-character
values are reproducible with `git ls-tree -r "$PRODUCTION_BASE" migrations`.

## Required local scenarios

- Fresh replay of production plus all bridge migrations, schema gate, FK zero.
- Exact production-shaped database through `0023`, representative rows, then
  bridge-only apply with fingerprint and evidence checks.
- Populated legacy/Inventory Truth upgrade with zero fabricated evidence.
- Ledger/replay checks proving the production `0023` is not re-executed under a
  new name and no migration number collides.

## Final bridge receipt — 2026-09-15

`PRODUCTION_MIGRATION_MAX=23`; `BRIDGE_START=24`. Candidate
`e34ed16777166407acf67b2c76d733d89c7d64ca` contains 33 unique contiguous
migrations. The ten target blobs at `0024`-`0033` exactly match the certified
T13 source blobs: `1ec671af...`, `779cf2bd...`, `e9204fff...`, `b1cfb349...`,
`2d879eb8...`, `2f8b437f...`, `27a78201...`, `6e323d89...`, `c580d30b...`,
and `48f26f7c...`; `BRIDGE_BLOB_MISMATCHES=0`.

The complete immutable production `0001`-`0023` path/blob table was captured by
`git ls-tree` at the candidate and compared byte-for-byte:
`PRE_EXISTING_PROD_MIGRATIONS_CHANGED=0`. Fresh install, production-shaped
upgrade, populated legacy upgrade, schema/integrity, FK, and replay checks pass.
Legacy non-null `scan_items.confidence` remains a compatibility filler; nullable
`ocr_confidence` remains the T13 truth and is not fabricated during upgrade.
