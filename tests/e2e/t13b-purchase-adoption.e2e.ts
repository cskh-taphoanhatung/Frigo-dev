import { writeFile } from 'node:fs/promises';
import { test, expect, reset, control, adopt, getJson, layout } from './t13b/fixtures';
import type { InventoryLotDetail } from '../../src/web/services/inventory-truth';

interface ScenarioIds {
  receiptPurchase: string; receiptPurchaseTomato: string; legacyTomato: string; terminalLegacyItem: string;
}
interface RequestLog { method: string; path: string; status: number; expectedUser: boolean; expectedHousehold: boolean }
interface State {
  lots: Array<{ id: string; quantityMilli: number; state: string; sourceId: string }>;
  adoption: { active: boolean; mappedLotCount: number };
}

test.beforeEach(async ({ page }) => { await reset(page); });

test('B receipt purchase creates a distinct RECEIPT lot 2 beside unchanged existing tomato 3', async ({ page }, info) => {
  const ids = await control<ScenarioIds>(page, 't13-scenarios');
  const file = info.outputPath('synthetic-terminal-evidence.json');
  await writeFile(file, JSON.stringify({ terminalEvidence: [{ legacyItemId: ids.terminalLegacyItem,
    state: 'DISCARDED', reason: 'Synthetic operator-reviewed discarded fixture' }] }));
  const adopted = await adopt(page, ['--apply', '--request-file', file]);
  expect(adopted, adopted.error).toMatchObject({ code: 0 });
  const before = (await getJson<{ items: InventoryLotDetail[] }>(page, '/api/v1/inventory/summary')).items;
  const old = before.find((lot) => lot.id === ids.legacyTomato)!;
  expect(old).toMatchObject({ quantity: 3, unit: 'piece', sourceType: 'LEGACY_BACKFILL' });
  await page.goto(`/scan/receipt-review?scanId=${ids.receiptPurchase}`);
  await expect(page.getByRole('heading', { name: 'Cửa hàng A' })).toBeVisible();
  await expect(page.getByText('2026-09-10', { exact: true })).toBeVisible();
  await expect(page.getByText('• A-2026-001', { exact: true })).toBeVisible();
  await expect(page.getByTestId('receipt-total')).toHaveText('42.000đ');
  await expect(page.getByTestId('receipt-price')).toHaveText('Thành tiền OCR: 42.000đ');
  await layout(page, page.locator('input, select'));
  const response = page.waitForResponse((r) => r.url().endsWith(`/scans/${ids.receiptPurchase}/confirm`));
  await page.getByRole('button', { name: 'Nhập 1 món vào Tủ lạnh' }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/fridge$/);
  const after = (await getJson<{ items: InventoryLotDetail[] }>(page, '/api/v1/inventory/summary')).items;
  const retained = after.find((lot) => lot.lotId === old.lotId)!;
  expect(retained.inventoryVersion).toBeGreaterThan(old.inventoryVersion);
  expect(retained).toEqual({ ...old, inventoryVersion: retained.inventoryVersion });
  const tomatoes = after.filter((lot) => lot.ingredientId === 'TOMATO');
  expect(tomatoes).toHaveLength(2);
  expect(tomatoes.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(5);
  const purchase = tomatoes.find((lot) => lot.sourceId === ids.receiptPurchase)!;
  expect(purchase).toMatchObject({ quantity: 2, unit: 'piece', sourceType: 'RECEIPT',
    dataSource: 'receipt', purchasedAt: '2026-09-10' });
  expect(purchase.lotId).not.toBe(old.lotId);
  await page.goto(`/ingredients/${purchase.id}`);
  await expect(page.getByTestId('lot-provenance')).toHaveText('Từ hóa đơn');
  await expect(page.getByText('2 piece', { exact: true })).toBeVisible();
});

test('I actual adoption executable enforces apply/identity, preserves stock and terminal evidence, and replays without retries', async ({ page }, info) => {
  const ids = await control<ScenarioIds>(page, 't13-scenarios');
  const stock = await control(page, 'state');
  const requests = async () => (await control<{ requests: RequestLog[] }>(page, 't13-operator-requests'))
    .requests.filter((request) => request.path !== '/api/v1/me' || !request.expectedUser);
  const initial = await requests();
  const noApply = await adopt(page, []);
  expect(noApply.code).toBe(2);
  expect(JSON.parse(noApply.error).code).toBe('INVALID_INPUT');
  expect(await requests()).toEqual(initial);
  const wrongHousehold = await adopt(page, ['--apply'], 'another-synthetic-household');
  expect(wrongHousehold.code).toBe(1);
  expect(JSON.parse(wrongHousehold.error).code).toBe('HOUSEHOLD_MISMATCH');
  expect((await requests()).slice(initial.length)).toEqual([
    { method: 'GET', path: '/api/v1/me', status: 200, expectedUser: false, expectedHousehold: false },
  ]);
  const missingEvidence = await adopt(page);
  expect(missingEvidence.code).toBe(1);
  expect(JSON.parse(missingEvidence.error).code).toBe('TERMINAL_EVIDENCE_REQUIRED');
  expect((await control<State>(page, 't13-state')).adoption.active).toBe(false);
  const file = info.outputPath('synthetic-terminal-evidence.json');
  await writeFile(file, JSON.stringify({ terminalEvidence: [{ legacyItemId: ids.terminalLegacyItem,
    state: 'DISCARDED', reason: 'Synthetic operator-reviewed discarded fixture' }] }));
  const args = ['--apply', '--request-file', file];
  const applied = await adopt(page, args);
  expect(applied, applied.error).toMatchObject({ code: 0 });
  expect(JSON.parse(applied.output)).toMatchObject({ status: 'adopted', householdId: 'planner-preview-household' });
  const canonical = await control<State>(page, 't13-state');
  expect(canonical.adoption.active).toBe(true);
  expect(canonical.lots.find((lot) => lot.sourceId === ids.terminalLegacyItem))
    .toMatchObject({ state: 'DISCARDED', quantityMilli: 0 });
  const replay = await adopt(page, args);
  expect(replay, replay.error).toMatchObject({ code: 0 });
  expect(JSON.parse(replay.output).status).toBe('replayed');
  expect(await control<State>(page, 't13-state')).toEqual(canonical);
  expect((await control(page, 'state')).inventory).toEqual(stock.inventory);
  await writeFile(file, JSON.stringify({ terminalEvidence: [{ legacyItemId: ids.terminalLegacyItem,
    state: 'CONSUMED', reason: 'Different intent must not silently replay' }] }));
  const changed = await adopt(page, args);
  expect(changed.code).toBe(1);
  expect(JSON.parse(changed.error).code).toBe('IDEMPOTENCY_CONFLICT');
  const posts = (await requests()).filter((request) => request.method === 'POST');
  expect(posts.map((request) => request.status)).toEqual([422, 201, 200, 409]);
  expect(posts.every((request) => request.path === '/api/v1/inventory/adopt'
    && request.expectedUser && request.expectedHousehold)).toBe(true);
  expect(await control<State>(page, 't13-state')).toEqual(canonical);
});
