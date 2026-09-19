import React from 'react';
import { RecipeMatchResult } from '@frigo/recipes';
import { Clock, CheckCircle, Flame, Users } from 'lucide-react';
import { resolveRecipeImage, recipeImageErrorHandler } from '../../lib/recipe-media';

interface RecipeCardProps {
  matchResult: RecipeMatchResult;
  onClick: () => void;
  compact?: boolean;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ matchResult, onClick, compact = false }) => {
  const { recipe, matchPercentage, canCookWithoutBuying, missingRequiredIngredients } = matchResult;
  const image = resolveRecipeImage(recipe);

  const cuisineFlags: Record<string, string> = {
    vietnamese: '🇻🇳',
    korean: '🇰🇷',
    japanese: '🇯🇵',
    chinese: '🇨🇳',
    thai: '🇹🇭',
    italian: '🇮🇹',
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-card hover:border-takosan-green/50 hover:shadow-elevated active:scale-[0.97] transition-tap cursor-pointer flex flex-col w-48 shrink-0"
      >
        <div className="relative w-full h-32 overflow-hidden bg-slate-100">
          <img
            src={image.src}
            alt={recipe.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={recipeImageErrorHandler(image.fallbackSrc)}
          />
          {/* Match badge — gradient, nổi bật hơn */}
          <span
            className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-[11px] font-heading font-bold text-white shadow-sm ${
              matchPercentage >= 80
                ? 'bg-takosan-green'
                : 'bg-slate-900/80 backdrop-blur-sm'
            }`}
          >
            {cuisineFlags[recipe.cuisine] || '🌍'} {matchPercentage}%
          </span>
          {canCookWithoutBuying && (
            <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-takosan-green shadow-sm flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </span>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
          <h4 className="font-heading font-bold text-[13px] text-slate-900 line-clamp-2 leading-snug min-h-[2.2em]">
            {recipe.title}
          </h4>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1 font-semibold">
              <Clock className="w-3.5 h-3.5 text-takosan-green" />
              {recipe.cookTimeMinutes}p
            </span>
            {canCookWithoutBuying ? (
              <span className="text-takosan-green font-heading font-bold">Đủ 100%</span>
            ) : (
              <span className="text-amber-800 font-bold">Thiếu {missingRequiredIngredients.length}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-3.5 flex gap-4 items-center border border-slate-200/80 shadow-card hover:border-takosan-green/50 hover:shadow-elevated active:scale-[0.99] transition-tap cursor-pointer"
    >
      <div className="relative w-[104px] h-[104px] rounded-xl overflow-hidden shrink-0 bg-slate-100 shadow-xs">
        <img
          src={image.src}
          alt={recipe.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={recipeImageErrorHandler(image.fallbackSrc)}
        />
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur text-[10px] font-bold text-white">
          {cuisineFlags[recipe.cuisine] || ''}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {canCookWithoutBuying ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/80 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-takosan-green" /> Đủ 100%
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80">
              Thiếu {missingRequiredIngredients.length} món
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-heading font-extrabold text-takosan-green">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            Khớp {matchPercentage}%
          </span>
        </div>

        <h4 className="font-heading font-bold text-[15px] text-slate-900 leading-snug truncate">
          {recipe.title}
        </h4>

        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 leading-relaxed">
          {recipe.description}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-x-1.5 mt-2.5 pt-2 border-t border-slate-100 text-xs">
          <span className="flex items-center gap-1 text-slate-600 font-semibold">
            <Clock className="w-4 h-4 text-takosan-green" />
            <span>{recipe.cookTimeMinutes} phút</span>
          </span>
          {recipe.nutrition && (
            <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
              {recipe.nutrition.calories} kcal
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Users className="w-3.5 h-3.5" />
            {recipe.servings} người
          </span>
        </div>
      </div>
    </div>
  );
};
