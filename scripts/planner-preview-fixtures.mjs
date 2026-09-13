import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { seedT13ReviewEvidence } from './t13-preview-fixtures.mjs';

export const PREVIEW_USER_ID = 'planner-preview-user';
export const PREVIEW_HOUSEHOLD_ID = 'planner-preview-household';
const SESSION_COOKIE = '__Host-frigo_session';
const FIXTURE_VERSION = 't06b-planner-v1';

// Keep real limiter behavior, but make its synthetic state reset with the database.
export function createPreviewCache(now = Date.now) {
  const entries = new Map();
  return {
    async get(key, type = 'text') {
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      if (type === 'json') return JSON.parse(entry.value);
      if (type !== 'text') throw new Error('Unsupported isolated preview cache type');
      return entry.value;
    },
    async put(key, value, options = {}) {
      if (typeof value !== 'string') throw new Error('Isolated preview cache requires text');
      const expiresAt = options.expiration === undefined
        ? options.expirationTtl === undefined ? Infinity : now() + options.expirationTtl * 1000
        : options.expiration * 1000;
      entries.set(key, { value, expiresAt });
    },
    async delete(key) { entries.delete(key); },
  };
}

// This module is imported only by the isolated Node preview and its tests.
export function seedPlannerPreview(db) {
  if (db.query('SELECT id FROM users WHERE id = ?', PREVIEW_USER_ID).length) return;
  try {
    db.seed(`BEGIN IMMEDIATE;
    INSERT INTO users (id, email, is_guest) VALUES
      ('${PREVIEW_USER_ID}', 'planner@example.test', 0);
    INSERT INTO auth_accounts (id, user_id, email, is_verified) VALUES
      ('planner-preview-account', '${PREVIEW_USER_ID}', 'planner@example.test', 1);
    INSERT INTO profiles (id, user_id, display_name) VALUES
      ('planner-preview-profile', '${PREVIEW_USER_ID}', 'Frigo Preview');
    INSERT INTO households (id, name, created_by) VALUES
      ('${PREVIEW_HOUSEHOLD_ID}', 'Bếp nhà Frigo', '${PREVIEW_USER_ID}');
    INSERT INTO household_members (id, household_id, user_id, role) VALUES
      ('planner-preview-owner', '${PREVIEW_HOUSEHOLD_ID}', '${PREVIEW_USER_ID}', 'owner');
    INSERT INTO user_preferences (id, user_id, household_size, language) VALUES
      ('planner-preview-preferences', '${PREVIEW_USER_ID}', 2, 'vi');

    DELETE FROM recipes;
    INSERT INTO recipes (id, slug, title, cuisine, servings, prep_time_minutes, cook_time_minutes, difficulty) VALUES
      ('preview-chicken', 'preview-chicken', 'Gà áp chảo', 'viet', 2, 10, 15, 'easy'),
      ('preview-tofu', 'preview-tofu', 'Đậu phụ sốt cà chua', 'viet', 2, 5, 15, 'easy'),
      ('preview-egg', 'preview-egg', 'Trứng xào cà chua', 'viet', 2, 5, 10, 'easy');
    INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional) VALUES
      ('preview-chicken-line', 'preview-chicken', 'CHICKEN_BREAST', 'Ức gà', 200, 'g', 0),
      ('preview-chicken-tomato', 'preview-chicken', 'TOMATO', 'Cà chua', 100, 'g', 0),
      ('preview-tofu-line', 'preview-tofu', 'TOFU', 'Đậu phụ', 200, 'g', 0),
      ('preview-tofu-tomato', 'preview-tofu', 'TOMATO', 'Cà chua', 150, 'g', 0),
      ('preview-egg-line', 'preview-egg', 'CHICKEN_EGG', 'Trứng', 2, 'piece', 0),
      ('preview-egg-tomato', 'preview-egg', 'TOMATO', 'Cà chua', 100, 'g', 0);
    INSERT INTO recipe_steps (id, recipe_id, step_number, instruction) VALUES
      ('preview-chicken-step-1', 'preview-chicken', 1, 'Rửa cà chua, cắt miếng vừa ăn.'),
      ('preview-chicken-step-2', 'preview-chicken', 2, 'Áp chảo gà đến khi chín hoàn toàn, thêm cà chua và nấu chín.'),
      ('preview-tofu-step-1', 'preview-tofu', 1, 'Cắt đậu phụ thành miếng và cà chua thành múi.'),
      ('preview-tofu-step-2', 'preview-tofu', 2, 'Nấu cà chua thành sốt, cho đậu phụ vào và đun chín.'),
      ('preview-egg-step-1', 'preview-egg', 1, 'Đánh trứng, cắt cà chua thành miếng.'),
      ('preview-egg-step-2', 'preview-egg', 2, 'Xào cà chua, thêm trứng và đảo đến khi chín hoàn toàn.');
    INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, version) VALUES
      ('preview-stock-chicken', '${PREVIEW_HOUSEHOLD_ID}', 'CHICKEN_BREAST', 'Ức gà', 300, 'g', 'meat', 'fridge', 1),
      ('preview-stock-tofu', '${PREVIEW_HOUSEHOLD_ID}', 'TOFU', 'Đậu phụ', 200, 'g', 'other', 'fridge', 1),
      ('preview-stock-egg', '${PREVIEW_HOUSEHOLD_ID}', 'CHICKEN_EGG', 'Trứng', 2, 'piece', 'egg', 'fridge', 1);
    COMMIT;`);
  } catch (error) {
    db.seed('ROLLBACK');
    throw error;
  }
}

export function previewFixtureState(db) {
  return {
    fixture: FIXTURE_VERSION,
    userId: PREVIEW_USER_ID,
    householdId: PREVIEW_HOUSEHOLD_ID,
    recipes: db.query('SELECT id FROM recipes ORDER BY id').map(({ id }) => id),
    inventory: db.query('SELECT id, quantity, unit, version FROM inventory_items WHERE household_id = ? ORDER BY id', PREVIEW_HOUSEHOLD_ID),
    planCount: db.query('SELECT COUNT(*) AS count FROM generated_meal_plans')[0].count,
    inventoryEventCount: db.query('SELECT COUNT(*) AS count FROM inventory_events WHERE household_id = ?', PREVIEW_HOUSEHOLD_ID)[0].count,
    cookedMealCount: db.query('SELECT COUNT(*) AS count FROM cooked_meals WHERE household_id = ?', PREVIEW_HOUSEHOLD_ID)[0].count,
    externalFetch: 'blocked',
    reviewedPriceOffers: 0,
  };
}

export function issuePreviewSession(db) {
  const token = randomBytes(32).toString('hex');
  db.execute(`INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?, ?)`, [randomUUID(), PREVIEW_USER_ID, PREVIEW_HOUSEHOLD_ID,
    createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 86400_000).toISOString()]);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" };

export function createPreviewControls({ getDatabase, resetDatabase }) {
  return async function previewControls(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/__preview')) return null;
    if (url.pathname === '/__preview/ready' && request.method === 'GET') {
      return new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Frigo preview session</title><p id="status" role="status">Đang xác minh phiên thử nghiệm…</p>
        <script type="module" src="/__preview/session.js"></script></html>`, {
        headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'" },
      });
    }
    if (url.pathname === '/__preview/session.js' && request.method === 'GET') {
      return new Response(`import { useAuthStore } from '/src/web/stores/useAuthStore.ts';
        import { clearPrivateIdentity, LOGOUT_PENDING_KEY } from '/src/web/lib/private-session.ts';
        try {
          const response = await fetch('/api/v1/me', { credentials: 'include', cache: 'no-store' });
          if (!response.ok) throw new Error('Session verification failed');
          const { user } = await response.json();
          if (!user?.id || !user?.household?.id || user.isGuest) throw new Error('Registered session required');
          clearPrivateIdentity();
          localStorage.removeItem(LOGOUT_PENDING_KEY);
          useAuthStore.getState().setAuthSession({ id: user.id, email: user.email, displayName: user.displayName,
            avatarUrl: user.avatarUrl, householdId: user.household.id });
          location.replace('/planner');
        } catch {
          document.getElementById('status').textContent = 'Không thể xác minh phiên. Mở /__preview để đăng nhập lại.';
        }`, { headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } });
    }
    if (url.pathname === '/__preview' && request.method === 'GET') {
      return new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Frigo isolated preview</title><h1>Frigo — dữ liệu thử nghiệm</h1>
        <p>Isolated, synthetic data only. No external providers or production database.</p>
        <form method="post" action="/__preview/login"><button>Đăng nhập tài khoản thử nghiệm</button></form>
        <form method="post" action="/__preview/reset"><button>Đặt lại dữ liệu thử nghiệm và đăng nhập</button></form>
        <p>Login uses a real registered cookie session. Reset clears this preview's in-memory database.</p></html>`,
      { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    // Even synthetic reset/login must not become a cross-site mutation gadget.
    if (request.headers.get('Origin') !== url.origin ||
      ['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'))) {
      return Response.json({ code: 'PREVIEW_ORIGIN_DENIED' }, { status: 403, headers });
    }
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
    if (url.pathname === '/__preview/state') {
      return Response.json(previewFixtureState(getDatabase()), { headers });
    }
    if (url.pathname === '/__preview/t13-scans') {
      return Response.json(seedT13ReviewEvidence(getDatabase(), PREVIEW_HOUSEHOLD_ID, PREVIEW_USER_ID), { headers });
    }
    if (url.pathname === '/__preview/stale-inventory') {
      getDatabase().execute("UPDATE inventory_items SET quantity = quantity + 1, version = version + 1 WHERE id = 'preview-stock-chicken'");
      return Response.json({ changed: true }, { headers });
    }
    if (!['/__preview/login', '/__preview/reset'].includes(url.pathname)) {
      return new Response(null, { status: 404, headers });
    }
    if (url.pathname === '/__preview/reset') await resetDatabase();
    const cookie = issuePreviewSession(getDatabase());
    if (request.headers.get('Accept')?.includes('application/json')) {
      return Response.json({ ready: true, fixture: FIXTURE_VERSION }, { headers: { ...headers, 'Set-Cookie': cookie } });
    }
    return new Response(null, { status: 303, headers: { ...headers, 'Set-Cookie': cookie, Location: '/__preview/ready' } });
  };
}
