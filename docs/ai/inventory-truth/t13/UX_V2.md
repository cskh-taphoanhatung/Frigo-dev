# T13 Inventory UX V2

**T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW.** This describes frozen
application `7b7bb695ee597a46cf4022a2c534e2fea374be5d`, including the separate U7
metadata fix `47b10e25d6853a9bc4f9dfcf2e83bc01ba330bf2`. The UI distinguishes
known facts, estimates and unknowns; it never grants stock authority to evidence.

## Current surfaces

| Route | Current behavior |
| --- | --- |
| `/inventory` (`/fridge`) | Inventory list; UNKNOWN distinct from fresh; adopted stock read through T11 |
| `/ingredients/:id` | Lot provenance, expiry kind/date, opened/purchased facts, ID/version; existing-lot metadata editor |
| `/scan/receipt-review?scanId=…` | Receipt confidence and missing facts; per-line name/quantity/unit/storage/expiry edits and explicit reject |
| Fridge scan review (`ScanResultPage.tsx`) | Same reviewed fields and reject; route/session-owned hydration and terminal confirmed state |
| `/inventory-reconciliation` | T10 evidence, verdict/reasons and server-derived accept/dismiss actions |

## Presentation truth

Shared rules live in `src/web/lib/inventory-truth.ts`.

| Helper / state | Rule |
| --- | --- |
| `presentExpiry()` | UNKNOWN → “Chưa rõ hạn”, never fresh or a fabricated date; ESTIMATED explicitly marked; known dates remain dated facts |
| `presentConfidence()` | Missing confidence says unknown; real zero/low values remain visible, not raised to a reassuring floor |
| `presentPrice()` | Missing price stays absent, not `0₫`; a genuinely supplied zero is valid |
| `presentPurchaseDate()` | Missing date → “Không rõ ngày mua”, never today |
| `provenanceLabel()` | RECEIPT → “Từ hóa đơn”; SCAN → “Từ ảnh quét”; legacy → “Dữ liệu cũ” |
| `presentDomainError()` | Specific safe Vietnamese messages from `ApiError.code`; unknown errors use a safe generic fallback, not private backend text/raw JSON |

A receipt without a supplied expiry is ESTIMATED when there is a sanctioned
estimate basis, otherwise UNKNOWN. An explicit user-entered expiry date may be
KNOWN. Merely saving another field must not promote an existing estimate.

## Review lifecycle and ownership

Actual persisted line states are **PENDING / CONFIRMED / REJECTED**.
`corrected` is metadata derived by `correctionOf()`, not a fourth lifecycle state.
A rejected line retains raw/review evidence but creates no stock command or stock
observation. Corrected accepted values remain distinguishable from raw OCR.

The route's scan ID is authoritative over a stale Zustand scan. A→B→A navigation
cannot display or submit another scan's evidence; mismatched response IDs are
rejected. Private-session generation, logout/account switch and unmount fence
late GET/POST results so they cannot restore old private state, clear a newer
review or navigate it away.

Confirmed reviews are terminal/read-only, including empty and all-rejected scans:

- Completed wording counts accepted lines, not rejected ones; no “cần kiểm tra”
  or instruction to edit a completed review.
- Persisted fields and reject controls are disabled; manual addition and confirm
  CTA are absent.
- “Xem tủ lạnh” navigates without mutation. Returning through same-document
  A→B→A or remount does not re-enable the completed review.

## Existing-lot metadata editor (U7/U8)

`IngredientDetailPage.tsx` now edits **name, unit, category, storage and expiry**
on an existing lot. The original U7 gap was proven by the new browser test before
the separate fix; this is not only receipt-line editing.

The editor takes a draft snapshot and submits only dirty fields through the
existing versioned PATCH → T09 `CORRECT` / `MOVE` adapters. Unchanged/reverted
and canceled drafts do not mutate; invalid blank names are rejected. Unrelated
quantity, canonical identity, provenance and purchase facts are preserved.
Compatible unit conversion is **backend-owned**; the client does not invent a
conversion factor or rewrite canonical stock while changing display metadata.

Browser U7 first submits an incompatible unit and receives real
`422 UNIT_MISMATCH`: stock is unchanged, the safe draft is retained, and there is
no automatic retry/refetch. A user-chosen compatible unit then saves successfully
with name/category/storage/explicit expiry. T11 reread confirms the same lot,
source and canonical quantity/unit, plus the updated metadata and newer version.

## Errors, refetch and retry

`CONFLICT` and `IDEMPOTENCY_CONFLICT` produce readable messages and refetch
canonical state; a refetch is not an automatic mutation retry. `UNIT_MISMATCH`
keeps safe edits available without replacing them or retrying the command.
Generic 500 handling neither exposes private backend details nor resubmits.

Browser G creates a real competing PATCH, then submits the stale UI edit once.
The server returns `409 CONFLICT`; the UI displays the safe message and refetches
canonical quantity 7 without a second PATCH. Unit tests also cover failed conflict
refresh and explicit retry-load behavior, which must not repeat confirmation.

## Reconciliation and adoption

Reconciliation cards show the recorded claim, source, deterministic T10 verdict
and reasons. “Áp dụng” is disabled when no safe proposal exists. When enabled,
the frontend sends intent; T10 re-derives/revalidates it and composes T09 commands.
The final browser suite clicks a real actionable proposal: egg quantity becomes 5.
It then dismisses tofu evidence; the card closes while quantity remains 200.
The earlier limitation “accept tested only via API” no longer applies.

Adoption is the documented explicit operator path `scripts/inventory-adopt.mjs`,
not automatic activation during reads. The actual executable checks `--apply`,
requested household/session identity, existing CSRF policy and terminal evidence.
Browser I exercises refusal, successful adoption and explicit replay with synthetic
session credentials passed via stdin only; see [CONTINUATION.md](CONTINUATION.md).

## Fresh browser evidence

The repository-owned Playwright harness ran **12 cases at each of 360×844,
390×844 and 430×844**, **36/36 before freeze and 36/36 serially from the detached
freeze**. These are actual mobile Chromium viewport checks, not physical-device
certification and not the old 1440px computed-width proxy. Assertions cover
`innerWidth`, horizontal overflow, control bounds and reachability alongside real
UI actions and canonical API rereads. Synthetic screenshots are retained privately.

| Flow | Final browser proof |
| --- | --- |
| A receipt | Edited review, raw evidence/rejection, RECEIPT lot, supplied/missing facts and confidence |
| B existing + receipt | Separate receipt lot 2 beside unchanged manual lot 3; aggregate 5 |
| C fridge | Reviewed accepted corrections, rejected evidence, no fabricated purchase facts |
| D route ownership | Same-document A→B→A with delayed response and route-owned submission |
| E session race | Delayed real GET cannot repopulate private state after profile logout |
| F UNKNOWN | Not fresh; explicit date/storage edit rereads as KNOWN/freezer |
| G conflict | Real stale 409, safe message/refetch, one mutation only |
| H confirmed | Read-only accepted/rejected/empty states, terminal navigation, zero fridge-navigation mutations |
| I adoption | Actual executable with identity/apply/evidence gates and explicit replay |
| U7 metadata | Existing-field editor, real unit rejection, compatible save, canonical quantity preserved |
| T10 reconciliation | Real proposal accepted and evidence dismissed through UI |

The initial concurrent detached attempt failed H at 430px because a source-writing
Vitest test triggered a Vite page reload. The full unchanged browser matrix passed
after other suites ended. **Never overlap browser and Vitest/source-writing checks
in the same worktree.** Exact commands, failure analysis and evidence locations:
[T13B_FINAL_HARDENING.md](T13B_FINAL_HARDENING.md); per-AC mapping:
[TEST_MATRIX.md](TEST_MATRIX.md).

The harness owns its isolated local server; managed Preview is not mandatory.
External app requests are blocked; known Unsplash images are aborted and only the
isolated HTML strips external Google Fonts/GSI. Thus external imagery/identity
services and production delivery are not certified. Production flags, remote D1,
PayOS and the meal-planner SAFE_DEFERRED/read-authority cutover remain untouched.
