import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/common/TopBar';
import { Button } from '../components/common/Button';
import { useWeekStore } from '../stores/useWeekStore';
import { Check } from 'lucide-react';

export const WeekSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setupDraft, updateSetupDraft } = useWeekStore();

  const [budget, setBudget] = useState(setupDraft.budgetTargetVnd || 750000);
  const [frequency, setFrequency] = useState(setupDraft.shoppingFrequency || 'once');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSetupDraft({
      budgetTargetVnd: budget,
      shoppingFrequency: frequency,
    });
    setSaved(true);
    setTimeout(() => {
      navigate(-1);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-24">
      <TopBar showBack title="Cài đặt thực đơn tuần" />

      <div className="px-4 pt-4 space-y-5">
        {/* Budget Setting */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-heading font-bold text-sm text-slate-900">
            Ngân sách mặc định mỗi tuần
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[500000, 750000, 1000000, 1500000].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBudget(b)}
                className={`p-3 rounded-xl border text-xs font-semibold transition-tap tap-target active:scale-[0.98] ${
                  budget === b
                    ? 'bg-takosan-green text-white shadow-xs border-takosan-green'
                    : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {Math.round(b / 1000)}k VND
              </button>
            ))}
          </div>
        </div>

        {/* Shopping Frequency */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-heading font-bold text-sm text-slate-900">
            Tần suất đi chợ
          </h3>
          <div className="space-y-2">
            {[
              { id: 'once', label: '1 lần / tuần (Đầu tuần)' },
              { id: 'twice', label: '2 lần / tuần' },
              { id: 'three_plus', label: '3+ lần / tuần' },
              { id: 'flexible', label: 'Không cố định' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrequency(f.id as any)}
                className={`w-full p-3.5 rounded-xl border text-left text-xs font-semibold transition-tap flex items-center justify-between tap-target active:scale-[0.99] ${
                  frequency === f.id
                    ? 'bg-white border-takosan-green ring-1 ring-takosan-green text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>{f.label}</span>
                {frequency === f.id && <Check className="w-4 h-4 text-takosan-green stroke-[2.5]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <Button
            fullWidth
            size="lg"
            onClick={handleSave}
            className="flex items-center justify-center gap-2"
          >
            {saved ? <Check className="w-5 h-5" /> : null}
            <span>{saved ? 'Đã lưu thiết lập!' : 'Lưu thiết lập'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
