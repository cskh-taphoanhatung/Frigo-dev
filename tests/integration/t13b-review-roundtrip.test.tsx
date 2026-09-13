// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { Hono } from 'hono';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import type { InventoryScanEvidence } from '../../packages/domain/src/inventory-lot-commands';
import { ReceiptReviewPage } from '../../src/web/pages/ReceiptReviewPage';
import { ScanResultPage } from '../../src/web/pages/ScanResultPage';
import { useScanStore } from '../../src/web/stores/useScanStore';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { inventoryTruthRoutes } from '../../src/worker/routes/inventory-truth';
import { scanRoutes } from '../../src/worker/routes/scans';
import type { AuthContext, Env } from '../../src/worker/types';
import { generateSessionToken, SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { ScanConfirmSchema } from '../../src/worker/validation/schemas';
import { SqliteD1 } from '../helpers/sqlite-d1';

vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => null }));
vi.mock('../../src/web/lib/query-invalidation', () => ({
  invalidateInventoryDependents: vi.fn(),
  invalidateReplayedQueries: vi.fn(),
}));

const scope = { householdId: 't13b-ui-household', actorId: 't13b-ui-user' };
const other = { householdId: 't13b-ui-other', actorId: 't13b-ui-other-user' };
const origin = 'https://t13b-ui.example';
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/api/v1', inventoryRoutes);
app.route('/api/v1', inventoryTruthRoutes);
app.route('/api/v1', scanRoutes);

type ScanType = 'receipt' | 'fridge';
interface CapturedRequest {
  path: string;
  method: string;
  body: string | undefined;
  status?: number;
  responseBody?: unknown;
}

let db: SqliteD1;
let sessionToken: string;
let container: HTMLDivElement;
let root: Root | undefined;
let captured: CapturedRequest[];
let pending: Promise<Response>[];

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cookie', `${SESSION_COOKIE}=${sessionToken}`);
  headers.set('Origin', origin);
  return app.fetch(new Request(new URL(path, origin), { ...init, headers }), {
    DB: db, ENVIRONMENT: 'test', APP_URL: origin, WEEK_SCHEMA_MODE: 'legacy',
  });
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', webcrypto);
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('frigo_user_id', scope.actorId);
  localStorage.setItem('frigo_household_id', scope.householdId);
  useScanStore.getState().reset();
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('t13b-ui-user'), ('t13b-ui-other-user');
    INSERT INTO households(id, name, created_by) VALUES
      ('t13b-ui-household', 'Review fixture', 't13b-ui-user'),
      ('t13b-ui-other', 'Isolated fixture', 't13b-ui-other-user');
    INSERT INTO household_members(id, household_id, user_id, role) VALUES
      ('t13b-ui-member', 't13b-ui-household', 't13b-ui-user', 'owner'),
      ('t13b-ui-other-member', 't13b-ui-other', 't13b-ui-other-user', 'owner');`);
  sessionToken = generateSessionToken();
  await db.prepare(`INSERT INTO sessions_v2(id, user_id, household_id, token_hash, expires_at)
    VALUES ('t13b-ui-session', ?, ?, ?, datetime('now', '+1 hour'))`)
    .bind(scope.actorId, scope.householdId, await sha256Hex(sessionToken)).run();
  for (const household of [scope, other]) {
    await backfillLegacyInventory(db, household.householdId);
    await executeInventoryAdoption(db, household, {}, '2026-09-13T10:00:00Z');
  }
  captured = [];
  pending = [];
  // Only bridge transport/cookie delivery; the real web API and Hono handlers own every payload/response.
  vi.stubGlobal('fetch', vi.fn<typeof fetch>((input, init) => {
    const path = String(input);
    const call: CapturedRequest = {
      path, method: init?.method ?? 'GET', body: init?.body === undefined ? undefined : String(init.body),
    };
    captured.push(call);
    const response = request(path, init).then(async (result) => {
      call.status = result.status;
      call.responseBody = await result.clone().json();
      return result;
    });
    pending.push(response);
    return response;
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  vi.useFakeTimers();
});

afterEach(async () => {
  await Promise.all(pending);
  if (root) await act(async () => { root!.unmount(); });
  root = undefined;
  container.remove();
  useScanStore.getState().reset();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  db.close();
});

async function seedScan(scanId: string, type: ScanType, household = scope) {
  await db.prepare(`INSERT INTO scans(id, user_id, household_id, status, scan_type, purchase_date)
    VALUES (?, ?, ?, 'ready', ?, ?)`)
    .bind(scanId, household.actorId, household.householdId, type, type === 'receipt' ? '2026-09-12' : null).run();
  for (const [suffix, name, confidence] of [
    ['accepted', 'CA CHUA OCR', null], ['rejected', 'OCR spurious item', 0],
  ] as const) {
    await db.prepare(`INSERT INTO scan_items(id, scan_id, raw_name, canonical_id, estimated_quantity,
      unit, confidence, category, storage, total_price_vnd,
      ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence)
      VALUES (?, ?, ?, NULL, 2, 'piece', 0.9, 'other', 'fridge', ?, ?, 2, 'piece', ?)`)
      .bind(`${scanId}-${suffix}`, scanId, name, type === 'receipt' ? 43500 : null, name, confidence).run();
  }
}

async function settleTransport() {
  await act(async () => { await Promise.all(pending); });
}

async function mount(scanId: string, type: ScanType) {
  const url = type === 'receipt' ? `/receipt-review?scanId=${scanId}` : `/scan/${scanId}/review`;
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/receipt-review" element={<ReceiptReviewPage />} />
          <Route path="/scan/:id/review" element={<ScanResultPage />} />
          <Route path="/fridge" element={<p>Returned to inventory</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  await settleTransport();
  expect(captured).toContainEqual(expect.objectContaining({ path: `/api/v1/scans/${scanId}`, status: 200 }));
}

function rows(type: ScanType) {
  return [...container.querySelectorAll<HTMLElement>(type === 'receipt' ? '[data-testid="receipt-line"]' : 'article')];
}

function field(row: HTMLElement, label: string) {
  const node = [...row.querySelectorAll('label')].find((candidate) => candidate.textContent?.trim().startsWith(label));
  const control = node?.querySelector('input,select') ?? (node?.htmlFor ? document.getElementById(node.htmlFor) : null);
  expect(control, label).toBeTruthy();
  return control as HTMLInputElement | HTMLSelectElement;
}

async function fill(control: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value);
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

async function click(label: string, within: HTMLElement = container) {
  const button = [...within.querySelectorAll('button')].find((node) =>
    node.textContent?.trim() === label || node.getAttribute('aria-label') === label);
  expect(button, label).toBeTruthy();
  expect(button!.disabled).toBe(false);
  await act(async () => { button!.click(); });
  await settleTransport();
}

function rawRows(scanId: string) {
  return db.query(`SELECT id, ocr_raw_name, ocr_quantity, ocr_unit, ocr_confidence
    FROM scan_items WHERE scan_id = ? ORDER BY id`, scanId);
}

describe('T13B actual review DOM → authenticated scan route → T09/T10/T11', () => {
  it.each(['receipt', 'fridge'] as const)('%s edits all five fields and durably rejects evidence without inventing stock', async (type) => {
    const scanId = `t13b-ui-${type}`;
    const otherScanId = `t13b-other-${type}`;
    const sourceType = type === 'receipt' ? 'RECEIPT' : 'SCAN';
    await seedScan(scanId, type);
    await seedScan(otherScanId, type, other);
    const originalRaw = rawRows(scanId);
    const otherRows = db.query('SELECT * FROM scan_items WHERE scan_id = ? ORDER BY id', otherScanId);
    expect((await request(`/api/v1/scans/${otherScanId}`)).status).toBe(404);
    await mount(scanId, type);
    expect(rows(type)).toHaveLength(2);
    const [accepted, rejected] = rows(type);
    expect(accepted.textContent).toContain('Độ tin cậy: chưa rõ');
    expect(rejected.textContent).toContain('0%');
    expect(accepted.textContent).toContain('CA CHUA OCR');

    await fill(field(accepted, type === 'receipt' ? 'Tên sản phẩm' : 'Tên nguyên liệu'), 'Cà chua');
    await fill(field(accepted, 'Số lượng'), '0.75');
    await fill(field(accepted, 'Đơn vị'), 'kg');
    await fill(field(accepted, type === 'receipt' ? 'Nơi bảo quản' : 'Bảo quản'), 'freezer');
    await fill(field(accepted, 'Hạn dùng'), '2026-10-12');
    expect(accepted.textContent).toContain('CA CHUA OCR');
    await click(type === 'receipt' ? 'Bỏ qua OCR spurious item' : 'Từ chối dòng này', rejected);
    expect(rows(type)).toHaveLength(2);
    await click(type === 'receipt' ? 'Nhập 1 món vào Tủ lạnh' : 'Xác nhận nguyên liệu (1 món)');

    const submissions = captured.filter((call) => call.method === 'POST');
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({ path: `/api/v1/scans/${scanId}/confirm`, status: 200 });
    const wire: unknown = JSON.parse(submissions[0].body!);
    const submitted = ScanConfirmSchema.parse(wire);
    expect(submitted.items).toHaveLength(2);
    expect(submitted.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `${scanId}-accepted`, rawName: 'Cà chua', estimatedQuantity: 0.75,
        unit: 'kg', storage: 'freezer', expiryDate: '2026-10-12', expiryEstimated: false, rejected: false }),
      expect.objectContaining({ id: `${scanId}-rejected`, rejected: true }),
    ]));

    const lots = db.query<{ id: string } & Record<string, unknown>>(`SELECT l.id, l.raw_name,
      l.quantity_milli, l.canonical_unit, s.type AS storage, l.source_type, l.source_id,
      l.expiry_kind, l.expiry_at, l.estimated_expiry_at, l.purchased_at, l.amount_minor
      FROM inventory_lots l JOIN storage_locations s ON s.id = l.storage_location_id
      WHERE l.household_id = ?`, scope.householdId);
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ raw_name: 'Cà chua', quantity_milli: 750000, canonical_unit: 'g',
      storage: 'FREEZER', source_type: sourceType, source_id: scanId, expiry_kind: 'KNOWN',
      expiry_at: '2026-10-12', estimated_expiry_at: null,
      purchased_at: type === 'receipt' ? '2026-09-12' : null, amount_minor: type === 'receipt' ? 43500 : null });
    const expectedInventory = { items: [expect.objectContaining({
      lotId: lots[0].id, name: 'Cà chua', dataSource: type === 'receipt' ? 'receipt' : 'scan',
    })] };
    expect(submissions[0].responseBody).toMatchObject({ success: true, ...expectedInventory });
    const inventory = await request('/api/v1/inventory');
    expect(inventory.status).toBe(200);
    expect(await inventory.json()).toMatchObject(expectedInventory);
    expect(rawRows(scanId)).toEqual(originalRaw);
    expect(db.query(`SELECT id, raw_name, estimated_quantity, unit, review_state
      FROM scan_items WHERE scan_id = ? ORDER BY id`, scanId)).toEqual([
      { id: `${scanId}-accepted`, raw_name: 'Cà chua', estimated_quantity: 0.75, unit: 'kg', review_state: 'CONFIRMED' },
      { id: `${scanId}-rejected`, raw_name: 'OCR spurious item', estimated_quantity: 2, unit: 'piece', review_state: 'REJECTED' },
    ]);
    expect(db.query(`SELECT source_type, raw_name, quantity, unit, storage, expiry_date, expiry_kind
      FROM inventory_observations WHERE household_id = ?`, scope.householdId)).toEqual([
      { source_type: sourceType, raw_name: 'CA CHUA OCR', quantity: 0.75, unit: 'kg', storage: 'freezer',
        expiry_date: '2026-10-12', expiry_kind: 'KNOWN' },
    ]);

    const commands = db.query<{ id: string; command_type: string; fingerprint: string }>(
      'SELECT id, command_type, fingerprint FROM inventory_commands WHERE household_id = ?', scope.householdId);
    expect(commands).toHaveLength(1);
    expect(commands[0].command_type).toBe('CREATE');
    const evidence: InventoryScanEvidence = { scanId, sourceType, lines: [{
      scanItemId: `${scanId}-accepted`, corrected: true,
      raw: { rawName: 'CA CHUA OCR', quantity: 2, unit: 'piece' },
      confirmed: { name: 'Cà chua', quantity: 0.75, unit: 'kg', storage: 'freezer',
        expiryKind: 'KNOWN', expiryAt: '2026-10-12', estimatedExpiryAt: null },
    }] };
    expect(JSON.parse(commands[0].fingerprint).command.scanEvidence).toEqual(evidence);
    const events = db.query<{ metadata: string }>('SELECT metadata FROM inventory_events WHERE command_id = ?', commands[0].id);
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].metadata).fingerprint).toBe(commands[0].fingerprint);
    expect(JSON.parse(JSON.parse(events[0].metadata).fingerprint).command.scanEvidence).toEqual(evidence);

    const detail = await request(`/api/v1/inventory/lots/${lots[0].id}`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ lot: { sourceType, sourceId: scanId, storage: 'freezer',
      expiryKind: 'KNOWN', expiryAt: '2026-10-12', estimatedExpiryAt: null } });
    expect(db.query('SELECT status FROM scans WHERE id = ?', scanId)).toEqual([{ status: 'confirmed' }]);
    expect(db.query('SELECT * FROM scan_items WHERE scan_id = ? ORDER BY id', otherScanId)).toEqual(otherRows);
    expect(db.query('SELECT id FROM inventory_lots WHERE household_id = ?', other.householdId)).toEqual([]);
    expect(db.query('SELECT id FROM inventory_observations WHERE household_id = ?', other.householdId)).toEqual([]);

    const replay = await request(`/api/v1/scans/${scanId}/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: submissions[0].body,
    });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ success: true, ...expectedInventory });
    expect(db.query('SELECT id FROM inventory_lots WHERE household_id = ?', scope.householdId)).toEqual([{ id: lots[0].id }]);
    expect(db.query('SELECT id FROM inventory_commands WHERE household_id = ?', scope.householdId)).toEqual([{ id: commands[0].id }]);
    expect(rawRows(scanId)).toEqual(originalRaw);
  });

  // T13R-A P2-B: reopening a confirmed review in a NEW document must hydrate
  // the exact expiry the reviewer accepted from the server DTO, not an absence.
  it.each(['receipt', 'fridge'] as const)('%s confirmed review reopened in a fresh document shows the accepted expiry as KNOWN', async (type) => {
    const scanId = `t13b-remount-${type}`;
    await seedScan(scanId, type);
    await mount(scanId, type);
    const [accepted, rejected] = rows(type);
    await fill(field(accepted, 'Hạn dùng'), '2030-12-31');
    await click(type === 'receipt' ? 'Bỏ qua OCR spurious item' : 'Từ chối dòng này', rejected);
    await click(type === 'receipt' ? 'Nhập 1 món vào Tủ lạnh' : 'Xác nhận nguyên liệu (1 món)');
    expect(captured.filter((call) => call.method === 'POST')).toMatchObject([{ path: `/api/v1/scans/${scanId}/confirm`, status: 200 }]);
    expect(db.query(`SELECT id, review_state, reviewed_expiry_date, reviewed_expiry_kind
      FROM scan_items WHERE scan_id = ? ORDER BY id`, scanId)).toEqual([
      { id: `${scanId}-accepted`, review_state: 'CONFIRMED', reviewed_expiry_date: '2030-12-31', reviewed_expiry_kind: 'KNOWN' },
      { id: `${scanId}-rejected`, review_state: 'REJECTED', reviewed_expiry_date: null, reviewed_expiry_kind: null },
    ]);

    // Fresh document: unmount, drop every client-side store, remount from the route alone.
    await act(async () => { root!.unmount(); });
    root = undefined;
    useScanStore.getState().reset();
    captured.length = 0;
    await mount(scanId, type);
    const [reopened, reopenedRejected] = rows(type);
    const expiryInput = field(reopened, 'Hạn dùng') as HTMLInputElement;
    expect(expiryInput.value).toBe('2030-12-31');
    // Read-only: disabled directly (receipt) or through its fieldset (fridge).
    expect(expiryInput.disabled || expiryInput.closest('fieldset')?.disabled).toBe(true);
    expect(reopened.textContent).not.toContain('Chưa rõ hạn dùng');
    expect(reopened.textContent).toContain(type === 'receipt' ? 'Hạn dùng do bạn cung cấp' : 'Ngày do bạn xác nhận');
    expect((field(reopenedRejected, 'Hạn dùng') as HTMLInputElement).value).toBe('');
    // Nothing was mutated by reopening.
    expect(captured.filter((call) => call.method === 'POST')).toEqual([]);
  });
});
