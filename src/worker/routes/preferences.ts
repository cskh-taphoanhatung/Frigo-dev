import { Hono } from 'hono';
import { Env, AuthContext } from '../types';
import { SQL } from '@frigo/db';
import { z } from 'zod';

export const preferencesRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const DEFAULT_PREFERENCES = {
  householdSize: 2,
  spicyLevel: 'medium',
  favoriteCuisines: ['vietnamese'],
  dietaryRestrictions: [],
  language: 'vi',
};

const PreferencesPatchSchema = z.object({
  householdSize: z.coerce.number().int().min(1).max(20).optional(),
  spicyLevel: z.enum(['none', 'mild', 'medium', 'hot']).optional(),
  favoriteCuisines: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  language: z.enum(['vi', 'en']).optional(),
  completeOnboarding: z.boolean().optional(),
});

// GET /api/v1/preferences
preferencesRoutes.get('/preferences', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;

  if (db) {
    try {
      const pref = await db.prepare(SQL.GET_USER_PREFERENCES).bind(auth.userId).first<any>();
      if (pref) {
        return c.json({
          preferences: {
            householdSize: pref.household_size,
            spicyLevel: pref.spicy_level,
            favoriteCuisines:
              typeof pref.favorite_cuisines === 'string'
                ? JSON.parse(pref.favorite_cuisines)
                : pref.favorite_cuisines,
            dietaryRestrictions:
              typeof pref.dietary_restrictions === 'string'
                ? JSON.parse(pref.dietary_restrictions)
                : pref.dietary_restrictions,
            language: pref.language,
          },
        });
      }
    } catch (err) {
      console.error('Failed querying user_preferences from D1:', err);
    }
  }

  return c.json({ preferences: DEFAULT_PREFERENCES });
});

// PATCH /api/v1/preferences
preferencesRoutes.patch('/preferences', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable' }, 503);
  }

  const parsed = PreferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0]?.message || 'Tùy chọn không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const existing = await db.prepare(SQL.GET_USER_PREFERENCES).bind(auth.userId).first<any>();

    const patch = parsed.data;
    const householdSize = patch.householdSize ?? existing?.household_size ?? 2;
    const spicyLevel = patch.spicyLevel ?? existing?.spicy_level ?? 'medium';
    const favoriteCuisines = patch.favoriteCuisines ?? (existing?.favorite_cuisines ? JSON.parse(existing.favorite_cuisines) : ['vietnamese']);
    const dietaryRestrictions = patch.dietaryRestrictions ?? (existing?.dietary_restrictions ? JSON.parse(existing.dietary_restrictions) : []);
    const language = patch.language ?? existing?.language ?? 'vi';

    const statements = [db.prepare(
        `INSERT INTO user_preferences (id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions, language, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           household_size = excluded.household_size,
           spicy_level = excluded.spicy_level,
           favorite_cuisines = excluded.favorite_cuisines,
           dietary_restrictions = excluded.dietary_restrictions,
           language = excluded.language,
           updated_at = datetime('now')`
      ).bind(
        `pref_${auth.userId}`,
        auth.userId,
        householdSize,
        spicyLevel,
        JSON.stringify(favoriteCuisines),
        JSON.stringify(dietaryRestrictions),
        language
      )];
    if (patch.completeOnboarding) {
      statements.push(db.prepare(
        "UPDATE profiles SET onboarding_completed_at = COALESCE(onboarding_completed_at, datetime('now')), updated_at = datetime('now') WHERE user_id = ?"
      ).bind(auth.userId));
    }
    const results = await db.batch(statements);
    if (patch.completeOnboarding && results.at(-1)?.meta?.changes !== 1) {
      throw new Error('PROFILE_NOT_FOUND');
    }

    const updated = {
      householdSize,
      spicyLevel,
      favoriteCuisines,
      dietaryRestrictions,
      language,
    };

    return c.json({
      success: true,
      preferences: updated,
      onboardingCompleted: patch.completeOnboarding ? true : undefined,
    });
  } catch (err) {
    console.error('Failed saving user_preferences to D1:', err);
    return c.json({ error: 'Lỗi cập nhật tùy chọn người dùng', code: 'DATABASE_ERROR' }, 500);
  }
});
