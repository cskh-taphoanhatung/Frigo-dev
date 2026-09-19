import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MealPlan } from '@frigo/domain';
import { useWeekStore } from '../stores/useWeekStore';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { capturePrivateSession, currentPrivateScope } from '../lib/private-session';
import { todayLocalIso } from '../lib/format';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { Button } from '../components/common/Button';

export const WeekGeneratingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setupDraft, generatePlan } = useWeekStore();
  const request = useRef<Promise<MealPlan> | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const isCurrent = capturePrivateSession();
    const { userId, householdId } = currentPrivateScope();
    if (!userId || !householdId) {
      setError(new Error('Vui lòng xác minh phiên trước khi tạo thực đơn.'));
      return;
    }
    // Reuse the command during StrictMode's effect replay.
    request.current ??= generatePlan({
      householdId,
      startDate: todayLocalIso(),
      householdSize: setupDraft.householdSize || 2,
      mealSlotsPreset: setupDraft.mealSlotsPreset || 'dinner_only',
      budgetTargetVnd: setupDraft.budgetTargetVnd ?? 750000,
      priorities: setupDraft.priorities || ['use_fridge'],
      shoppingFrequency: setupDraft.shoppingFrequency || 'once',
    });
    void request.current.then((plan) => {
      if (!cancelled && isCurrent()) navigate(`/week/${plan.id}`, { replace: true });
    }).catch((err: unknown) => {
      if (!cancelled && isCurrent()) setError(err);
    });
    return () => { cancelled = true; };
  }, [generatePlan, navigate, setupDraft]);

  return (
    <div className="min-h-screen bg-takosan-cream text-takosan-navy flex flex-col justify-center gap-8 p-6 mx-auto max-w-[45rem]">
      <div className="text-center">
        <img src={TAKOSAN_BRAND.mascot.calendar} alt="Takosan lên lịch" className="w-28 h-28 mx-auto mb-4" />
        <h2 className="font-heading font-bold text-2xl text-slate-900">
          {error ? 'Chưa tạo được thực đơn' : 'Takosan đang lên thực đơn tuần…'}
        </h2>
        <p className="text-xs text-slate-500 mt-2">Ăn đủ • Mua đủ • Dùng hết</p>
      </div>
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
        {error ? (
          <>
            <InlineError error={error} />
            <Button className="w-full mt-4" onClick={() => navigate('/week/setup', { replace: true })}>
              Quay lại thiết lập
            </Button>
          </>
        ) : <InlineLoading label="Đang chờ thực đơn từ máy chủ. Bạn có thể quay lại sau." />}
      </div>
    </div>
  );
};
