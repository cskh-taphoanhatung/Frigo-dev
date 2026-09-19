import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TopBar } from '../components/common/TopBar';
import { Button } from '../components/common/Button';
import { InlineError, SkeletonCard } from '../components/common/AsyncState';
import { api, ApiError } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { useCookingStore } from '../stores/useCookingStore';
import { getIngredientImage } from '../lib/ingredient-images';
import { Clock, Users, ChefHat, Check, ShoppingBag, ArrowRight, SearchX } from 'lucide-react';
import { clsx } from 'clsx';
import { resolveRecipeImage, recipeImageErrorHandler } from '../lib/recipe-media';

export const RecipeDetailPage: React.FC = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const recipeKey = slug || id || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const shoppingKey = queryKeys.shoppingList();
  const startCooking = useCookingStore((s) => s.startCooking);

  const [addedToShop, setAddedToShop] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'steps' | 'ingredients' | 'nutrition'>('steps');

  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(recipeKey),
    queryFn: () => api.getRecipeById(recipeKey),
    enabled: Boolean(recipeKey),
  });

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });

  const addToShopping = useMutation({
    mutationFn: (ing: any) =>
      api.addShoppingItem({
        name: ing.name,
        quantity: ing.requiredQuantity,
        unit: ing.unit,
        sourceRecipeTitle: recipeQuery.data?.recipe?.title,
      }),
    onSuccess: (_data, ing) => {
      setAddedToShop((prev) => [...prev, ing.ingredientId]);
      return queryClient.invalidateQueries({ queryKey: shoppingKey });
    },
  });

  const recipe = recipeQuery.data?.recipe;
  const matchInfo = recipeQuery.data?.match;
  const inventory = inventoryQuery.data ?? [];

  const notFound =
    recipeQuery.isError &&
    recipeQuery.error instanceof ApiError &&
    recipeQuery.error.kind === 'http' &&
    recipeQuery.error.status === 404;

  if (recipeKey && recipeQuery.isPending) {
    return (
      <div className="min-h-screen bg-takosan-cream">
        <TopBar showBack title="Chi tiết món ăn" />
        <div className="p-4 space-y-4" role="status" aria-live="polite">
          <SkeletonCard className="h-56 rounded-2xl" />
          <SkeletonCard className="h-10" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <span className="sr-only">Đang tải công thức…</span>
        </div>
      </div>
    );
  }

  if (recipeQuery.isError && !notFound) {
    return (
      <div className="min-h-screen bg-takosan-cream">
        <TopBar showBack title="Chi tiết món ăn" />
        <div className="p-4">
          <InlineError error={recipeQuery.error} onRetry={() => recipeQuery.refetch()} />
        </div>
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div className="min-h-screen bg-takosan-cream">
        <TopBar showBack title="Chi tiết món ăn" />
        <div className="p-8 text-center space-y-3">
          <SearchX className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h2 className="font-heading font-bold text-base text-slate-900">
            Không tìm thấy công thức này
          </h2>
          <p className="text-xs text-slate-500">
            Món ăn có thể đã bị gỡ hoặc đường dẫn không đúng.
          </p>
          <Button onClick={() => navigate('/recipes')} className="mt-2">
            Xem tất cả công thức
          </Button>
        </div>
      </div>
    );
  }

  const handleStartCook = () => {
    startCooking(recipe, inventory);
    navigate(`/cook/${recipe.slug}`);
  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-32">
      <TopBar showBack title={recipe.title} />
      {inventoryQuery.isError && <InlineError error={inventoryQuery.error} onRetry={() => inventoryQuery.refetch()} />}

      {/* Cover Image */}
      <div className="relative w-full h-56 overflow-hidden bg-slate-100">
        <img
          src={resolveRecipeImage(recipe).src}
          alt={recipe.title}
          width={448}
          height={224}
          className="w-full h-full object-cover"
          onError={recipeImageErrorHandler(resolveRecipeImage(recipe).fallbackSrc)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-takosan-green text-white text-[10px] font-bold uppercase tracking-wider">
              {recipe.cuisine === 'vietnamese' ? 'Món Việt' : recipe.cuisine}
            </span>
            {typeof matchInfo?.matchPercentage === 'number' && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-semibold text-white">
                Khớp {matchInfo.matchPercentage}% tủ lạnh
              </span>
            )}
          </div>
          <h2 className="font-heading font-bold text-xl leading-snug text-white drop-shadow-sm">
            {recipe.title}
          </h2>
          <div className="flex items-center gap-4 text-xs mt-1 text-slate-200">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-takosan-mint" />
              <span>{recipe.cookTimeMinutes} phút</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-takosan-mint" />
              <span>{recipe.servings} người</span>
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 animate-fade-in">
        {/* Tabs: Cách nấu | Nguyên liệu | Dinh dưỡng */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl" role="tablist" aria-label="Thông tin món ăn">
          {[
            { id: 'steps' as const, label: 'Cách nấu' },
            { id: 'ingredients' as const, label: 'Nguyên liệu' },
            { id: 'nutrition' as const, label: 'Dinh dưỡng' },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
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

        {/* Tab 1: Cách nấu */}
        {activeTab === 'steps' && (
          <div className="space-y-3 pt-1">
            {recipe.steps.map((s: any, idx: number) => (
              <div
                key={s.stepNumber || idx}
                className="bg-white rounded-2xl p-4 flex gap-3.5 border border-slate-200/80 shadow-xs"
              >
                <div className="w-7 h-7 rounded-full bg-takosan-green text-white font-heading font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {s.stepNumber || idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {s.title && (
                    <h4 className="font-heading font-bold text-sm text-slate-900 mb-1">
                      {s.title}
                    </h4>
                  )}
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {s.instruction}
                  </p>
                  {s.timerMinutes && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-takosan-green-deep bg-takosan-mint px-2.5 py-1 rounded-lg mt-2 border border-takosan-mint-deep/60">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Hẹn giờ: {s.timerMinutes} phút</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Nguyên liệu */}
        {activeTab === 'ingredients' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-heading font-bold text-sm text-slate-900">
                Nguyên liệu ({recipe.ingredients.length} món)
              </h3>
              {typeof matchInfo?.availableIngredientCount === 'number' && (
                <span className="text-xs font-bold text-takosan-green">
                  Đã có {matchInfo.availableIngredientCount} món
                </span>
              )}
            </div>

            <div className="space-y-2">
              {recipe.ingredients.map((ing: any) => {
                const invItem = inventory.find((i: any) => i.ingredientId === ing.ingredientId);
                const hasIngredient = Boolean(invItem && invItem.quantity > 0);
                const isAdded = addedToShop.includes(ing.ingredientId);

                return (
                  <div
                    key={ing.ingredientId}
                    className={clsx(
                      'p-2.5 rounded-xl border flex items-center justify-between transition-tap',
                      hasIngredient
                        ? 'bg-takosan-mint/50 border-takosan-mint-deep/80'
                        : 'bg-white border-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 overflow-hidden shrink-0">
                        <img
                          src={getIngredientImage(ing.ingredientId, ing.name)}
                          alt={ing.name}
                          width={40}
                          height={40}
                          loading="lazy"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-heading font-bold text-xs text-slate-900">
                            {ing.name}
                          </p>
                          {hasIngredient && (
                            <span className="w-4 h-4 rounded-full bg-takosan-green text-white flex items-center justify-center text-[10px]">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Cần: {ing.requiredQuantity} {ing.unit}
                          {invItem && ` • Trong tủ: ${invItem.quantity} ${invItem.unit}`}
                        </p>
                      </div>
                    </div>

                    {!hasIngredient && (
                      <button
                        onClick={() => addToShopping.mutate(ing)}
                        disabled={isAdded || addToShopping.isPending}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-tap tap-target',
                          isAdded
                            ? 'bg-slate-100 text-slate-400 border border-slate-200'
                            : 'bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/80 hover:bg-takosan-mint-hover active:scale-95 shadow-xs'
                        )}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{isAdded ? 'Đã thêm' : '+ Mua'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {addToShopping.isError && (
              <p className="text-[11px] text-rose-600 font-medium" role="alert">
                Chưa thêm được vào danh sách mua. Vui lòng thử lại.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Dinh dưỡng — only real data, no invented numbers */}
        {activeTab === 'nutrition' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-heading font-bold text-sm text-slate-900">
              Dinh dưỡng mỗi khẩu phần
            </h3>
            {recipe.nutrition ? (
              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                {[
                  { label: 'Calories', value: recipe.nutrition.calories, unit: 'kcal' },
                  { label: 'Đạm', value: recipe.nutrition.proteinG, unit: 'g' },
                  { label: 'Béo', value: recipe.nutrition.fatG, unit: 'g' },
                  { label: 'Carb', value: recipe.nutrition.carbG, unit: 'g' },
                ].map((cell) => (
                  <div key={cell.label} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">{cell.label}</p>
                    <p className="font-heading font-bold text-base text-slate-900 mt-1">
                      {typeof cell.value === 'number' ? cell.value : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400">{cell.unit}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Món này chưa có thông tin dinh dưỡng.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Start Cooking Button */}
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 md:left-20 lg:left-64 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-lg">
        <Button
          fullWidth
          size="lg"
          onClick={handleStartCook}
          disabled={inventoryQuery.isPending || inventoryQuery.isError}
          className="bg-takosan-green hover:bg-takosan-green-hover text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2"
        >
          <ChefHat className="w-5 h-5" />
          <span>Bắt đầu nấu ({recipe.cookTimeMinutes} phút)</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};
