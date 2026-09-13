# T13 receipt / vision truth

**T13 COMPLETE — STOP for INDEPENDENT T13 FINAL REVIEW.** Contracts below describe
application freeze `7b7bb695ee597a46cf4022a2c534e2fea374be5d`; exact certification
commands and failures are in [T13B_FINAL_HARDENING.md](T13B_FINAL_HARDENING.md).

## Evidence and authority

```text
OCR / vision → explicit user review → accepted intent
                                  → T10 observation + T09 command (one batch)
                                  → inventory_lots → T11 read authority
```

A new user-supplied fact can correct extraction; a heuristic cannot silently
strengthen an uncertain claim into a known fact. The raw extraction remains
separate from the reviewed claim and from the authoritative lot after-state.
Rejected lines retain raw/review history but generate neither a stock command
nor a stock observation. An observation alone never grants mutation authority.

## No-fabrication guards

| Field | Current contract |
| --- | --- |
| `confidence` | Real reported value or absence; zero and low values are preserved, not floored |
| `merchant_name` | Reported merchant or absence, not `"Siêu thị"` |
| `purchase_date` | Valid supplied calendar date or absence, not today |
| `unit_price_vnd` / `total_price_vnd` | Real representable amount or absence, not `0` |

`receiptPurchasePrice()` represents VND with zero minor digits. Fractional,
negative, non-finite or unsafe integer amounts are absent rather than rounded.
`receiptLineFacts()` can use an exact line total or an exactly representable
unit-price × quantity product; it null-checks before coercion so `Number(null)`
cannot fabricate a zero-price fact. A genuinely supplied zero remains zero.

`trustworthyCalendarDate()` accepts a real `YYYY-MM-DD` calendar date, validating
month length and leap years. Ambiguous locale strings and impossible dates are
absent. Real and mock providers use the same date contract; a mock purchase date
is synthetic fixture evidence, not permission to fabricate real purchase dates.

## Provenance and separate receipt purchases

`scanProvenance()` uses persisted server-side `scan_type`, never a client label.

| Scan type | Lot provenance | Purchase facts |
| --- | --- | --- |
| `receipt` | `RECEIPT`, `sourceId` = receipt scan ID | Valid receipt date and exact price, otherwise null |
| `fridge` | `SCAN` for new lots | `purchasedAt` and `purchasePrice` null |

An adopted receipt purchase always creates distinct receipt lots. It does not
merge into or rewrite a pre-existing manual/receipt lot: **manual tomato 3 + new
receipt tomato 2 = two lots, total 5**. Receipt A and B, and duplicate same-ingredient
lines within a receipt, remain distinguishable with their own price/storage/expiry.
An incompatible existing unit does not prevent creating a separate receipt lot.

Fridge review retains the existing grouped `CORRECT` path for matching stock.
That correction does not relabel an existing lot's original provenance or purchase
facts. Reviewed storage/expiry may remain evidence claims where that existing
adapter does not apply them; the T09 event after-state says what actually changed.

## Expiry truth

`lotExpiryFromEvidence(date, basis)` separates dated facts from estimates:

| Evidence | Authority representation |
| --- | --- |
| Explicit supplied date | `KNOWN`, `expiryAt` set, `estimatedExpiryAt` null |
| Shelf-life inference or day chip | `ESTIMATED`, `estimatedExpiryAt` set, `expiryAt` null |
| No supplied date and no estimate basis | `UNKNOWN`, both dates null |

A receipt **without a supplied expiry** yields `ESTIMATED` if an estimate basis
exists, otherwise `UNKNOWN` — never `KNOWN` merely because it proves purchase.
An explicit user-supplied expiry date during receipt review may legitimately yield
`KNOWN`. Purchase dates are not expiry dates; `USE_BY` / `BEST_BEFORE` are not inferred.

The correction loop derives kind from the submitted evidence, not the previous
lot kind: explicit date → `KNOWN`; `expiryEstimated: true` → `ESTIMATED`; clearing
the date → `UNKNOWN`. Unit/integration tests cover each mapping; final browser F
and U7 cover an explicit known-date correction and canonical reread. No unchanged
estimate is silently upgraded merely by saving other metadata.

## Retained OCR and actual lifecycle

Additive migration `0031_scan_evidence_retention.sql` retains:

| Column | Meaning |
| --- | --- |
| `ocr_raw_name`, `ocr_quantity`, `ocr_unit` | Original extraction, nullable where absent |
| `ocr_confidence` | Real nullable confidence, including genuine zero/low values |
| `review_state` | **Only `PENDING`, `CONFIRMED`, `REJECTED`** |

There is **no persisted `CORRECTED` review state**. `correctionOf()` derives a
`corrected` boolean metadata field for a provable name/quantity/unit difference.
It does not change the lifecycle or assert that missing OCR was accepted unchanged.

The old `scan_items.confidence` column is `NOT NULL DEFAULT 0.9`; it cannot encode
unknown. It remains for compatibility, while `ocr_confidence` is the truth source.
Migration backfill and insert/update triggers keep `review_state='CONFIRMED'`
aligned with `is_confirmed=1`. Pending/rejected rows remain unconfirmed. Migration
0031 is unchanged at blob `c580d30b589ace1102cdfda7e61bfbacc57c4253`; no 0032 exists.

## Raw → confirmed command evidence

The strictly validated optional `scanEvidence` field is command intent, retained in:

```text
inventory_commands.fingerprint → command.scanEvidence
inventory_events.metadata → fingerprint → command.scanEvidence
```

There is no new top-level `inventory_events.metadata.scanEvidence` key. The
existing immutable event envelope retains the fingerprint; no second ledger is
created. Each line records its scan identity, raw values, reviewed values and
`corrected` metadata. Missing OCR/manual-line values remain null. Evidence is
bounded to 50 lines / 64 KiB and rejected rather than truncated; no images or
binary payloads enter command evidence.

Confirmed expiry evidence records the review claim. With no supplied date it can
be UNKNOWN while the resulting lot separately carries a sanctioned ESTIMATED
shelf-life date. This is intentional, not loss of evidence. T10 `rawName` comes
from retained OCR under its existing 200-character bound, not the reviewed name.

## Atomicity, rejection and replay

`confirmAdoptedScan()` composes T09 commands and guarded T10 observation inserts.
Reviewed scan rows, observations, commands/effects/events and completion-last
scan status share the same ready-predicate D1 batch. Injected failures at event,
observation and final-status stages roll back the entire batch.

Explicit rejection persists `review_state='REJECTED'`, `is_confirmed=0`, and raw
review evidence. It contributes **no lot command and no stock observation**; the
old shorthand “no evidence” was false. Accepted lines in the same scan may commit.

Stable bounded command/source/decision identities preserve retry behavior.
Already-confirmed valid requests return the T11 replay result without applying
changed review intent again. Direct same-key changed T09 evidence conflicts;
concurrent/lost-response confirmation does not double-add stock. Realistic digest
IDs, separate receipt purchases, rejection, rollback and replay have permanent
unit, authenticated-route, real local D1 and browser coverage mapped in
[TEST_MATRIX.md](TEST_MATRIX.md).
