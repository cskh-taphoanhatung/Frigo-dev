import { Hono } from 'hono';
import { Env, AuthContext } from '../types';
import { SQL, D1DatabaseBinding } from '@frigo/db';
import { StandardUnit } from '@frigo/domain';
import { resolveRecipeAuthority } from '../services/recipe-authority';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import { ShoppingItemCreateSchema, ShoppingItemUpdateSchema } from '../validation/schemas';

export const shoppingRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// Enforce multi-tenancy on all shopping list routes
shoppingRoutes.use('/shopping-list*', tenancyGuard);

// Cap shopping-list mutations per user (reads are cheap)
shoppingRoutes.use(
  '/shopping-list',
  async (c, next) => (c.req.method === 'GET' ? next() : rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'rl_shop_w' })(c, next))
);
shoppingRoutes.use(
  '/shopping-list/*',
  async (c, next) => (c.req.method === 'GET' ? next() : rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'rl_shop_w' })(c, next))
);

async function getOrCreateShoppingList(db: D1DatabaseBinding, householdId: string): Promise<string> {
  const existing = await db
    .prepare('SELECT id FROM shopping_lists WHERE household_id = ? LIMIT 1')
    .bind(householdId)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const listId = `list_${householdId}`;
  await db
    .prepare('INSERT OR IGNORE INTO shopping_lists (id, household_id, name) VALUES (?, ?, ?)')
    .bind(listId, householdId, 'Danh sách mua sắm')
    .run();
  return listId;
}

// GET /api/v1/shopping-list
shoppingRoutes.get('/shopping-list', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    const listId = await getOrCreateShoppingList(db, auth.householdId);
    const res = await db
      .prepare(
        `SELECT id, list_id as listId, ingredient_id as ingredientId, name, quantity, unit, is_checked as isChecked, source_recipe_id as sourceRecipeId, created_at as createdAt 
         FROM shopping_items 
         WHERE list_id = ? 
         ORDER BY is_checked ASC, created_at DESC`
      )
      .bind(listId)
      .all();

    const items = (res.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit as StandardUnit,
      isChecked: Boolean(row.isChecked),
      sourceRecipeTitle: row.sourceRecipeId || '',
      createdAt: row.createdAt,
    }));

    return c.json({ items });
  } catch (err) {
    console.error('D1 GET shopping list failed:', err);
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
});

// POST /api/v1/shopping-list/items
shoppingRoutes.post('/shopping-list/items', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;

  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = ShoppingItemCreateSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.errors[0]?.message || 'Dữ liệu mặt hàng không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  const body = parseResult.data;

  const newItem = {
    id: body.id || `shop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: body.name.trim(),
    quantity: Number(body.quantity) || 1,
    unit: body.unit || 'piece',
    isChecked: false,
    sourceRecipeTitle: body.sourceRecipeTitle || null,
    createdAt: new Date().toISOString(),
  };

  if (!db) {
    return c.json({ error: 'Database service unavailable' }, 503);
  }

  try {
    const listId = await getOrCreateShoppingList(db, auth.householdId);

    // A client-generated id makes an offline replay safe. If the id already
    // exists, only return it when it belongs to this household's list.
    if (body.id) {
      const existingById = await db
        .prepare(
          `SELECT si.*, sl.household_id
           FROM shopping_items si
           JOIN shopping_lists sl ON si.list_id = sl.id
           WHERE si.id = ? LIMIT 1`
        )
        .bind(body.id)
        .first<any>();
      if (existingById && existingById.household_id !== auth.householdId) {
        return c.json({ error: 'ID mặt hàng đã thuộc hộ gia đình khác', code: 'CONFLICT' }, 409);
      }
      if (existingById) {
        return c.json({
          success: true,
          idempotentReplay: true,
          item: {
            id: existingById.id,
            name: existingById.name,
            quantity: existingById.quantity,
            unit: existingById.unit,
            isChecked: Boolean(existingById.is_checked),
            sourceRecipeTitle: existingById.source_recipe_id || null,
            createdAt: existingById.created_at,
          },
        });
      }
    }

    // T14D: source-recipe attribution reads the request's authority snapshot (content only; no inventory path).
    const sourceRef = body.sourceRecipeId || body.sourceRecipeTitle;
    const recipe = sourceRef ? (await resolveRecipeAuthority(c.env, { tenantKey: auth.householdId })).snapshot.findByIdOrSlug(String(sourceRef)) : null;
    const recipeId = recipe ? recipe.id : null;

    if (recipe) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(recipe.id, recipe.slug, recipe.title, recipe.cuisine, recipe.cookTimeMinutes, recipe.servings, recipe.difficulty)
        .run();
    }

    await db
      .prepare(SQL.INSERT_SHOPPING_ITEM.replace(/^INSERT /, 'INSERT OR IGNORE '))
      .bind(newItem.id, listId, body.ingredientId || null, newItem.name, newItem.quantity, newItem.unit, 0, recipeId)
      .run();

    return c.json({ success: true, item: newItem }, 201);
  } catch (err: any) {
    console.error('D1 INSERT_SHOPPING_ITEM failed:', err);
    return c.json({ error: 'Không thể thêm mặt hàng vào danh sách đi chợ', code: 'DATABASE_ERROR' }, 500);
  }
});

// PATCH /api/v1/shopping-list/items/:id
shoppingRoutes.patch('/shopping-list/items/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const db = c.env.DB;

  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = ShoppingItemUpdateSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.errors[0]?.message || 'Dữ liệu cập nhật không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  const body = parseResult.data;

  if (!db) {
    return c.json({ error: 'Database service unavailable' }, 503);
  }

  try {
    // SEC-05 FIX: Tenancy check via shopping_lists table
    const existing = await db
      .prepare(
        `SELECT si.* 
         FROM shopping_items si
         JOIN shopping_lists sl ON si.list_id = sl.id
         WHERE si.id = ? AND sl.household_id = ?`
      )
      .bind(id, auth.householdId)
      .first<any>();

    if (!existing) {
      return c.json({ error: 'Mặt hàng không tồn tại hoặc bạn không có quyền sửa', code: 'NOT_FOUND' }, 404);
    }

    const isChecked = body.isChecked !== undefined ? (body.isChecked ? 1 : 0) : existing.is_checked;
    const quantity = body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
    const name = body.name !== undefined ? body.name.trim() : existing.name;

    const updateResult = await db
      .prepare(
        `UPDATE shopping_items SET is_checked = ?, quantity = ?, name = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(isChecked, quantity, name, id)
      .run();
    if (typeof updateResult?.meta?.changes === 'number' && updateResult.meta.changes !== 1) {
      return c.json({ error: 'Mặt hàng không tồn tại hoặc đã thay đổi', code: 'CONFLICT' }, 409);
    }

    const updatedItem = {
      id,
      name,
      quantity,
      unit: existing.unit,
      isChecked: Boolean(isChecked),
      sourceRecipeTitle: existing.source_recipe_id,
      createdAt: existing.created_at,
    };

    return c.json({ success: true, item: updatedItem });
  } catch (err: any) {
    console.error('D1 PATCH shopping item failed:', err);
    return c.json({ error: 'Lỗi cập nhật mặt hàng', code: 'DATABASE_ERROR' }, 500);
  }
});

// DELETE /api/v1/shopping-list/items/:id
shoppingRoutes.delete('/shopping-list/items/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable' }, 503);
  }

  try {
    // SEC-05 FIX: Tenancy check via shopping_lists table
    const existing = await db
      .prepare(
        `SELECT si.id 
         FROM shopping_items si
         JOIN shopping_lists sl ON si.list_id = sl.id
         WHERE si.id = ? AND sl.household_id = ?`
      )
      .bind(id, auth.householdId)
      .first<{ id: string }>();

    if (!existing) {
      return c.json({ error: 'Mặt hàng không tồn tại hoặc bạn không có quyền xóa', code: 'NOT_FOUND' }, 404);
    }

    const deleteResult = await db.prepare(SQL.DELETE_SHOPPING_ITEM).bind(id).run();
    if (typeof deleteResult?.meta?.changes === 'number' && deleteResult.meta.changes !== 1) {
      return c.json({ error: 'Mặt hàng không tồn tại hoặc đã được xóa', code: 'CONFLICT' }, 409);
    }

    return c.json({ success: true, message: 'Đã xóa mặt hàng thành công' });
  } catch (err: any) {
    console.error('D1 DELETE_SHOPPING_ITEM failed:', err);
    return c.json({ error: 'Lỗi xóa mặt hàng', code: 'DATABASE_ERROR' }, 500);
  }
});
