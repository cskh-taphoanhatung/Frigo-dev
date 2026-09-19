import React from 'react';
import { MealSlotItem } from '@frigo/domain';
import { Clock, Users, ArrowRightLeft, Sparkles, Utensils, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { resolveRecipeImage, recipeImageErrorHandler } from '../../lib/recipe-media';

interface MealCardProps {
  slot: MealSlotItem;
  onClick: () => void;
  onSwapClick: (e: React.MouseEvent) => void;
}

export const MealCard: React.FC<MealCardProps> = ({ slot, onClick, onSwapClick }) => {
  // 1. Non-cooking slots: Eating out, Flexible, Skipped
  if (slot.status === 'EATING_OUT') {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-xl p-3.5 border border-semantic-border shadow-xs flex items-center justify-between cursor-pointer hover:border-semantic-border-strong active:scale-[0.99] transition-tap"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-semantic-warning-soft border border-semantic-warning/20 text-semantic-warning-strong flex items-center justify-center text-lg shrink-0">
            🍽️
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-semantic-warning-soft text-semantic-warning-strong border border-semantic-warning/30">
                Ăn ngoài
              </span>
            </div>
            <h4 className="font-heading font-bold text-sm text-semantic-text-primary">
              Bữa ăn ngoài
            </h4>
            <p className="text-[11px] text-semantic-text-muted mt-0.5">
              Không cần chuẩn bị nguyên liệu ở nhà
            </p>
          </div>
        </div>

        <button
          onClick={onSwapClick}
          className="p-1.5 rounded-lg text-semantic-text-muted hover:text-semantic-text-secondary active:scale-95 tap-target flex items-center justify-center transition-colors"
          aria-label="Đổi trạng thái bữa ăn"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (slot.status === 'FLEXIBLE') {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-xl p-3.5 border border-semantic-border shadow-xs flex items-center justify-between cursor-pointer hover:border-semantic-border-strong active:scale-[0.99] transition-tap"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-takosan-mint border border-takosan-mint-deep text-takosan-green-deep flex items-center justify-center text-lg shrink-0">
            ✨
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/80">
                Bữa linh hoạt
              </span>
            </div>
            <h4 className="font-heading font-bold text-sm text-semantic-text-primary">
              Tùy chọn lúc đó
            </h4>
            <p className="text-[11px] text-semantic-text-muted mt-0.5">
              Dùng đồ ăn thừa (leftovers) hoặc chọn món tự do
            </p>
          </div>
        </div>

        <button
          onClick={onSwapClick}
          className="px-3 py-1.5 rounded-lg bg-semantic-background-subtle border border-semantic-border text-xs font-semibold text-semantic-text-secondary hover:bg-semantic-border/60 active:scale-95 shadow-xs tap-target flex items-center gap-1"
          aria-label="Chọn món"
        >
          <Utensils className="w-3.5 h-3.5 text-takosan-green" />
          <span>Chọn món</span>
        </button>
      </div>
    );
  }

  const recipe = slot.recipe;
  if (!recipe) return null;

  const isCooked = slot.status === 'COOKED';

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-xl p-3 border border-semantic-border shadow-xs hover:border-semantic-border-strong active:scale-[0.99] transition-tap cursor-pointer relative overflow-hidden',
        isCooked && 'opacity-70 bg-semantic-background-subtle'
      )}
    >
      {isCooked && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-takosan-green text-white text-[10px] font-semibold flex items-center gap-1 shadow-xs">
          <Check className="w-3 h-3 stroke-[2.5]" /> Đã nấu
        </div>
      )}

      <div className="flex gap-3 items-start">
        {/* Recipe Thumbnail */}
        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-semantic-border/60 shadow-xs">
          <img
            src={resolveRecipeImage(recipe).src}
            alt={recipe.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={recipeImageErrorHandler(resolveRecipeImage(recipe).fallbackSrc)}
          />
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur text-[8px] font-bold text-white uppercase">
            {recipe.cuisine}
          </span>
        </div>

        {/* Recipe Info */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {slot.badges.map((badge) => (
              <span
                key={badge}
                className={clsx(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 border',
                  badge.includes('Dùng đồ sắp hết')
                    ? 'bg-semantic-warning-soft text-semantic-warning-strong border-semantic-warning/30'
                    : badge.includes('100%')
                    ? 'bg-takosan-mint text-takosan-green-deep border-takosan-mint-deep/80'
                    : 'bg-semantic-border/60 text-semantic-text-secondary border-semantic-border'
                )}
              >
                {badge.includes('Dùng đồ sắp hết') && <Sparkles className="w-2.5 h-2.5 text-semantic-warning" />}
                {badge}
              </span>
            ))}
          </div>

          <h4 className="font-heading font-bold text-sm text-semantic-text-primary truncate leading-tight">
            {recipe.title}
          </h4>

          {/* Quick specs */}
          <div className="flex items-center gap-3 text-xs text-semantic-text-muted mt-1">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-takosan-green" />
              <span>{recipe.cookTimeMinutes}p</span>
            </span>
            <span className="flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-takosan-green" />
              <span>{slot.servings} người</span>
            </span>
          </div>

          {/* Fridge Availability & Cost */}
          <div className="mt-2 pt-1.5 border-t border-semantic-border/70 flex items-center justify-between text-xs">
            <div className="text-[11px]">
              {slot.availabilityPercent === 100 ? (
                <span className="text-takosan-green font-bold">Đủ 100% trong tủ</span>
              ) : (
                <span className="text-semantic-text-secondary font-medium">
                  Có sẵn {slot.availabilityPercent}% •{' '}
                  <span className="text-semantic-warning-strong font-semibold">
                    Mua ~{Math.round(slot.incrementalCostVnd / 1000)}k
                  </span>
                </span>
              )}
            </div>

            {/* Swap Button */}
            {!isCooked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSwapClick(e);
                }}
                className="px-2 py-1 rounded-lg bg-semantic-background-subtle hover:bg-semantic-border/60 border border-semantic-border/70 text-semantic-text-secondary text-[11px] font-semibold flex items-center gap-1 transition-tap active:scale-95 cursor-pointer"
                aria-label={`Đổi món ${recipe.title}`}
              >
                <ArrowRightLeft className="w-3 h-3 text-semantic-text-muted" />
                <span>Đổi món</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
