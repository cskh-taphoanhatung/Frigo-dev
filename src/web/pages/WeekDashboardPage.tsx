import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeekStore } from '../stores/useWeekStore';
import { TopBar } from '../components/common/TopBar';
import { WeekSummaryCards } from '../features/week/WeekSummaryCards';
import { MealCard } from '../features/week/MealCard';
import { MealSwapSheet } from '../features/week/MealSwapSheet';
import { WeekExportModal } from '../features/week/WeekExportModal';
import { EmptyState } from '../components/common/EmptyState';
import { InlineError } from '../components/common/AsyncState';
import { api } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { ShoppingBag, RefreshCw, CalendarDays, Plus, Sparkles, Share2 } from 'lucide-react';

export const WeekDashboardPage: React.FC = () => {
  const { planId } = useParams<{ planId?: string }>();
  const navigate = useNavigate();

  const {
    openSwap,
    error: workflowError,
  } = useWeekStore();

  const planQuery = useQuery({
    queryKey: planId ? queryKeys.weekPlan(planId) : queryKeys.currentWeekPlan(),
    queryFn: () => planId ? api.getWeekPlan(planId) : api.getCurrentWeekPlan(),
  });
  const currentPlan = planQuery.data ?? null;
  const isLoading = planQuery.isPending;

  const [isRegeneratingOpen, setIsRegeneratingOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    // Week editing sheets use this projection; Query owns the fetched plan.
    useWeekStore.setState({ currentPlan });
  }, [currentPlan]);

  const handleQuickRegenerate = (_priorityFocus: any) => {
    setIsRegeneratingOpen(false);
    navigate('/week/generating');
  };

  const formatDateRange = (start?: string, end?: string) => {
    if (!start || !end) return 'Tuần này';
    const s = new Date(start);
    const e = new Date(end);
    return `${s.getDate()} – ${e.getDate()} tháng ${s.getMonth() + 1}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-takosan-cream pb-24">
        <TopBar title="Thực đơn tuần" />
        <div className="py-20 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-takosan-green border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Đang tải thực đơn...</p>
        </div>
      </div>
    );
  }

  if (planQuery.isError) {
    return (
      <div className="min-h-screen bg-takosan-cream pb-24">
        <TopBar title="Thực đơn tuần" />
        <div className="p-4"><InlineError error={planQuery.error} onRetry={() => planQuery.refetch()} /></div>
      </div>
    );
  }

  if (!currentPlan) {
    return (
      <div className="min-h-screen bg-takosan-cream pb-24">
        <TopBar title="Thực đơn tuần" />
        <div className="px-4 pt-10 text-center space-y-4">
          <EmptyState
            type="no-recipes"
            title="Chưa có thực đơn tuần"
            description="Takosan sẽ dựa vào thực phẩm trong tủ lạnh, khẩu vị gia đình và ngân sách để lên thực đơn tối ưu cho cả tuần."
            actionText="Lên thực đơn tuần ngay"
            onAction={() => navigate('/week/setup')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-takosan-cream pb-28">
      <TopBar title="Thực đơn tuần" subtitle={formatDateRange(currentPlan.startDate, currentPlan.endDate)} />

      <div className="px-4 pt-3 space-y-5 animate-fade-in">
        {workflowError && <InlineError message={workflowError} />}
        {/* Header Bar & Quick Actions */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/80 uppercase">
                {currentPlan.status === 'READY' ? 'Sẵn sàng nấu' : 'Đang thực hiện'}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {formatDateRange(currentPlan.startDate, currentPlan.endDate)}
              </span>
            </div>
            <h2 className="font-heading font-bold text-xl text-slate-900 tracking-tight">
              Kế hoạch tuần này
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick action: Đi chợ */}
            <button
              onClick={() => navigate(`/week/${currentPlan.id}/shopping`)}
              className="px-3 py-2 rounded-xl bg-takosan-green text-white font-heading font-semibold text-xs shadow-xs hover:bg-[#164E3D] active:scale-95 transition-tap tap-target flex items-center gap-1.5 cursor-pointer"
              aria-label="Đi chợ theo thực đơn tuần"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Đi chợ ({currentPlan.shoppingItems.length})</span>
            </button>

            {/* Quick action: Share */}
            <button
              onClick={() => setIsExportOpen(true)}
              className="p-2 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 active:scale-95 transition-tap tap-target flex items-center justify-center shadow-xs cursor-pointer"
              aria-label="Chia sẻ thực đơn"
              title="Chia sẻ thực đơn"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Quick action: Regenerate dropdown */}
            <button
              onClick={() => setIsRegeneratingOpen(!isRegeneratingOpen)}
              className="p-2 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 active:scale-95 transition-tap tap-target flex items-center justify-center shadow-xs cursor-pointer"
              aria-label="Tùy chọn tạo lại"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Regenerate Dropdown Options */}
        {isRegeneratingOpen && (
          <div className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-card space-y-1 animate-slide-up">
            <p className="text-[11px] font-semibold text-slate-500 px-2 pb-1 border-b border-slate-100">
              Tạo lại thực đơn theo hướng:
            </p>
            {[
              { label: '💰 Tiết kiệm chi phí hơn', priority: 'budget' },
              { label: '⚡ Nấu nhanh hơn (<25p)', priority: 'quick' },
              { label: '🧊 Dùng nhiều đồ trong tủ lạnh hơn', priority: 'use_fridge' },
              { label: '🇻🇳 Nhiều món Việt hơn', priority: 'vietnamese' },
              { label: '🥗 Nhiều rau xanh, thanh đạm hơn', priority: 'more_veggies' },
              { label: '🔄 Tạo lại hoàn toàn ngẫu nhiên', priority: 'random' },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleQuickRegenerate(opt.priority)}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-800 transition-colors cursor-pointer"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Summary Stat Cards */}
        <WeekSummaryCards plan={currentPlan} />

        {/* AI Insight banner if available */}
        {currentPlan.aiExplanation && (
          <div className="bg-takosan-mint/70 rounded-xl p-3 border border-takosan-mint-deep/80 flex items-start gap-2 text-xs text-takosan-green-deep">
            <Sparkles className="w-4 h-4 text-takosan-green shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{currentPlan.aiExplanation}</p>
          </div>
        )}

        {/* Vertical Feed of Days */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-takosan-green" />
              <span>Lịch ăn 7 ngày</span>
            </h3>

            <button
              onClick={() => navigate('/week/setup')}
              className="text-xs font-semibold text-takosan-green hover:text-takosan-green-deep flex items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cài đặt lại</span>
            </button>
          </div>

          <div className="space-y-4">
            {currentPlan.days.map((day) => {
              const dayDateObj = new Date(day.date);
              const formattedDate = `${dayDateObj.getDate()}/${dayDateObj.getMonth() + 1}`;

              return (
                <div key={day.id} className="space-y-2">
                  {/* Day Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-slate-900">
                        {day.dayNameVi}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        {formattedDate}
                      </span>
                    </div>

                    {day.dayType === 'eat_out' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80">
                        Ăn ngoài
                      </span>
                    )}
                    {day.dayType === 'flexible' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/80">
                        Linh hoạt
                      </span>
                    )}
                  </div>

                  {/* Day Meal Cards */}
                  <div className="space-y-2">
                    {day.slots.map((slot) => (
                      <MealCard
                        key={slot.id}
                        slot={slot}
                        onClick={() => {
                          if (slot.recipe) {
                            navigate(`/week/${currentPlan.id}/meal/${slot.id}`);
                          }
                        }}
                        onSwapClick={() => {
                          openSwap(slot.id);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive Bottom Sheet for Meal Swapping */}
      <MealSwapSheet />

      {/* Week Export & Share Modal */}
      <WeekExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        plan={currentPlan}
        shoppingItems={currentPlan.shoppingItems}
      />
    </div>
  );
};
