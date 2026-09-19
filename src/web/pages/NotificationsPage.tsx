import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from '../components/common/TopBar';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { api } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { Bell, ChefHat, ChevronRight, Clock, ShoppingBag, SlidersHorizontal } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
  expiring_soon: Clock,
  shopping_reminder: ShoppingBag,
  cook_ready: ChefHat,
};

function relativeTimeVi(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

export const NotificationsPage: React.FC = () => {
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.getNotifications(),
  });

  return (
    <div className="min-h-screen bg-takosan-cream pb-16">
      <TopBar showBack title="Thông báo" subtitle="Nhắc nhở từ tủ lạnh của bạn" />

      <div className="px-4 pt-4 space-y-5 animate-fade-in">
        {/* Live notifications derived from real household state */}
        <section aria-label="Thông báo mới">
          {notificationsQuery.isPending ? (
            <InlineLoading label="Đang tải thông báo…" />
          ) : notificationsQuery.isError ? (
            <InlineError
              error={notificationsQuery.error}
              onRetry={() => notificationsQuery.refetch()}
            />
          ) : (notificationsQuery.data ?? []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center">
              <Bell className="w-6 h-6 text-slate-300 mx-auto mb-1.5" aria-hidden="true" />
              <p className="text-xs text-slate-600 font-medium">
                Chưa có thông báo mới. Takosan sẽ nhắc khi có nguyên liệu cần dùng sớm.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {(notificationsQuery.data ?? []).map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                return (
                  <div key={n.id} className="p-4 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-takosan-mint text-takosan-green-deep flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-heading font-semibold text-sm text-slate-900 leading-snug">
                        {n.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{relativeTimeVi(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Preferences live on their own route (T17 screen 24) — inbox is
            notifications only (screen 23). */}
        <Link
          to="/settings/notifications"
          className="flex items-center justify-between gap-3 rounded-2xl border border-takosan-cream-line bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50/60 transition-colors"
        >
          <span className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-takosan-green" aria-hidden="true" />
            Tùy chỉnh nhắc nhở
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
};
