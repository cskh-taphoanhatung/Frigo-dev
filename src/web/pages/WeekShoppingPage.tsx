import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeekStore } from '../stores/useWeekStore';
import { TopBar } from '../components/common/TopBar';
import { Button } from '../components/common/Button';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { getIngredientImage } from '../lib/ingredient-images';
import { capturePrivateSession } from '../lib/private-session';
import { queryKeys } from '../lib/queryKeys';
import { api } from '../services/api';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { mapCategoryToShoppingSection, type AggregatedShoppingItem } from '@frigo/domain';
import { ArrowRight, Refrigerator, Check } from 'lucide-react';
import { clsx } from 'clsx';

export const WeekShoppingPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  const {
    error: workflowError,
    toggleShoppingItem,
    completeShopping,
  } = useWeekStore();

  // Mode:
  // 'list': 6.1 Shopping list
  // 'active': 6.2 Shopping mode (in supermarket)
  // 'complete': 6.3 Hoàn tất đi chợ
  const [shoppingMode, setShoppingMode] = useState<'list' | 'active' | 'complete'>('list');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completedShopping, setCompletedShopping] = useState<{
    items: AggregatedShoppingItem[];
    count: number;
  } | null>(null);
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
        <TopBar showBack title="Danh sách đi chợ" />
        <div className="p-4">
          {planQuery.isError ? (
            <InlineError error={planQuery.error} onRetry={() => planQuery.refetch()} />
          ) : planId && planQuery.isPending ? (
            <InlineLoading label="Đang tải danh sách đi chợ…" />
          ) : (
            <p role="status" className="py-12 text-center text-sm text-slate-600">Không tìm thấy thực đơn này.</p>
          )}
        </div>
      </div>
    );
  }

  const items = currentPlan.shoppingItems;
  const checkedItems = items.filter((i) => i.checked);
  const checkedCount = checkedItems.length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 100;

  // Group items by category section
  const sections: Record<string, typeof items> = {};
  for (const item of items) {
    const sectionName = mapCategoryToShoppingSection(item.category);
    if (!sections[sectionName]) sections[sectionName] = [];
    sections[sectionName].push(item);
  }

  const sectionKeys = Object.keys(sections);

  const filteredItems = selectedSection === 'all'
    ? items
    : items.filter((i) => mapCategoryToShoppingSection(i.category) === selectedSection);

  const handleFinishShopping = async () => {
    if (isSubmitting || checkedItems.length === 0) return;
    const isCurrent = capturePrivateSession();
    const submittedItems = checkedItems.map((item) => ({ ...item }));
    setCompletionError(null);
    setIsSubmitting(true);
    try {
      const result = await completeShopping();
      if (!isCurrent()) return;
      if (!result.success) throw new Error('Shopping not completed');
      setCompletedShopping({ items: submittedItems, count: result.count });
      setShoppingMode('complete');
    } catch {
      if (isCurrent()) setCompletionError('Chưa nhập được nguyên liệu vào tủ lạnh. Vui lòng thử lại.');
    } finally {
      if (isCurrent()) setIsSubmitting(false);
    }
  };

  // 6.3 HOÀN TẤT ĐI CHỢ
  if (shoppingMode === 'complete' && completedShopping) {
    return (
      <div className="min-h-screen bg-takosan-cream flex flex-col justify-between p-6 animate-fade-in">
        <div className="text-center pt-8 space-y-2">
          <h2 className="font-heading font-extrabold text-2xl text-slate-900 tracking-tight">
            Tuyệt vời! 🎉
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Hãy giải trí xem việc tràn ngập niềm vui. Thực phẩm đã sẵn sàng trong tủ lạnh!
          </p>
        </div>

        {/* Mascot */}
        <div className="my-auto py-6 text-center">
          <div className="w-52 h-52 mx-auto flex items-center justify-center">
            <img
              src={TAKOSAN_BRAND.mascot.celebrate}
              alt="Takosan ăn mừng"
              className="w-full h-full object-contain animate-bounce-slow"
            />
          </div>
        </div>

        {/* Bought Summary List */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card space-y-2.5 mb-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-heading font-bold text-xs text-slate-800 uppercase tracking-wider">
              Đã chọn ({completedShopping.items.length} món)
            </span>
            <span className="text-xs font-bold text-takosan-green">Đã nhập {completedShopping.count} món</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {completedShopping.items.map((item) => (
              <div
                key={item.ingredientId}
                className="flex items-center justify-between text-xs py-1"
              >
                <div className="flex items-center gap-2 text-slate-800">
                  <Check className="w-3.5 h-3.5 text-takosan-green stroke-[3]" />
                  <span>{item.name}</span>
                </div>
                <span className="font-heading font-semibold text-slate-700">
                  {item.recommendedPurchaseQuantity} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dual Actions */}
        <div className="space-y-2.5 pb-4">
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate('/fridge')}
            className="bg-takosan-green hover:bg-takosan-green-hover text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2"
          >
            <Refrigerator className="w-5 h-5" />
            <span>Xem tủ lạnh</span>
          </Button>

          <Button
            fullWidth
            size="md"
            variant="outline"
            onClick={() => navigate('/')}
            className="rounded-2xl text-slate-700"
          >
            Về trang chủ
          </Button>
        </div>
      </div>
    );
  }

  // 6.1 (LIST) & 6.2 (ACTIVE SHOPPING MODE)
  return (
    <div className="min-h-screen bg-takosan-cream pb-32">
      <TopBar
        showBack
        title={shoppingMode === 'active' ? 'Đang đi chợ' : 'Danh sách đi chợ'}
        subtitle={`${items.length} món • ${currentPlan.budget.displayText}`}
      />
      {(completionError || workflowError) && (
        <div className="px-4 pt-3"><InlineError message={completionError || workflowError || undefined} /></div>
      )}

      <div className="px-4 pt-3 space-y-4 animate-fade-in">
        {/* Header Progress (Active mode 6.2) */}
        {shoppingMode === 'active' ? (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-heading font-bold text-slate-900">
                Đang đi chợ — {checkedCount}/{totalCount} món
              </span>
              <span className="font-bold text-takosan-green">
                {progressPercent}%
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-takosan-green h-full transition-tap duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          /* Header Info (List mode 6.1) */
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-lg text-slate-900">
                Danh sách đi chợ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {items.length} món · {currentPlan.budget.displayText}
              </p>
            </div>

            <span className="px-3 py-1 rounded-full bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep text-xs font-bold">
              1 chuyến
            </span>
          </div>
        )}

        {/* Category Pills (Screen 6.1) */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setSelectedSection('all')}
            className={clsx(
              'px-3.5 py-1.5 rounded-full text-xs font-heading font-semibold whitespace-nowrap transition-tap tap-target',
              selectedSection === 'all'
                ? 'bg-takosan-green text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            )}
          >
            Tất cả ({items.length})
          </button>

          {sectionKeys.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={clsx(
                'px-3.5 py-1.5 rounded-full text-xs font-heading font-semibold whitespace-nowrap transition-tap tap-target',
                selectedSection === sec
                  ? 'bg-takosan-green text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              )}
            >
              {sec} ({sections[sec].length})
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const imgSrc = getIngredientImage(item.ingredientId, item.name);
            const isChecked = item.checked;

            return (
              <button
                key={item.ingredientId}
                type="button"
                aria-pressed={isChecked}
                disabled={isSubmitting}
                onClick={() => toggleShoppingItem(item.ingredientId, !isChecked)}
                className={clsx(
                  'w-full text-left p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-tap border shadow-xs active:scale-99',
                  isChecked
                    ? 'bg-slate-50/80 border-slate-200/60 opacity-60'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Checkbox */}
                  <div
                    className={clsx(
                      'w-5 h-5 rounded-lg flex items-center justify-center transition-tap border shrink-0',
                      isChecked
                        ? 'bg-takosan-green border-takosan-green text-white'
                        : 'border-slate-300 bg-white'
                    )}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                    <img
                      src={imgSrc}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <h4
                      className={clsx(
                        'font-heading font-bold text-sm text-slate-900 truncate',
                        isChecked && 'line-through text-slate-400'
                      )}
                    >
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      <span className="font-semibold text-slate-800">
                        {item.recommendedPurchaseQuantity} {item.unit}
                      </span>
                      {item.sourceRecipes.length > 1 ? (
                        <span className="text-takosan-green font-medium"> • Dùng cho {item.sourceRecipes.length} món</span>
                      ) : null}
                    </p>
                  </div>
                </div>

                {/* Estimated Price */}
                <div className="text-right shrink-0 ml-2">
                  <span className="font-heading font-bold text-xs text-slate-700">
                    ~{Math.round(item.estimatedPriceMin / 1000)}–{Math.round(item.estimatedPriceMax / 1000)}k
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 md:left-20 lg:left-64 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-lg">
        {shoppingMode === 'list' ? (
          <Button
            fullWidth
            size="lg"
            onClick={() => setShoppingMode('active')}
            className="bg-takosan-green hover:bg-takosan-green-hover text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md"
          >
            Bắt đầu đi chợ
          </Button>
        ) : (
          <Button
            fullWidth
            size="lg"
            onClick={handleFinishShopping}
            isLoading={isSubmitting}
            disabled={checkedCount === 0}
            className="bg-takosan-green hover:bg-takosan-green-hover text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2"
          >
            <span>Hoàn tất đi chợ</span>
            <ArrowRight className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
};
