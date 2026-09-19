import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeekStore } from '../stores/useWeekStore';
import { TopBar } from '../components/common/TopBar';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { MealSwapSheet } from '../features/week/MealSwapSheet';
import { getIngredientImage } from '../lib/ingredient-images';
import { queryKeys } from '../lib/queryKeys';
import { api } from '../services/api';
import { Clock, Users, ChefHat, ArrowRightLeft, Check, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { resolveRecipeImage, recipeImageErrorHandler } from '../lib/recipe-media';

export const MealDetailPage: React.FC = () => {
  const { planId, mealId } = useParams<{ planId: string; mealId: string }>();
  const navigate = useNavigate();

  const { openSwap, error: workflowError } = useWeekStore();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps' | 'nutrition'>('ingredients');
  const planQuery = useQuery({
    queryKey: queryKeys.weekPlan(planId || ''),
    queryFn: () => api.getWeekPlan(planId!),
    enabled: Boolean(planId),
  });
  const currentPlan = planQuery.data ?? null;

  useEffect(() => {
    if (currentPlan) useWeekStore.setState({ currentPlan });
  }, [currentPlan]);

  if (planQuery.isError || !currentPlan) {
    return (
      <div className="min-h-screen bg-takosan-cream pb-24">
        <TopBar showBack title="Chi tiết món ăn" />
        <div className="p-4">
          {planQuery.isError ? (
            <InlineError error={planQuery.error} onRetry={() => planQuery.refetch()} />
          ) : planId && planQuery.isPending ? (
            <InlineLoading label="Đang tải thực đơn…" />
          ) : (
            <p role="status" className="py-12 text-center text-sm text-slate-600">Không tìm thấy thực đơn này.</p>
          )}
        </div>
      </div>
    );
  }

  // Find slot
  let targetSlot: any;
  let targetDay: any;
  for (const day of currentPlan.days) {
    const s = day.slots.find((slot: any) => slot.id === mealId);
    if (s) {
      targetSlot = s;
      targetDay = day;
      break;
    }
  }

  if (!targetSlot || !targetSlot.recipe) {
    return (
      <div className="min-h-screen bg-takosan-cream pb-24">
        <TopBar showBack title="Chi tiết món ăn" />
        <div className="p-6 text-center text-xs text-slate-500 font-medium">
          Không tìm thấy thông tin món ăn này.
          <button
            className="mt-4 px-4 py-2 rounded-xl bg-takosan-green text-white font-bold"
            onClick={() => navigate(-1)}
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const recipe = targetSlot.recipe;

  return (
    <div className="min-h-screen bg-takosan-cream pb-32">
      <TopBar
        showBack
        title={targetSlot.recipe.title}
        subtitle={`${targetDay.dayNameVi} • ${targetSlot.slotType === 'breakfast' ? 'Bữa sáng' : targetSlot.slotType === 'lunch' ? 'Bữa trưa' : 'Bữa tối'}`}
      />

      <div className="px-4 pt-3 space-y-4">
        {workflowError && <InlineError message={workflowError} />}
        {/* Hero Recipe Photo & Quick Specs */}
        <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-slate-100 shadow-xs border border-slate-200/60">
          <img
            src={resolveRecipeImage(recipe).src}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={recipeImageErrorHandler(resolveRecipeImage(recipe).fallbackSrc)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

          <div className="absolute bottom-3.5 left-4 right-4 text-white">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-heading font-semibold uppercase px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20">
                {recipe.cuisine === 'vietnamese' ? 'Việt Nam' : recipe.cuisine}
              </span>
              {recipe.nutrition?.calories != null && (
                <span className="text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full bg-takosan-green text-white shadow-xs">
                  {recipe.nutrition.calories} cal/phần
                </span>
              )}
              <span className="text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                {targetSlot.incrementalCostVnd === 0 ? '0đ có sẵn' : `~${Math.round(targetSlot.incrementalCostVnd / 1000)}k`}
              </span>
            </div>

            <h2 className="font-heading font-bold text-2xl leading-tight text-white">
              {recipe.title}
            </h2>

            <div className="flex items-center gap-4 text-xs mt-1 text-slate-200">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-takosan-mint" />
                <span>{recipe.cookTimeMinutes} phút</span>
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-takosan-mint" />
                <span>{targetSlot.servings} người ăn</span>
              </span>
            </div>
          </div>
        </div>

        {/* Smart Expiry Optimization Banner matching screen 5.2 */}
        {targetSlot.rescuedExpiringIngredients.length > 0 && <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-amber-950 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-200/70 flex items-center justify-center shrink-0 text-amber-800">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="font-heading font-bold text-xs text-amber-900">
              Tối ưu tủ lạnh
            </p>
            <p className="text-[11px] text-amber-800/90 mt-0.5">
              Ưu tiên nguyên liệu sắp hết hạn: {targetSlot.rescuedExpiringIngredients.join(', ')}
            </p>
          </div>
        </div>}

        {/* Segmented 3 Tabs: Nguyên liệu | Cách nấu | Dinh dưỡng */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl">
          {[
            { id: 'ingredients' as const, label: 'Nguyên liệu' },
            { id: 'steps' as const, label: 'Cách nấu' },
            { id: 'nutrition' as const, label: 'Dinh dưỡng' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={clsx(
                'flex-1 py-2 rounded-lg text-xs font-heading font-bold transition-tap tap-target',
                activeTab === tab.id
                  ? 'bg-white text-takosan-green shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Nguyên liệu (Have vs Need) */}
        {activeTab === 'ingredients' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-heading font-bold text-sm text-slate-900">
                Nguyên liệu ({targetSlot.ingredients.length} món)
              </h3>
              <span className="text-xs font-bold text-takosan-green-deep bg-takosan-mint px-2.5 py-0.5 rounded-full border border-takosan-mint-deep/60">
                Có sẵn {targetSlot.availabilityPercent}%
              </span>
            </div>

            <div className="space-y-2">
              {targetSlot.ingredients.map((ing: any) => {
                const imgSrc = getIngredientImage(ing.ingredientId, ing.name);
                const isMissing = ing.missingQuantity > 0;

                return (
                  <div
                    key={ing.ingredientId}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 p-1.5">
                        <img
                          src={imgSrc}
                          alt={ing.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-xs text-slate-900 truncate">
                          {ing.name}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Cần: <span className="font-semibold text-slate-800">{ing.requiredQuantity} {ing.unit}</span>
                          {ing.availableQuantity > 0 && (
                            <span> • Có sẵn: {ing.availableQuantity} {ing.unit}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      {isMissing ? (
                        <div className="text-xs">
                          <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Cần mua {ing.missingQuantity} {ing.unit}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-takosan-green-deep bg-takosan-mint px-2.5 py-0.5 rounded-md border border-takosan-mint-deep/60">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Có sẵn
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Cách nấu */}
        {activeTab === 'steps' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3.5 animate-fade-in">
            <h3 className="font-heading font-bold text-sm text-slate-900 mb-2">
              Các bước chế biến
            </h3>
            <div className="space-y-3">
              {recipe.steps?.map((step: any, idx: number) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-takosan-mint text-takosan-green-deep font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 text-xs text-slate-700 leading-relaxed">
                    <p className="font-heading font-bold text-slate-900 mb-0.5">
                      {step.title || `Bước ${idx + 1}`}
                    </p>
                    <p>{step.instruction}</p>
                  </div>
                </div>
              )) || (
                <p className="text-xs text-slate-500">Mở chế độ nấu để xem chi tiết từng bước.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Dinh dưỡng */}
        {activeTab === 'nutrition' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3 animate-fade-in">
            <h3 className="font-heading font-bold text-sm text-slate-900">
              Giá trị dinh dưỡng (mỗi phần ăn)
            </h3>
            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Calories</p>
                <p className="font-heading font-bold text-base text-slate-900 mt-1">
                  {recipe.nutrition?.calories ?? '—'}
                </p>
                <p className="text-[10px] text-slate-400">kcal</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Đạm</p>
                <p className="font-heading font-bold text-base text-slate-900 mt-1">
                  {recipe.nutrition?.proteinG ?? '—'}
                </p>
                <p className="text-[10px] text-slate-400">g</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Béo</p>
                <p className="font-heading font-bold text-base text-slate-900 mt-1">
                  {recipe.nutrition?.fatG ?? '—'}
                </p>
                <p className="text-[10px] text-slate-400">g</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Carb</p>
                <p className="font-heading font-bold text-base text-slate-900 mt-1">
                  {recipe.nutrition?.carbG ?? '—'}
                </p>
                <p className="text-[10px] text-slate-400">g</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Dual Action Buttons matching Screen 5.2 */}
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 md:left-20 lg:left-64 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-30 flex gap-3 shadow-lg">
        <button
          onClick={() => openSwap(mealId!)}
          className="flex-1 py-3.5 px-4 rounded-2xl bg-white border-2 border-takosan-green text-takosan-green-deep font-heading font-bold text-sm hover:bg-takosan-mint active:scale-98 transition-tap flex items-center justify-center gap-1.5"
        >
          <ArrowRightLeft className="w-4 h-4 text-takosan-green" />
          <span>Đổi món</span>
        </button>

        <button
          onClick={() => navigate(`/cook/${recipe.slug}`)}
          className="flex-1 py-3.5 px-4 rounded-2xl bg-takosan-green hover:bg-takosan-green-hover text-white font-heading font-bold text-sm shadow-md active:scale-98 transition-tap flex items-center justify-center gap-2"
        >
          <ChefHat className="w-5 h-5" />
          <span>Bắt đầu nấu</span>
        </button>
      </div>

      <MealSwapSheet />
    </div>
  );
};
