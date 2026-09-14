# T13 migration bridge

Production currently ends at migration `0023_scan_request_fingerprint.sql`.
That applied migration is immutable. The bridge therefore starts at `0024` and
renumbers the ten development Inventory Truth migrations contiguously through
`0033`. Renumbering changes filenames only unless local upgrade tests establish
a real production-schema incompatibility.

| Dev | Dev file | Dev blob | Purpose | Production target | Content status | Adaptation |
| --- | --- | --- | --- | --- | --- | --- |
| 0023 | `0023_inventory_truth_foundation.sql` | `1ec671af2b9d214e9d15e7921008a42873abb687` | T08 locations/lots foundation | `0024_inventory_truth_foundation.sql` | BYTE-COPIED planned | Filename renumber only |
| 0024 | `0024_inventory_lot_commands.sql` | `779cf2bdfd3564872ef4f36100ad67ddae37684d` | T09 commands/live lot guards | `0025_inventory_lot_commands.sql` | BYTE-COPIED planned | Filename renumber only |
| 0025 | `0025_inventory_event_authority.sql` | `e9204fff461bcd4ed4dac7115f750f723b291ed2` | Event authority | `0026_inventory_event_authority.sql` | BYTE-COPIED planned | Filename renumber only |
| 0026 | `0026_inventory_event_poststate.sql` | `b1cfb3493bea78805f47182c13c18e4c78ee3d7a` | Event post-state guards | `0027_inventory_event_poststate.sql` | BYTE-COPIED planned | Filename renumber only |
| 0027 | `0027_inventory_fefo_authority.sql` | `2d879eb86de4b5e88786c7cb2fb3186b62b95c12` | FEFO authority | `0028_inventory_fefo_authority.sql` | BYTE-COPIED planned | Filename renumber only |
| 0028 | `0028_inventory_adoption_authority.sql` | `2f8b437f2ba2686f44c79e26949a5bdf0ab258c2` | Adoption authority | `0029_inventory_adoption_authority.sql` | BYTE-COPIED planned | Filename renumber only |
| 0029 | `0029_inventory_fefo_backfill_compatibility.sql` | `27a78201498c3536bd30ed8725209c73ba95534e` | Backfill-compatible FEFO guards | `0030_inventory_fefo_backfill_compatibility.sql` | BYTE-COPIED planned | Filename renumber only |
| 0030 | `0030_inventory_observation_reconciliation.sql` | `6e323d89aaec0ae5c2873c4b7026d719338349a3` | T10 observations/reconciliation | `0031_inventory_observation_reconciliation.sql` | BYTE-COPIED planned | Filename renumber only |
| 0031 | `0031_scan_evidence_retention.sql` | `c580d30b589ace1102cdfda7e61bfbacc57c4253` | T13 raw evidence/review state | `0032_scan_evidence_retention.sql` | BYTE-COPIED planned | Filename renumber only |
| 0032 | `0032_scan_evidence_completeness.sql` | `48f26f7cca8e6aa91fdffd9e68a5f5028e4ccffe` | Raw mapping/reviewed expiry | `0033_scan_evidence_completeness.sql` | BYTE-COPIED planned | Filename renumber only |

## Immutable production baseline

`PRODUCTION_BASE` contains 23 migrations. Their Git blobs are the baseline table
reported by `git ls-tree -r 05423f2... migrations`; final acceptance requires
every one of those path/blob pairs to remain byte-identical and
`PRE_EXISTING_PROD_MIGRATIONS_CHANGED=0`.

## Required local scenarios

- Fresh replay of production plus all bridge migrations, schema gate, FK zero.
- Exact production-shaped database through `0023`, representative rows, then
  bridge-only apply with fingerprint and evidence checks.
- Populated legacy/Inventory Truth upgrade with zero fabricated evidence.
- Ledger/replay checks proving the production `0023` is not re-executed under a
  new name and no migration number collides.
