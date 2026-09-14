# Production integration candidate

This packet records the semantic integration of the current production line,
the production Qwen runtime candidate, certified T13 Inventory Truth, and the
hardened Takosan application. It is an integration-review artifact only.

## Fixed authorities

| Field | Value |
| --- | --- |
| Production repository | `Tungjpstore/Frigo` |
| Production repository ID | `1360256196` |
| Production default branch | `main` |
| `PRODUCTION_BASE` | `05423f2ad675006a4c7913e696f1979b3fcaae59` |
| Qwen source | `da41686bb8613af9d0a487496d72479d04cb0d70` |
| Development repository | `vn-dlo/Frigo-dev` |
| Development repository ID | `1368281478` |
| `COMMON_BASE` | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| T13 application freeze | `32ddbb4f2bb636fdcf201e9ca99c4689d3655477` |
| T13 review #2 | `9c3c3d3b842685f1b8ad82746621f4f5c41962f1` |
| Takosan application source | `ff63edfbde2857769d466b232d96b432c67f02d2` |
| Takosan docs source | `60ab7d40649084ac046f0f941571d4bb517dcaf8` |
| Integration branch | `integration/t13-takosan-qwen` |

The production branch is not merged or modified by this work. Deployment,
remote D1, production R2/KV/queues, secrets, PayOS, and T14 are out of scope.

## Execution order

1. Preserve production migration blobs and integrate the Qwen lineage.
2. Renumber the ten T13 migrations above production migration `0023`.
3. Merge T13/Takosan semantically and resolve the nine overlapping paths.
4. Prove provider evidence survives the real queue consumer and T09/T11 remain
   the only mutation/read authorities.
5. Run local migration, static, full Vitest, and browser gates in that order.
6. Publish only the integration branch after the required gates pass.

See `PRODUCTION_CONSOLIDATION.md`, `T13_MIGRATION_BRIDGE.md`, `TEST_MATRIX.md`,
and `HANDOFF.md` for the final evidence.

## Final certification — 2026-09-15

Status: **PRODUCTION INTEGRATION CANDIDATE CERTIFIED LOCALLY — READY FOR
INDEPENDENT INTEGRATION REVIEW**.

| Field | Value |
| --- | --- |
| `PRODUCTION_BASE` | `05423f2ad675006a4c7913e696f1979b3fcaae59` |
| `COMMON_BASE` | `d1b06732f8a80db4e77986df31ff28d9f04641fa` |
| Qwen source | `da41686bb8613af9d0a487496d72479d04cb0d70` |
| T13 freeze / review | `32ddbb4f2bb636fdcf201e9ca99c4689d3655477` / `9c3c3d3b842685f1b8ad82746621f4f5c41962f1` |
| Takosan source | `ff63edfbde2857769d466b232d96b432c67f02d2` |
| Application candidate | `e34ed16777166407acf67b2c76d733d89c7d64ca` |

Production repository identity is verified as `Tungjpstore/Frigo`, ID
`1360256196`; development identity is `vn-dlo/Frigo-dev`, ID `1368281478`.
Production `main` remains at `PRODUCTION_BASE`. The candidate preserves the
Qwen runtime, T13 evidence/authority chain, Takosan shell, and immutable
production migration `0023`; T13 migrations are byte-identical at `0024`-`0033`.

Local gates are green: frozen install, lint, typecheck, migration smoke, build,
full Vitest `3628/3628` (149 files), real local D1 `92/92` (5 files), and browser
`60/60` (serial, widths 360/390/430). Production migration changes `0`, bridge
blob mismatches `0`, and unknown inventory writers/readers `0/0`.

P3-1 and P3-2 remain intentionally unchanged. No deployment, main merge, remote
D1/R2/KV/queue mutation, PayOS/payment change, secret/DNS change, or T14 work
occurred.

**NO HOSTED GITHUB CI STATUS FOR INTEGRATION_APPLICATION_CANDIDATE**
