# Integration test matrix

| Gate | Required evidence | Status |
| --- | --- | --- |
| Production migration hashes | 23 existing path/blob pairs unchanged | PENDING |
| Fresh install | All 33 migrations, schema PASS, FK 0 | PENDING |
| Production-shaped upgrade | Apply 0001-0023, seed, apply 0024-0033 | PENDING |
| Legacy/populated upgrade | No fabricated evidence or row loss | PENDING |
| Queue evidence | Missing, 0, .11, .9 through `processScanJob` | PENDING |
| Fingerprint + T13 confirm | Fingerprint retained | PENDING |
| Replay/idempotency | No duplicate T09 lot/event effects | PENDING |
| Receipt/fridge provenance | Survives async queue | PENDING |
| T09/T11 authority audit | Unknown writers/readers 0/0 | PENDING |
| Takosan shell/brand | Brand unit tests and assets | PENDING |
| Static/build | diff, frozen install, lint, typecheck, build | PENDING |
| Full Vitest | No material test-count regression | PENDING |
| Browser last | 60 cases at 360/390/430 | PENDING |

No paid provider or production resource is used by this matrix.
