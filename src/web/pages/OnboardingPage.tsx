import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Check, Sparkles, Users, Utensils } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../components/common/Button';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { isOfflineGuestSession } from '../lib/private-session';
import { api } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

const CUISINE_TAGS = [
  { id: 'vietnamese', label: 'Việt Nam' },
  { id: 'korean', label: 'Hàn Quốc' },
  { id: 'japanese', label: 'Nhật Bản' },
  { id: 'western', label: 'Âu - Mỹ' },
  { id: 'chinese', label: 'Trung Hoa' },
  { id: 'thai', label: 'Thái Lan' },
  { id: 'other', label: 'Khác' },
];

const RESTRICTION_TAGS = [
  { id: 'beef', label: 'Thịt bò' },
  { id: 'seafood', label: 'Hải sản' },
  { id: 'peanuts', label: 'Đậu phộng' },
  { id: 'spicy', label: 'Đồ cay' },
  { id: 'mushroom', label: 'Nấm' },
  { id: 'onion_garlic', label: 'Hành tỏi' },
  { id: 'milk', label: 'Sữa' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'other', label: 'Khác' },
];

export const OnboardingPage: React.FC<{ initialStep?: 1 | 2 | 3 }> = ({ initialStep = 1 }) => {
  const navigate = useNavigate();
  const setOnboardingData = useAuthStore((state) => state.setOnboardingData);
  const [step, setStep] = useState(initialStep);
  const [householdSize, setHouseholdSize] = useState(2);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(['vietnamese']);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<'today' | 'week' | 'both'>('both');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (value: string, values: string[], update: (next: string[]) => void) => {
    update(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const finish = async () => {
    setError(null);
    setIsSaving(true);
    const onboarding = {
      householdSize,
      spicyLevel: restrictions.includes('spicy') ? 'none' as const : 'medium' as const,
      favoriteCuisines: selectedCuisines,
      dietaryRestrictions: restrictions,
      primaryGoal,
    };
    try {
      if (!isOfflineGuestSession()) await api.completeOnboarding(onboarding);
      setOnboardingData(onboarding);
      navigate(primaryGoal === 'week' ? '/week/setup' : '/', { replace: true });
    } catch {
      setError('Chưa thể lưu sở thích. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-takosan-cream px-5 py-7 text-takosan-navy">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col">
        <header className="mb-7 flex items-center justify-between">
          <img src={TAKOSAN_BRAND.logos.horizontal} alt="Takosan" className="h-10 w-auto" />
          <span className="rounded-full border border-takosan-mint-deep bg-white px-3 py-1 text-xs font-bold text-takosan-green">{step} / 3</span>
        </header>

        <div className="mb-7 grid grid-cols-3 gap-2" aria-label={`Bước ${step} trên 3`}>
          {[1, 2, 3].map((item) => <span key={item} className={clsx('h-1.5 rounded-full', item <= step ? 'bg-takosan-green' : 'bg-slate-200')} />)}
        </div>

        {step === 1 && (
          <section className="flex flex-1 flex-col animate-fade-in">
            <div className="mb-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-takosan-green">Khẩu phần & gu món</p>
              <h1 className="font-heading text-3xl font-extrabold leading-tight">Takosan nên nấu cho nhà mình thế nào?</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Chỉ ba bước ngắn để gợi ý món sát với gia đình bạn. Không cần đăng nhập thêm lần nào nữa.</p>
            </div>

            <div className="mb-7 rounded-3xl border border-takosan-cream-line bg-white p-5 shadow-sm">
              <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-600">Số người thường ăn</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((number) => (
                  <button key={number} type="button" onClick={() => setHouseholdSize(number)} className={clsx(
                    'flex flex-1 flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-bold transition-tap',
                    householdSize === number ? 'border-takosan-green bg-takosan-green text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-700',
                  )}>
                    <Users className="h-4 w-4" />
                    {number === 5 ? '5+' : number}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-600">Món nhà mình thích</label>
              <div className="flex flex-wrap gap-2">
                {CUISINE_TAGS.map((tag) => {
                  const selected = selectedCuisines.includes(tag.id);
                  return <button key={tag.id} type="button" onClick={() => toggle(tag.id, selectedCuisines, setSelectedCuisines)} className={clsx(
                    'flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-semibold transition-tap',
                    selected ? 'border-takosan-green bg-takosan-mint text-takosan-green-deep' : 'border-slate-200 bg-white text-slate-700',
                  )}>{tag.label}{selected && <Check className="h-3.5 w-3.5" />}</button>;
                })}
              </div>
            </div>

            <Button fullWidth size="lg" onClick={() => setStep(2)} className="mt-auto rounded-2xl">Tiếp tục</Button>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-1 flex-col animate-fade-in">
            <div className="mb-7">
              <button type="button" onClick={() => setStep(1)} className="mb-5 text-sm font-semibold text-takosan-green">← Quay lại</button>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-takosan-green">Ăn uống an tâm</p>
              <h1 className="font-heading text-3xl font-extrabold leading-tight">Có nguyên liệu nào bạn muốn tránh?</h1>
              <p className="mt-2 text-sm text-slate-600">Có thể bỏ qua nếu không có. Bạn chỉnh lại bất cứ lúc nào trong hồ sơ.</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {RESTRICTION_TAGS.map((tag) => {
                const selected = restrictions.includes(tag.id);
                return <button key={tag.id} type="button" onClick={() => toggle(tag.id, restrictions, setRestrictions)} className={clsx(
                  'rounded-2xl border px-4 py-3 text-sm font-semibold transition-tap',
                  selected ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-700',
                )}>{selected ? '× ' : ''}{tag.label}</button>;
              })}
            </div>

            <Button fullWidth size="lg" onClick={() => setStep(3)} className="mt-auto rounded-2xl">Tiếp tục</Button>
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-1 flex-col animate-fade-in">
            <div className="mb-7">
              <button type="button" onClick={() => setStep(2)} className="mb-5 text-sm font-semibold text-takosan-green">← Quay lại</button>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-takosan-green">Đi thẳng tới giá trị</p>
              <h1 className="font-heading text-3xl font-extrabold leading-tight">Bạn muốn Takosan giúp việc gì trước?</h1>
            </div>

            <div className="space-y-3">
              {[
                { id: 'today' as const, title: 'Hôm nay ăn gì?', description: 'Gợi ý món ngay từ nguyên liệu đang có.', icon: Utensils },
                { id: 'week' as const, title: 'Lên thực đơn tuần', description: 'Chuẩn bị bữa ăn và danh sách đi chợ.', icon: Calendar },
                { id: 'both' as const, title: 'Kết hợp cả hai', description: 'Linh hoạt hôm nay, chủ động cả tuần.', icon: Sparkles },
              ].map((goal) => {
                const Icon = goal.icon;
                const selected = primaryGoal === goal.id;
                return <button key={goal.id} type="button" onClick={() => setPrimaryGoal(goal.id)} className={clsx(
                  'flex w-full items-center gap-4 rounded-3xl border bg-white p-4 text-left shadow-sm transition-tap',
                  selected ? 'border-takosan-green ring-2 ring-takosan-green/20' : 'border-slate-200',
                )}>
                  <span className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', selected ? 'bg-takosan-mint text-takosan-green' : 'bg-slate-100 text-slate-500')}><Icon className="h-5 w-5" /></span>
                  <span className="flex-1"><strong className="block font-heading text-base">{goal.title}</strong><span className="mt-1 block text-xs text-slate-500">{goal.description}</span></span>
                  {selected && <Check className="h-5 w-5 text-takosan-green" />}
                </button>;
              })}
            </div>

            <div className="mt-auto pt-7">
              {error && <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
              <Button fullWidth size="lg" onClick={finish} isLoading={isSaving} className="flex items-center justify-center gap-2 rounded-2xl">
                Bắt đầu với Takosan <ArrowRight className="h-5 w-5" />
              </Button>
              <p className="mt-3 text-center text-xs text-slate-500">Sở thích được lưu cho tài khoản này và có thể thay đổi sau.</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
