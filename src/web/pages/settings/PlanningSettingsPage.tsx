import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Wallet, ShoppingBag, CalendarDays, Sparkles } from 'lucide-react';
import { weekApi } from '../../services/week';
import { queryKeys } from '../../lib/queryKeys';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { Button } from '../../components/common/Button';
import { Page, PageHeader, StickyActions, Surface, Switch, UnavailableState } from '../../design-system/primitives';

const MEAL_SLOT_PRESETS = [
  { id: 'dinner_only', label: 'Chỉ bữa tối', desc: 'Một món chính mỗi ngày' },
  { id: 'working_people', label: 'Người bận rộn', desc: 'Bữa trưa và bữa tối' },
  { id: 'all', label: 'Đủ bữa', desc: 'Sáng, trưa, tối' },
] as const;

const FREQUENCIES = [
  { id: 'once', label: '1 lần / tuần' },
  { id: 'twice', label: '2 lần / tuần' },
  { id: 'three_plus', label: '3+ lần / tuần' },
  { id: 'flexible', label: 'Không cố định' },
] as const;

const PRIORITIES = [
  { id: 'use_fridge', label: 'Dùng hết tủ lạnh', desc: 'Ưu tiên nguyên liệu sẵn có' },
  { id: 'budget', label: 'Đúng ngân sách', desc: 'Giữ tổng chi phí trong hạn mức' },
  { id: 'variety', label: 'Đa dạng món', desc: 'Tránh lặp lại món gần nhau' },
] as const;

/**
 * T17 screen 22 — planning defaults for future plans over the real
 * GET/PATCH /week/preferences contract. Distinct from the new-plan flow
 * (WeekSetup): saving here never generates a plan.
 */
export const PlanningSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    mealSlotsPreset: string;
    budgetTargetVnd: number | null;
    shoppingFrequency: string;
    priorities: string[];
    autoWeeklyPlanEnabled: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prefsQuery = useQuery({
    queryKey: queryKeys.planningPreferences(),
    queryFn: () => weekApi.getWeekPreferences(),
  });

  useEffect(() => {
    if (!draft && prefsQuery.data) {
      const p = prefsQuery.data;
      setDraft({
        mealSlotsPreset: p.mealSlotsPreset ?? 'dinner_only',
        budgetTargetVnd: p.budgetTargetVnd ?? 750000,
        shoppingFrequency: p.shoppingFrequency ?? 'once',
        priorities: Array.isArray(p.priorities) ? p.priorities : ['use_fridge'],
        autoWeeklyPlanEnabled: Boolean(p.autoWeeklyPlanEnabled),
      });
    }
  }, [draft, prefsQuery.data]);

  const save = async () => {
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      const result = await weekApi.updateWeekPreferences(draft);
      await queryClient.invalidateQueries({ queryKey: queryKeys.planningPreferences() });
      // Offline replay queued: say so rather than implying the server has it.
      if ((result as { pendingSync?: boolean })?.pendingSync) {
        setSavedAt(null);
        setError('Chưa có mạng: cài đặt sẽ được đồng bộ lên máy chủ khi kết nối lại.');
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setError('Chưa thể lưu cài đặt lập kế hoạch. Thử lại khi có kết nối.');
    } finally {
      setSaving(false);
    }
  };

  const togglePriority = (id: string) =>
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        priorities: prev.priorities.includes(id)
          ? prev.priorities.filter((p) => p !== id)
          : [...prev.priorities, id],
      };
    });

  return (
    <Page width="compact">
      <PageHeader
        title="Cài đặt lập thực đơn"
        subtitle="Giá trị mặc định cho các thực đơn kế tiếp"
        onBack={() => navigate('/me')}
      />
      <p className="text-xs text-semantic-text-muted mb-3">
        Đây là cài đặt mặc định, không tạo thực đơn mới. Để tạo, mở mục Thực đơn.
      </p>

      {prefsQuery.isPending && !draft && <InlineLoading label="Đang tải cài đặt…" />}
      {prefsQuery.isError && (
        <InlineError error={prefsQuery.error} onRetry={() => prefsQuery.refetch()} />
      )}
      {/* getWeekPreferences returns null when offline: say so instead of
          showing an endless loading state or fabricating defaults. */}
      {prefsQuery.isSuccess && prefsQuery.data === null && !draft && (
        <UnavailableState title="Không tải được cài đặt khi ngoại tuyến">
          Cần kết nối mạng để đọc cài đặt lập thực đơn hiện tại từ máy chủ. Thử lại khi có mạng.
        </UnavailableState>
      )}

      {draft && (
        <div className="space-y-4 pb-8">
          <Surface className="p-4 space-y-3">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <Wallet className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Ngân sách mục tiêu mỗi tuần
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[500000, 750000, 1000000, 1500000].map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={draft.budgetTargetVnd === b}
                  onClick={() => setDraft({ ...draft, budgetTargetVnd: b })}
                  className={`h-11 rounded-card text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.budgetTargetVnd === b
                      ? 'bg-semantic-action-primary text-semantic-text-inverse border-transparent'
                      : 'bg-semantic-surface text-semantic-text-secondary border-semantic-border'
                  }`}
                >
                  {b >= 1000000 ? `${b / 1000000}tr` : `${Math.round(b / 1000)}k`} VND
                </button>
              ))}
            </div>
            <p className="text-xs text-semantic-text-muted">Chi phí thực tế luôn hiển thị dạng ước tính.</p>
          </Surface>

          <Surface className="p-4 space-y-3">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Khung bữa mặc định
            </h2>
            <div className="space-y-2">
              {MEAL_SLOT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={draft.mealSlotsPreset === preset.id}
                  onClick={() => setDraft({ ...draft, mealSlotsPreset: preset.id })}
                  className={`w-full flex items-center justify-between gap-3 rounded-card border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.mealSlotsPreset === preset.id
                      ? 'border-semantic-action-primary bg-semantic-success-soft/40'
                      : 'border-semantic-border bg-semantic-surface hover:border-semantic-border-strong'
                  }`}
                >
                  <span>
                    <span className="text-sm font-semibold text-semantic-text-primary block">{preset.label}</span>
                    <span className="text-xs text-semantic-text-muted">{preset.desc}</span>
                  </span>
                  {draft.mealSlotsPreset === preset.id && (
                    <Check className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 space-y-3">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Tần suất đi chợ
            </h2>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={draft.shoppingFrequency === f.id}
                  onClick={() => setDraft({ ...draft, shoppingFrequency: f.id })}
                  className={`h-11 px-4 rounded-pill text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.shoppingFrequency === f.id
                      ? 'bg-semantic-action-primary text-semantic-text-inverse border-transparent'
                      : 'bg-semantic-surface text-semantic-text-secondary border-semantic-border'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 space-y-2">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" /> Ưu tiên khi chọn món
            </h2>
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={draft.priorities.includes(p.id)}
                onClick={() => togglePriority(p.id)}
                className="w-full flex items-center justify-between gap-3 rounded-card px-4 py-3 text-left hover:bg-semantic-background-subtle focus-visible:outline-none focus-visible:shadow-t17-focus"
              >
                <span>
                  <span className="text-sm font-semibold text-semantic-text-primary block">{p.label}</span>
                  <span className="text-xs text-semantic-text-muted">{p.desc}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-md border flex items-center justify-center ${
                    draft.priorities.includes(p.id)
                      ? 'bg-semantic-action-primary border-transparent text-white'
                      : 'border-semantic-border-strong bg-semantic-surface'
                  }`}
                >
                  {draft.priorities.includes(p.id) && <Check className="w-4 h-4" />}
                </span>
              </button>
            ))}
          </Surface>

          <div className="px-4">
            <Switch
              checked={draft.autoWeeklyPlanEnabled}
              onChange={(next) => setDraft({ ...draft, autoWeeklyPlanEnabled: next })}
              label="Gợi ý thực đơn tuần mới"
              description="Nhắc chuẩn bị thực đơn cho tuần kế tiếp"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-semantic-danger px-4">
              {error}
            </p>
          )}
          {savedAt && !error && (
            <p role="status" className="text-sm text-semantic-success px-4">
              Đã lưu cài đặt lập thực đơn.
            </p>
          )}

          <StickyActions>
            <Button variant="primary" fullWidth onClick={save} disabled={saving} isLoading={saving}>
              Lưu cài đặt
            </Button>
          </StickyActions>
        </div>
      )}
    </Page>
  );
};
