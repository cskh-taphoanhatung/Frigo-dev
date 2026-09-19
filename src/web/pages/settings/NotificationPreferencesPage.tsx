import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, Clock, ShoppingBag, Sparkles } from 'lucide-react';
import { getCurrentScope } from '../../services/http';
import { Page, PageHeader, Switch, UnavailableState } from '../../design-system/primitives';

type ToggleState = {
  remindWeekPlan: boolean;
  remindExpiring: boolean;
  remindShopping: boolean;
  remindTodayMeal: boolean;
  promoUpdates: boolean;
};

const DEFAULT_TOGGLES: ToggleState = {
  remindWeekPlan: true,
  remindExpiring: true,
  remindShopping: true,
  remindTodayMeal: true,
  promoUpdates: false,
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

const PERMISSION_LABELS: Record<string, string> = {
  granted: 'đã cho phép',
  denied: 'đã chặn',
  default: 'chưa được yêu cầu',
  unsupported: 'trình duyệt không hỗ trợ',
};

/**
 * T17 screen 24 — notification preferences, separated from the inbox
 * (screen 23). Only real capability is offered: device-local reminder
 * switches; push/email delivery is honestly unavailable.
 */
export const NotificationPreferencesPage: React.FC = () => {
  const navigate = useNavigate();
  const [toggles, setToggles] = useState<ToggleState>(readToggles);

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

  const browserPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  return (
    <Page width="compact">
      <PageHeader
        title="Tùy chỉnh thông báo"
        subtitle="Nhắc nhở từ tủ lạnh của bạn"
        onBack={() => navigate('/me')}
      />

      <section aria-label="Nhắc nhở trong ứng dụng" className="mb-6">
        <h2 className="text-type-label text-semantic-text-primary mb-2">Nhắc nhở trong ứng dụng</h2>
        <div className="bg-semantic-surface rounded-card border border-semantic-border divide-y divide-semantic-border">
          {(
            [
              { key: 'remindWeekPlan', label: 'Nhắc lập thực đơn tuần', desc: 'Tối Chủ nhật: chuẩn bị tuần mới', icon: Calendar },
              { key: 'remindExpiring', label: 'Nhắc nguyên liệu sắp hết', desc: 'Thực phẩm còn 1-2 ngày trong tủ', icon: Clock },
              { key: 'remindShopping', label: 'Nhắc đi chợ', desc: 'Danh sách nguyên liệu thiếu buổi sáng', icon: ShoppingBag },
              { key: 'remindTodayMeal', label: 'Nhắc bữa ăn hôm nay', desc: 'Gợi ý món tối trước 17:00', icon: Bell },
              { key: 'promoUpdates', label: 'Khuyến mãi & cập nhật', desc: 'Tính năng mới và ưu đãi Takosan Plus', icon: Sparkles },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center gap-3 px-4">
                <span className="w-9 h-9 rounded-card bg-semantic-background-subtle text-semantic-action-primary flex items-center justify-center shrink-0" aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </span>
                <Switch
                  checked={toggles[item.key]}
                  onChange={() => toggle(item.key)}
                  label={item.label}
                  description={item.desc}
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-semantic-text-muted mt-2 px-1">
          Các lựa chọn này chỉ lưu trên thiết bị này và điều khiển nhắc nhở trong ứng dụng.
        </p>
      </section>

      <section aria-label="Kênh gửi thông báo" className="space-y-3">
        <h2 className="text-type-label text-semantic-text-primary">Kênh gửi</h2>
        <UnavailableState title="Email — chưa cấu hình">
          Takosan hiện chưa gửi email. Tính năng gửi thực đơn qua email sẽ xuất hiện khi kênh
          máy chủ được cấu hình; trạng thái này là thật, không phải lỗi.
        </UnavailableState>
        <UnavailableState title="Thông báo đẩy — chưa cấu hình">
          Ứng dụng chưa đăng ký kênh đẩy từ máy chủ. Trình duyệt hiện trả về quyền thông báo:{' '}
          <strong>{PERMISSION_LABELS[browserPermission] ?? 'không xác định'}</strong>. Dù quyền
          trình duyệt thế nào, Takosan không gửi đẩy cho đến khi kênh máy chủ hoạt động.
        </UnavailableState>
      </section>
    </Page>
  );
};
