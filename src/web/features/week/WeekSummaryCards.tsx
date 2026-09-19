import React from 'react';
import { MealPlan } from '@frigo/domain';
import { Wallet, Refrigerator, ShoppingBag, ShieldAlert, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface WeekSummaryCardsProps {
  plan: MealPlan;
}

export const WeekSummaryCards: React.FC<WeekSummaryCardsProps> = ({ plan }) => {
  const { budget, utilization, wasteRisk, shoppingItems, days } = plan;

  // Count planned meals
  let totalPlannedMeals = 0;
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.status === 'PLANNED' || slot.status === 'COOKED') {
        totalPlannedMeals++;
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* 2-column core metrics */}
      <div className="grid grid-cols-2 gap-3">
        {/* Budget Card */}
        <div className="bg-white rounded-2xl p-4 border border-semantic-border shadow-xs">
          <div className="flex items-center gap-1.5 text-semantic-text-muted mb-1.5">
            <Wallet className="w-4 h-4 text-takosan-green" />
            <span className="text-xs font-semibold">Ngân sách</span>
          </div>

          <p className="font-heading font-bold text-lg text-semantic-text-primary leading-tight">
            {budget.displayText}
          </p>

          <p className="text-[11px] text-semantic-text-muted mt-1">
            {budget.targetVnd
              ? `Hạn mức: ${Math.round(budget.targetVnd / 1000)}k`
              : 'Không giới hạn'}
          </p>
        </div>

        {/* Fridge Utilization Card */}
        <div className="bg-white rounded-2xl p-4 border border-semantic-border shadow-xs">
          <div className="flex items-center gap-1.5 text-semantic-text-muted mb-1.5">
            <Refrigerator className="w-4 h-4 text-takosan-green" />
            <span className="text-xs font-semibold">Tận dụng tủ</span>
          </div>

          <div className="flex items-baseline gap-1">
            <p className="font-heading font-bold text-2xl text-takosan-green leading-tight">
              {utilization.utilizationPercent}%
            </p>
            <span className="text-[11px] font-medium text-semantic-text-muted">nguyên liệu</span>
          </div>

          <p className="text-[11px] text-semantic-text-muted mt-0.5">
            Dùng {utilization.plannedItemsCount}/{utilization.totalUsableItemsCount} món sẵn có
          </p>
        </div>
      </div>

      {/* 3-column micro metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Shopping Items count */}
        <div className="bg-white rounded-xl p-2.5 border border-semantic-border shadow-xs">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-semantic-text-muted mb-0.5">
            <ShoppingBag className="w-3.5 h-3.5 text-takosan-green" />
            <span>Cần mua</span>
          </div>
          <p className="font-heading font-bold text-sm text-semantic-text-primary">
            {shoppingItems.length} món
          </p>
        </div>

        {/* Planned Meals count */}
        <div className="bg-white rounded-xl p-2.5 border border-semantic-border shadow-xs">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-semantic-text-muted mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-takosan-green" />
            <span>Bữa đã lên</span>
          </div>
          <p className="font-heading font-bold text-sm text-semantic-text-primary">
            {totalPlannedMeals} bữa
          </p>
        </div>

        {/* Waste Risk */}
        <div className="bg-white rounded-xl p-2.5 border border-semantic-border shadow-xs">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-semantic-text-muted mb-0.5">
            <ShieldAlert className="w-3.5 h-3.5 text-semantic-warning" />
            <span>Bỏ phí</span>
          </div>
          <p
            className={clsx(
              'font-heading font-bold text-sm',
              wasteRisk.level === 'LOW'
                ? 'text-takosan-green'
                : wasteRisk.level === 'MEDIUM'
                ? 'text-semantic-warning-strong'
                : 'text-semantic-danger-strong'
            )}
          >
            {wasteRisk.level === 'LOW' ? 'Thấp' : wasteRisk.level === 'MEDIUM' ? 'Vừa' : 'Cao'}
          </p>
        </div>
      </div>
    </div>
  );
};
