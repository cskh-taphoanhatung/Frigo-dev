import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Heart, Utensils, Users } from 'lucide-react';
import { authApi } from '../../services/auth';
import { queryKeys } from '../../lib/queryKeys';
import { isOfflineGuestSession } from '../../lib/private-session';
import { useAuthStore } from '../../stores/useAuthStore';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { Button } from '../../components/common/Button';
import { Page, PageHeader, StickyActions } from '../../design-system/primitives';

const CUISINE_TAGS = [
  { id: 'vietnamese', label: 'Việt Nam' },
  { id: 'korean', label: 'Hàn Quốc' },
  { id: 'japanese', label: 'Nhật Bản' },
  { id: 'western', label: 'Âu - Mỹ' },
  { id: 'chinese', label: 'Trung Hoa' },
  { id: 'thai', label: 'Thái Lan' },
  { id: 'other', label: 'Khác' },
];

const RESTRICTION_TAGS = [
  { id: 'beef', label: 'Thịt bò' },
  { id: 'seafood', label: 'Hải sản' },
  { id: 'peanuts', label: 'Đậu phộng' },
  { id: 'spicy', label: 'Đồ cay' },
  { id: 'mushroom', label: 'Nấm' },
  { id: 'onion_garlic', label: 'Hành tỏi' },
  { id: 'milk', label: 'Sữa' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'other', label: 'Khác' },
];

const SPICY_LEVELS = [
  { id: 'none', label: 'Không cay' },
  { id: 'mild', label: 'Ít cay' },
  { id: 'medium', label: 'Trung bình' },
  { id: 'hot', label: 'Rất cay' },
] as const;

interface Draft {
  householdSize: number;
  spicyLevel: 'none' | 'mild' | 'medium' | 'hot';
  favoriteCuisines: string[];
  dietaryRestrictions: string[];
}

const SPICY_IDS = ['none', 'mild', 'medium', 'hot'] as const;
type SpicyLevel = (typeof SPICY_IDS)[number];
const asSpicyLevel = (v: unknown, fallback: SpicyLevel = 'medium'): SpicyLevel =>
  SPICY_IDS.includes(v as SpicyLevel) ? (v as SpicyLevel) : fallback;

/**
 * T17 screen 20 — dedicated food-preferences editor over the real
 * GET/PATCH /preferences contract. Values round-trip to the server
 * representation without lossy conversion; no client-side fake truth.
 */
export const FoodPreferencesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  const isGuestOffline = isOfflineGuestSession();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prefsQuery = useQuery({
    queryKey: queryKeys.foodPreferences(),
    queryFn: () => authApi.getFoodPreferences(),
    enabled: !isGuestOffline,
  });

  useEffect(() => {
    if (draft) return;
    if (!isGuestOffline && prefsQuery.data) {
      const p = prefsQuery.data;
      setDraft({
        householdSize: p.householdSize ?? auth.householdSize ?? 2,
        spicyLevel: asSpicyLevel(p.spicyLevel ?? auth.spicyLevel),
        favoriteCuisines: p.favoriteCuisines ?? auth.favoriteCuisines ?? ['vietnamese'],
        dietaryRestrictions: p.dietaryRestrictions ?? auth.dietaryRestrictions ?? [],
      });
    } else if (isGuestOffline) {
      setDraft({
        householdSize: auth.householdSize ?? 2,
        spicyLevel: asSpicyLevel(auth.spicyLevel),
        favoriteCuisines: auth.favoriteCuisines ?? ['vietnamese'],
        dietaryRestrictions: auth.dietaryRestrictions ?? [],
      });
    }
  }, [draft, isGuestOffline, prefsQuery.data, auth.householdSize, auth.spicyLevel, auth.favoriteCuisines, auth.dietaryRestrictions]);

  const toggleTag = (id: string, list: 'favoriteCuisines' | 'dietaryRestrictions') =>
    setDraft((prev) => {
      if (!prev) return prev;
      const values = prev[list];
      return { ...prev, [list]: values.includes(id) ? values.filter((v) => v !== id) : [...values, id] };
    });

  const save = async () => {
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      if (!isGuestOffline) {
        await authApi.updateFoodPreferences(draft);
        // Server is the authority for the saved profile; drop the stale read.
        await queryClient.invalidateQueries({ queryKey: queryKeys.foodPreferences() });
      }
      // Preference-only store update: never flips onboarding completion,
      // which is server truth (screen 20 acceptance).
      auth.setOnboardingFromServer(auth.isOnboarded, draft);
      setSavedAt(Date.now());
    } catch {
      setError('Chưa thể lưu sở thích. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const chip = (selected: boolean, tone: 'action' | 'warning' = 'action') =>
    `h-11 px-4 rounded-pill text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
      selected
        ? tone === 'action'
          ? 'bg-semantic-success-soft text-semantic-action-primary border-semantic-action-primary/40 font-semibold'
          : 'bg-semantic-warning-soft text-semantic-warning border-semantic-warning/40'
        : 'bg-semantic-surface text-semantic-text-secondary border-semantic-border'
    }`;

  return (
    <Page width="compact">
      <PageHeader
        title="Sở thích & hạn chế"
        subtitle="Gu món ăn giúp Takosan gợi ý món sát hơn"
        onBack={() => navigate('/me')}
      />

      {isGuestOffline && (
        <p className="text-xs text-semantic-text-muted mb-3">
          Phiên dùng thử ngoại tuyến: thay đổi chỉ áp dụng cho thiết bị này.
        </p>
      )}

      {prefsQuery.isPending && !draft && <InlineLoading label="Đang tải sở thích…" />}
      {prefsQuery.isError && (
        <InlineError error={prefsQuery.error} onRetry={() => prefsQuery.refetch()} />
      )}

      {draft && (
        <div className="space-y-4 pb-8">
          <fieldset>
            <legend className="text-type-label text-semantic-text-primary flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Số người thường ăn
            </legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={draft.householdSize === n}
                  onClick={() => setDraft({ ...draft, householdSize: n })}
                  className={`h-11 min-w-11 px-4 rounded-pill text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.householdSize === n
                      ? 'bg-semantic-action-primary text-semantic-text-inverse border-transparent'
                      : 'bg-semantic-surface text-semantic-text-secondary border-semantic-border hover:border-semantic-border-strong'
                  }`}
                >
                  {n === 5 ? '5+' : n}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-type-label text-semantic-text-primary flex items-center gap-2 mb-2">
              <Utensils className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Món ưa thích
            </legend>
            <div className="flex flex-wrap gap-2">
              {CUISINE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={draft.favoriteCuisines.includes(tag.id)}
                  onClick={() => toggleTag(tag.id, 'favoriteCuisines')}
                  className={chip(draft.favoriteCuisines.includes(tag.id))}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-type-label text-semantic-text-primary flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Nguyên liệu hạn chế
            </legend>
            <div className="flex flex-wrap gap-2">
              {RESTRICTION_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={draft.dietaryRestrictions.includes(tag.id)}
                  onClick={() => toggleTag(tag.id, 'dietaryRestrictions')}
                  className={chip(draft.dietaryRestrictions.includes(tag.id), 'warning')}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-semantic-text-muted mt-2">
              Giới hạn này giúp lọc gợi ý, không thay thế tư vấn y tế.
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-type-label text-semantic-text-primary flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Mức độ cay
            </legend>
            <div className="flex flex-wrap gap-2">
              {SPICY_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  aria-pressed={draft.spicyLevel === level.id}
                  onClick={() => setDraft({ ...draft, spicyLevel: level.id })}
                  className={chip(draft.spicyLevel === level.id)}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-semantic-danger">
              {error}
            </p>
          )}
          {savedAt && !error && (
            <p role="status" className="text-sm text-semantic-success">
              Đã lưu sở thích.
            </p>
          )}

          <StickyActions>
            <Button variant="primary" fullWidth onClick={save} disabled={saving} isLoading={saving}>
              Lưu sở thích
            </Button>
          </StickyActions>
        </div>
      )}
    </Page>
  );
};
