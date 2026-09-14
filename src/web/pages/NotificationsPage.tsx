import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from '../components/common/TopBar';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { api } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { getCurrentScope } from '../services/http';
import {
  Bell,
  Calendar,
  Clock,
  ShoppingBag,
  Sparkles,
  Mail,
  Smartphone,
  ChefHat,
} from 'lucide-react';
import { clsx } from 'clsx';

type ToggleState = {
  remindWeekPlan: boolean;
  remindExpiring: boolean;
  remindShopping: boolean;
  remindTodayMeal: boolean;
  promoUpdates: boolean;
  emailNotification: boolean;
  pushNotification: boolean;
};

const DEFAULT_TOGGLES: ToggleState = {
  remindWeekPlan: true,
  remindExpiring: true,
  remindShopping: true,
  remindTodayMeal: true,
  promoUpdates: false,
  emailNotification: false,
  pushNotification: true,
};

// Device-local preference, scoped per user so account switches don't leak.
function prefsKey(): string | null {
  const { userId } = getCurrentScope();
  return userId ? `frigo_notify_prefs_${encodeURIComponent(userId)}` : null;
}

function readToggles(): ToggleState {
  try {
    const key = prefsKey();
    const raw = key ? localStorage.getItem(key) : null;
    if (raw) return { ...DEFAULT_TOGGLES, ...JSON.parse(raw) };
  } catch {
    // corrupted prefs fall back to defaults
  }
  return DEFAULT_TOGGLES;
}

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
  const [toggles, setToggles] = useState<ToggleState>(readToggles);

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.getNotifications(),
  });

  const toggle = (key: keyof ToggleState) => {
    setToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        const storageKey = prefsKey();
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage full/unavailable: keep in-memory state
      }
      return next;
    });
  };

  const NOTIFICATION_SETTINGS = [
    {
      key: 'remindWeekPlan' as const,
      label: 'Nhắc lập thực đơn tuần',
      desc: 'Nhắc vào tối Chủ nhật để chuẩn bị đi chợ cho tuần mới',
      icon: Calendar,
    },
    {
      key: 'remindExpiring' as const,
      label: 'Nhắc nguyên liệu sắp hết',
      desc: 'Cảnh báo thực phẩm còn 1-2 ngày hết hạn trong tủ',
      icon: Clock,
    },
    {
      key: 'remindShopping' as const,
      label: 'Nhắc đi chợ',
      desc: 'Gửi danh sách nguyên liệu thiếu vào buổi sáng',
      icon: ShoppingBag,
    },
    {
      key: 'remindTodayMeal' as const,
      label: 'Nhắc bữa ăn hôm nay',
      desc: 'Gợi ý món tối trước giờ tan tầm (17:00)',
      icon: Bell,
    },
    {
      key: 'promoUpdates' as const,
      label: 'Khuyến mãi & cập nhật',
      desc: 'Thông tin tính năng mới và ưu đãi từ Takosan Plus',
      icon: Sparkles,
    },
    {
      key: 'emailNotification' as const,
      label: 'Email',
      desc: 'Gửi thực đơn tuần và hóa đơn dinh dưỡng qua email',
      icon: Mail,
    },
    {
      key: 'pushNotification' as const,
      label: 'Thông báo trên ứng dụng',
      desc: 'Cho phép hiển thị thông báo đẩy (Push notification)',
      icon: Smartphone,
    },
  ];

  return (
    <div className="min-h-screen bg-takosan-cream pb-16 max-w-md mx-auto">
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

        {/* Device-local reminder preferences */}
        <section aria-label="Tùy chỉnh nhắc nhở" className="space-y-2">
          <h3 className="font-heading font-bold text-xs text-slate-800 uppercase tracking-wider px-1">
            Tùy chỉnh nhắc nhở
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {NOTIFICATION_SETTINGS.map((item) => {
              const isChecked = toggles[item.key];
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={isChecked}
                  onClick={() => toggle(item.key)}
                  className="w-full text-left p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5 pr-3 min-w-0">
                    <div
                      className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                        isChecked ? 'bg-takosan-mint text-takosan-green-deep' : 'bg-slate-100 text-slate-400'
                      )}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-heading font-semibold text-sm text-slate-900 leading-snug truncate">
                        {item.label}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {/* iOS-style Green Switch */}
                  <div
                    className={clsx(
                      'w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 relative flex items-center',
                      isChecked ? 'bg-takosan-green' : 'bg-slate-300'
                    )}
                    aria-hidden="true"
                  >
                    <div
                      className={clsx(
                        'w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out',
                        isChecked ? 'translate-x-5.5' : 'translate-x-0'
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 px-1">
            Các lựa chọn này chỉ lưu sở thích trên thiết bị, chưa bật gửi email hoặc thông báo đẩy.
          </p>
        </section>
      </div>
    </div>
  );
};
