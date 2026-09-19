import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { RecipeCard } from '../components/common/RecipeCard';
import { EmptyState } from '../components/common/EmptyState';
import { InlineLoading, InlineError, SkeletonCard } from '../components/common/AsyncState';
import { api } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { formatVndCompact, daysUntil } from '../lib/format';
import { presentExpiry } from '../lib/inventory-truth';
import { findTodayMeal } from '../lib/home-meal';
import { getIngredientImage } from '../lib/ingredient-images';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { MealPlan, MealSlotItem } from '@frigo/domain';
import {
  Bell,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Flame,
  Clock,
  Users,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import { clsx } from 'clsx';
import { resolveRecipeImage, recipeImageErrorHandler } from '../lib/recipe-media';

const SLOT_LABELS: Record<MealSlotItem['slotType'], string> = {
  breakfast: 'Bữa sáng hôm nay',
  lunch: 'Bữa trưa hôm nay',
  dinner: 'Bữa tối hôm nay',
};

function planProgress(plan: MealPlan): { planned: number; total: number } {
  let planned = 0;
  let total = 0;
  for (const day of plan.days) {
    for (const slot of day.slots) {
      total += 1;
      if (slot.recipe || slot.status === 'COOKED' || slot.status === 'LEFTOVER') planned += 1;
    }
  }
  return { planned, total };
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { displayName, avatarUrl } = useAuthStore();

  const [noBuyOnly, setNoBuyOnly] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    const timer = window.setInterval(updateClock, 60_000);
    window.addEventListener('focus', updateClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateClock);
    };
  }, []);

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });

  const recommendationsQuery = useQuery({
    queryKey: queryKeys.recommendations({ noBuy: noBuyOnly, cuisine: selectedCuisine }),
    queryFn: () =>
      api.getRecommendations({ noBuy: noBuyOnly, cuisine: selectedCuisine || undefined }),
  });

  const weekPlanQuery = useQuery({
    queryKey: queryKeys.currentWeekPlan(),
    queryFn: () => api.getCurrentWeekPlan(),
  });

  const weekPlan = weekPlanQuery.data ?? null;
  const todayMeal = findTodayMeal(weekPlan, now);
  const inventory = inventoryQuery.data ?? [];

  // Real use-soon list: items that expire soonest, from live inventory.
  const useSoonItems = inventory
    .filter((i: any) => i.freshness === 'use_soon' || i.freshness === 'expiring')
    .sort((a: any, b: any) => (daysUntil(presentExpiry(a).date ?? undefined) ?? 99) - (daysUntil(presentExpiry(b).date ?? undefined) ?? 99))
    .slice(0, 8);

  const cuisinesList = [
    { id: null, label: 'Tất cả' },
    { id: 'vietnamese', label: '🇻🇳 Món Việt' },
    { id: 'korean', label: '🇰🇷 Món Hàn' },
    { id: 'japanese', label: '🇯🇵 Món Nhật' },
    { id: 'chinese', label: '🇨🇳 Trung Hoa' },
    { id: 'thai', label: '🇹🇭 Món Thái' },
    { id: 'italian', label: '🇮🇹 Món Ý' },
  ];

  const firstName = displayName ? displayName.split(' ').pop() : null;

  return (
    <div className="min-h-screen bg-takosan-cream pb-28">
      {/* HEADER: Avatar + Xin chào + Notification Bell */}
      <header className="sticky top-0 z-30 bg-takosan-cream/95 backdrop-blur-md px-4 py-3.5 border-b border-takosan-cream-line flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/me')}
            aria-label="Trang cá nhân"
            className="w-11 h-11 rounded-full border-2 border-takosan-green ring-2 ring-takosan-mint bg-takosan-mint overflow-hidden cursor-pointer active:scale-95 transition-transform shrink-0"
          >
            <img
              src={avatarUrl || TAKOSAN_BRAND.symbol}
              alt=""
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          </button>
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-lg text-takosan-navy leading-tight truncate">
              Xin chào{firstName ? `, ${firstName}` : ''}! 👋
            </h1>
            <p className="text-xs text-slate-500 font-medium truncate">Hôm nay ăn gì đây?</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="shrink-0 w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-700 transition-tap tap-target"
          aria-label="Thông báo"
        >
          <Bell className="w-5.5 h-5.5 stroke-[2]" />
        </button>
      </header>

      <div className="px-4 pt-4 space-y-5 animate-fade-in">
        {/* HERO: today's meal from the live Week plan */}
        {weekPlanQuery.isPending ? (
          <SkeletonCard className="h-36 rounded-3xl" />
        ) : weekPlanQuery.isError ? (
          <InlineError error={weekPlanQuery.error} onRetry={() => weekPlanQuery.refetch()} />
        ) : todayMeal && todayMeal.recipe ? (
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-takosan-green via-takosan-green-hover to-takosan-green-deep shadow-elevated">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-takosan-mint/20 blur-2xl" />
            <div className="absolute -bottom-14 -left-8 w-36 h-36 rounded-full bg-takosan-yellow/10 blur-2xl" />

            <div className="relative p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-widest text-takosan-mint bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
                  <Flame className="w-3 h-3 text-takosan-yellow" />
                  {SLOT_LABELS[todayMeal.slotType]}
                </span>
                <h3 className="font-heading font-extrabold text-xl text-white leading-snug">
                  {todayMeal.recipe.title}
                </h3>
                <div className="flex items-center gap-3 text-[11px] font-medium text-white/80">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {todayMeal.recipe.cookTimeMinutes} phút
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {todayMeal.servings} người
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/cook/${todayMeal.recipe!.slug}`)}
                  className="mt-1 px-5 py-2.5 rounded-xl bg-white hover:bg-takosan-cream text-takosan-green font-heading font-bold text-sm shadow-float active:scale-95 transition-tap flex items-center gap-2 tap-target"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Bắt đầu nấu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-takosan-coral/40 blur-xl scale-110" />
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-[3px] border-white/30 ring-4 ring-white/10 shadow-lg">
                  <img
                    src={resolveRecipeImage(todayMeal.recipe, TAKOSAN_BRAND.symbol).src}
                    alt={todayMeal.recipe.title}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    onError={recipeImageErrorHandler(resolveRecipeImage(todayMeal.recipe, TAKOSAN_BRAND.symbol).fallbackSrc)}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-takosan-green via-takosan-green-hover to-takosan-green-deep shadow-elevated">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-takosan-mint/20 blur-2xl" />
            <div className="relative p-5 space-y-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-widest text-takosan-mint bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
                <CalendarDays className="w-3 h-3 text-takosan-yellow" />
                Hôm nay
              </span>
              <h3 className="font-heading font-extrabold text-lg text-white leading-snug">
                {weekPlan ? 'Không có bữa cần nấu tiếp hôm nay' : 'Chưa có thực đơn tuần này'}
              </h3>
              <p className="text-xs text-white/80">
                {weekPlan
                  ? 'Xem lại các bữa đã lên lịch hoặc thêm món trong thực đơn tuần.'
                  : 'Lên thực đơn để Takosan gợi ý món từ nguyên liệu sẵn có.'}
              </p>
              <button
                onClick={() => navigate(weekPlan ? `/week/${weekPlan.id}` : '/week/setup')}
                className="mt-1 px-5 py-2.5 rounded-xl bg-white hover:bg-takosan-cream text-takosan-green font-heading font-bold text-sm shadow-float active:scale-95 transition-tap inline-flex items-center gap-2 tap-target"
              >
                <Sparkles className="w-4 h-4" />
                <span>{weekPlan ? 'Xem thực đơn tuần' : 'Lên thực đơn tuần'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* CARD 2: TUẦN NÀY — real progress from the plan */}
        {weekPlan && !weekPlanQuery.isError && (() => {
          const { planned, total } = planProgress(weekPlan);
          const percent = total > 0 ? Math.round((planned / total) * 100) : 0;
          const budget = weekPlan.budget;
          return (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card flex items-center justify-between gap-3 relative overflow-hidden">
              <div className="space-y-1.5 min-w-0 flex-1">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-slate-400 block">
                  TUẦN NÀY
                </span>
                <h3 className="font-heading font-bold text-base text-takosan-navy">
                  {planned}/{total} bữa đã lên thực đơn
                </h3>
                <div
                  className="w-full max-w-[180px] h-2 rounded-full bg-slate-100 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Tiến độ thực đơn tuần"
                >
                  <div
                    className="h-full rounded-full bg-takosan-green"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {budget && budget.targetVnd ? (
                  <p className="text-xs text-slate-500 font-medium">
                    {formatVndCompact(budget.estimatedMaxVnd)} /{' '}
                    {formatVndCompact(budget.targetVnd)} ngân sách
                  </p>
                ) : budget?.displayText ? (
                  <p className="text-xs text-slate-500 font-medium">{budget.displayText}</p>
                ) : null}
              </div>

              <button
                onClick={() => navigate(`/week/${weekPlan.id}`)}
                className="shrink-0 px-4 py-2.5 rounded-xl bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep hover:bg-takosan-mint-hover text-xs font-heading font-bold active:scale-95 transition-tap flex items-center gap-1.5 tap-target"
              >
                <span>Xem thực đơn</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })()}

        {/* SECTION 3: NÊN DÙNG SỚM — real expiring items from inventory */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="font-heading font-bold text-xs text-slate-800 uppercase tracking-wider">
              NÊN DÙNG SỚM
            </h4>
            <button
              onClick={() => navigate('/fridge')}
              className="text-[11px] font-semibold text-takosan-green hover:text-takosan-green-deep flex items-center tap-target"
            >
              Xem tất cả{inventoryQuery.isSuccess ? ` (${inventory.length})` : ''}{' '}
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {inventoryQuery.isPending ? (
            <div className="flex gap-2.5">
              <SkeletonCard className="h-28 min-w-[104px]" />
              <SkeletonCard className="h-28 min-w-[104px]" />
              <SkeletonCard className="h-28 min-w-[104px]" />
            </div>
          ) : inventoryQuery.isError ? (
            <InlineError error={inventoryQuery.error} onRetry={() => inventoryQuery.refetch()} />
          ) : useSoonItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 text-center">
              <p className="text-xs text-slate-600 font-medium">
                {inventory.length === 0
                  ? 'Tủ lạnh đang trống. Quét hoặc thêm nguyên liệu để bắt đầu nhé.'
                  : 'Tuyệt! Không có nguyên liệu nào sắp hết hạn.'}
              </p>
              {inventory.length === 0 && (
                <button
                  onClick={() => navigate('/scan')}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep text-xs font-heading font-bold hover:bg-takosan-mint-hover active:scale-95 transition-tap tap-target"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Quét tủ lạnh
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-0.5">
              {useSoonItems.map((item: any) => {
                // T13R-B P2-5: the shared presenter decides what the date IS.
                // An ESTIMATED date is shown with an explicit estimate qualifier
                // so it is never visually identical to a KNOWN countdown; an
                // UNKNOWN date shows no countdown at all.
                const expiry = presentExpiry(item);
                const days = expiry.date === null ? null : daysUntil(expiry.date);
                const label = expiry.tone === 'unknown' || days === null ? 'Chưa rõ hạn dùng'
                  : expiry.tone === 'expired' ? (expiry.estimated ? 'Ước tính đã quá hạn' : '⏳ Đã quá hạn')
                    : expiry.estimated ? (days <= 0 ? 'Ước tính hết hạn hôm nay' : `Ước tính còn ${days} ngày`)
                      : (days <= 0 ? '⏳ Hôm nay' : `⏳ ${days} ngày`);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/ingredients/${item.id}`)}
                    className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-card flex flex-col items-center justify-center min-w-[104px] shrink-0 cursor-pointer active:scale-95 transition-transform hover:border-amber-300 hover:shadow-elevated"
                  >
                    <div className="w-14 h-14 overflow-hidden flex items-center justify-center mb-1.5">
                      <img
                        src={getIngredientImage(item.ingredientId, item.name)}
                        alt={item.name}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="font-heading font-bold text-xs text-takosan-navy leading-tight">
                      {item.name}
                    </p>
                    <span
                      className={expiry.estimated
                        ? 'text-[10px] font-bold text-sky-900 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 mt-1.5'
                        : 'text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 mt-1.5'}
                      data-testid="home-use-soon-expiry"
                      data-expiry-kind={expiry.tone === 'unknown' ? 'UNKNOWN' : expiry.estimated ? 'ESTIMATED' : 'KNOWN'}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 4: GỢI Ý MÓN NGON */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-heading font-bold text-sm text-takosan-navy">
              Gợi ý cho bạn
            </h4>

            <button
              onClick={() => setNoBuyOnly(!noBuyOnly)}
              aria-pressed={noBuyOnly}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-tap flex items-center gap-1.5 shadow-xs cursor-pointer',
                noBuyOnly
                  ? 'bg-takosan-green text-white border border-takosan-green'
                  : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50'
              )}
            >
              <CheckCircle className={clsx('w-3.5 h-3.5', noBuyOnly ? 'text-takosan-mint' : 'text-takosan-green')} />
              <span>Không mua thêm gì</span>
            </button>
          </div>

          {/* Cuisine Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5" role="group" aria-label="Lọc theo ẩm thực">
            {cuisinesList.map((c) => {
              const active = selectedCuisine === c.id;
              return (
                <button
                  key={c.label}
                  onClick={() => setSelectedCuisine(c.id)}
                  aria-pressed={active}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-full text-xs font-heading font-semibold whitespace-nowrap transition-tap tap-target cursor-pointer',
                    active
                      ? 'bg-takosan-green text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Recipe List */}
          <div className="space-y-3 pt-1">
            {recommendationsQuery.isPending ? (
              <InlineLoading label="Đang tìm món tối ưu…" />
            ) : recommendationsQuery.isError ? (
              <InlineError
                error={recommendationsQuery.error}
                onRetry={() => recommendationsQuery.refetch()}
              />
            ) : (recommendationsQuery.data ?? []).length === 0 ? (
              <EmptyState
                type="no-recipes"
                title="Chưa tìm thấy món phù hợp"
                description="Hãy thử tắt bộ lọc 'Không mua thêm gì' hoặc quét thêm nguyên liệu vào tủ lạnh nhé."
                actionText="Xem tất cả công thức"
                onAction={() => {
                  setNoBuyOnly(false);
                  setSelectedCuisine(null);
                }}
              />
            ) : (
              (recommendationsQuery.data ?? []).slice(0, 5).map((match) => (
                <RecipeCard
                  key={match.recipe.id}
                  matchResult={match}
                  onClick={() => navigate(`/recipes/${match.recipe.slug}`)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
