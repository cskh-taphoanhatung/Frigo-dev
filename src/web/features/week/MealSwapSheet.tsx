import React from 'react';
import { useWeekStore } from '../../stores/useWeekStore';
import { X, ArrowRightLeft, Clock, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { InlineError } from '../../components/common/AsyncState';

export const MealSwapSheet: React.FC = () => {
  const {
    swapSlotId,
    swapAlternatives,
    isLoadingAlternatives,
    closeSwap,
    executeSwap,
    currentPlan,
    error,
    openSwap,
    isLoading,
  } = useWeekStore();

  if (!swapSlotId || !currentPlan) return null;

  // Find target slot
  let targetSlotName = 'Món ăn';
  for (const day of currentPlan.days) {
    const s = day.slots.find((slot) => slot.id === swapSlotId);
    if (s) {
      targetSlotName = s.recipe?.title || s.notes || 'Bữa này';
      break;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-end justify-center p-0 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border-t border-slate-200/80 animate-in slide-in-from-bottom-5 duration-200">
        {/* Grab bar */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="px-5 pb-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Đổi món khác</span>
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 truncate max-w-[280px] mt-0.5">
              Thay thế: {targetSlotName}
            </h3>
          </div>

          <button
            onClick={closeSwap}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors tap-target flex items-center justify-center"
            aria-label="Đóng bảng đổi món"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/50">
          {error && <InlineError message={error} onRetry={() => openSwap(swapSlotId)} />}
          {isLoadingAlternatives ? (
            <div className="py-12 text-center">
              <div className="animate-spin w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                Đang tìm các món thay thế tối ưu tủ lạnh...
              </p>
            </div>
          ) : swapAlternatives.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Không tìm thấy món thay thế phù hợp với ràng buộc hiện tại.
            </div>
          ) : (
            swapAlternatives.map((alt) => {
              const formatDelta = (delta: number) => {
                if (delta === 0) return '±0đ';
                const sign = delta > 0 ? '+' : '';
                return `${sign}${Math.round(delta / 1000)}k`;
              };

              return (
                <div
                  key={alt.recipe.id}
                  className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={alt.recipe.imageUrl}
                      alt={alt.recipe.title}
                      className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-100"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                          Khớp {alt.matchPercent}%
                        </span>
                        {alt.badges.map((b) => (
                          <span
                            key={b}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                          >
                            {b}
                          </span>
                        ))}
                      </div>

                      <h4 className="font-heading font-semibold text-sm text-slate-900 truncate">
                        {alt.recipe.title}
                      </h4>

                      {/* Deltas */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span
                          className={clsx(
                            'font-semibold',
                            alt.budgetDeltaVnd <= 0 ? 'text-emerald-700' : 'text-amber-700'
                          )}
                        >
                          Chi phí: {formatDelta(alt.budgetDeltaVnd)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {alt.recipe.cookTimeMinutes}p
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={isLoading}
                    onClick={() => executeSwap(alt.recipe.id)}
                    className="px-3.5 py-2 rounded-lg bg-takosan-green hover:bg-[#26694C] text-white font-semibold text-xs transition-all active:scale-[0.98] shrink-0 tap-target flex items-center gap-1 shadow-xs"
                    aria-label={`Chọn món ${alt.recipe.title}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Chọn</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
