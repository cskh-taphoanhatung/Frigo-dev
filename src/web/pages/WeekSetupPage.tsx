import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeekStore } from '../stores/useWeekStore';
import { TopBar } from '../components/common/TopBar';
import { Button } from '../components/common/Button';
import { WeeklyPriority, ShoppingFrequency, DayType } from '@frigo/domain';
import { Check, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export const WeekSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { setupDraft, updateSetupDraft } = useWeekStore();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Meal slots preset
  const [mealPreset, setMealPreset] = useState<'dinner_only' | 'working_people' | 'all'>(
    (setupDraft.mealSlotsPreset as any) || 'dinner_only'
  );

  // Step 2: Budget
  const [budgetVnd, setBudgetVnd] = useState<number | null>(
    setupDraft.budgetTargetVnd !== undefined ? setupDraft.budgetTargetVnd : 750000
  );
  const [isUnlimitedBudget, setIsUnlimitedBudget] = useState(setupDraft.budgetTargetVnd === null);

  // Step 3: Schedule (T2 to CN)
  const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const [daySchedules, setDaySchedules] = useState<DayType[]>([
    'cooking',
    'cooking',
    'cooking',
    'cooking',
    'flexible',
    'cooking',
    'cooking',
  ]);
  const [skipDetailedSchedule, setSkipDetailedSchedule] = useState(false);

  // Step 4: Priorities (Max 3, default: use_fridge)
  const [priorities, setPriorities] = useState<WeeklyPriority[]>(
    setupDraft.priorities || ['use_fridge']
  );

  // Step 5: Shopping frequency
  const [frequency, setFrequency] = useState<ShoppingFrequency>(
    setupDraft.shoppingFrequency || 'once'
  );

  const PRIORITY_OPTIONS: { id: WeeklyPriority; label: string; icon: string }[] = [
    { id: 'use_fridge', label: 'Dùng hết đồ trong tủ', icon: '🧊' },
    { id: 'budget', label: 'Tiết kiệm chi phí', icon: '💰' },
    { id: 'quick', label: 'Nấu nhanh dưới 25p', icon: '⚡' },
    { id: 'variety', label: 'Ăn đa dạng, đổi món', icon: '🌈' },
    { id: 'more_veggies', label: 'Nhiều rau xanh hơn', icon: '🥬' },
    { id: 'high_protein', label: 'Giàu đạm (Protein cao)', icon: '🥩' },
    { id: 'low_oil', label: 'Thanh đạm, ít dầu mỡ', icon: '🥗' },
    { id: 'less_shopping', label: 'Ít phải mua thêm', icon: '🛒' },
    { id: 'meal_prep', label: 'Nấu 1 lần ăn 2 bữa (Meal prep)', icon: '🍱' },
    { id: 'new_recipes', label: 'Thử món mới lạ', icon: '✨' },
  ];

  const togglePriority = (p: WeeklyPriority) => {
    if (priorities.includes(p)) {
      if (priorities.length > 1) {
        setPriorities(priorities.filter((item) => item !== p));
      }
    } else {
      if (priorities.length < 3) {
        setPriorities([...priorities, p]);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      // Save to draft and navigate to generating screen
      updateSetupDraft({
        mealSlotsPreset: mealPreset,
        budgetTargetVnd: isUnlimitedBudget ? null : budgetVnd,
        priorities,
        shoppingFrequency: frequency,
      });
      navigate('/week/generating');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/week');
    }
  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-28">
      <TopBar
        showBack
        onBack={handleBack}
        title="Thiết lập thực đơn tuần"
        subtitle={`Bước ${currentStep} / 5`}
      />

      <div className="px-4 pt-4 space-y-5">
        {/* Step Progress Bar */}
        <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-takosan-green h-full transition-tap duration-300 rounded-full"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>

        {/* STEP 1: Meal Slots */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-md bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/60">
                Bước 1 / 5
              </span>
              <h2 className="font-heading font-bold text-xl text-slate-900 mt-2">
                Bạn muốn Takosan lên kế hoạch cho những bữa nào?
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Chọn tần suất bữa ăn gia đình bạn cần nấu tại nhà
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: 'dinner_only',
                  title: 'Chỉ bữa tối (Khuyên dùng)',
                  desc: 'T2 đến CN: Nấu bữa tối tại nhà',
                  badge: 'Phổ biến nhất',
                },
                {
                  id: 'working_people',
                  title: 'Người đi làm bận rộn',
                  desc: 'T2–T6: Bữa tối • T7–CN: Trưa & Tối',
                  badge: 'Tiện lợi',
                },
                {
                  id: 'all',
                  title: 'Toàn bộ các bữa',
                  desc: 'Sáng, Trưa và Tối cả tuần',
                  badge: 'Chi tiết',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setMealPreset(opt.id as any)}
                  className={clsx(
                    'p-4 rounded-xl border cursor-pointer transition-tap active:scale-[0.99] flex items-center justify-between',
                    mealPreset === opt.id
                      ? 'bg-white border-takosan-green shadow-xs ring-1 ring-takosan-green'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-heading font-semibold text-sm text-slate-900">
                        {opt.title}
                      </h4>
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>

                  <div
                    className={clsx(
                      'w-5 h-5 rounded-full flex items-center justify-center border shrink-0',
                      mealPreset === opt.id
                        ? 'bg-takosan-green border-takosan-green text-white'
                        : 'border-slate-300'
                    )}
                  >
                    {mealPreset === opt.id && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Budget */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-md bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/60">
                Bước 2 / 5
              </span>
              <h2 className="font-heading font-bold text-xl text-slate-900 mt-2">
                Ngân sách thực phẩm tuần này
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Takosan sẽ tối ưu mua nguyên liệu vừa vặn trong hạn mức
              </p>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: '500.000đ', value: 500000 },
                { label: '750.000đ', value: 750000 },
                { label: '1.000.000đ', value: 1000000 },
                { label: '1.500.000đ', value: 1500000 },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setBudgetVnd(p.value);
                    setIsUnlimitedBudget(false);
                  }}
                  className={clsx(
                    'p-3.5 rounded-xl border text-sm font-heading font-semibold transition-tap tap-target active:scale-[0.98]',
                    !isUnlimitedBudget && budgetVnd === p.value
                      ? 'bg-takosan-green text-white shadow-xs border-takosan-green'
                      : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Unlimited Option */}
            <div
              onClick={() => {
                setIsUnlimitedBudget(!isUnlimitedBudget);
                if (!isUnlimitedBudget) setBudgetVnd(null);
                else setBudgetVnd(750000);
              }}
              className={clsx(
                'p-4 rounded-xl border cursor-pointer transition-tap flex items-center justify-between',
                isUnlimitedBudget
                  ? 'bg-white border-takosan-green ring-1 ring-takosan-green shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              )}
            >
              <div>
                <h4 className="font-heading font-semibold text-sm text-slate-900">
                  Không giới hạn ngân sách
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tập trung tối đa vào độ ngon và chất lượng món ăn
                </p>
              </div>

              <div
                className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center border shrink-0',
                  isUnlimitedBudget
                    ? 'bg-takosan-green border-takosan-green text-white'
                    : 'border-slate-300'
                )}
              >
                {isUnlimitedBudget && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Cooking Schedule */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-md bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/60">
                  Bước 3 / 5
                </span>
                <h2 className="font-heading font-bold text-xl text-slate-900 mt-2">
                  Lịch nấu ăn trong tuần
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSkipDetailedSchedule(!skipDetailedSchedule)}
                className="text-xs font-semibold text-takosan-green hover:underline"
              >
                {skipDetailedSchedule ? 'Cấu hình chi tiết' : 'Nấu cả tuần'}
              </button>
            </div>

            {!skipDetailedSchedule ? (
              <div className="space-y-2">
                {DAY_LABELS.map((dayName, idx) => (
                  <div
                    key={dayName}
                    className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-xs"
                  >
                    <span className="font-heading font-semibold text-xs text-slate-900 w-16">
                      {dayName}
                    </span>

                    <div className="flex gap-1.5">
                      {[
                        { id: 'cooking', label: 'Nấu' },
                        { id: 'eat_out', label: 'Ăn ngoài' },
                        { id: 'flexible', label: 'Linh hoạt' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const updated = [...daySchedules];
                            updated[idx] = t.id as DayType;
                            setDaySchedules(updated);
                          }}
                          className={clsx(
                            'px-2.5 py-1 rounded-lg text-xs font-semibold transition-tap tap-target',
                            daySchedules[idx] === t.id
                              ? 'bg-takosan-green text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-white rounded-xl border border-slate-200/80 text-center">
                <p className="text-xs text-slate-500">
                  Takosan sẽ lên kế hoạch nấu ăn cho tất cả các ngày trong tuần.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Weekly Priorities */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-md bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/60">
                Bước 4 / 5
              </span>
              <h2 className="font-heading font-bold text-xl text-slate-900 mt-2">
                Tuần này bạn ưu tiên điều gì?
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Chọn tối đa 3 ưu tiên (Đang chọn: {priorities.length}/3)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = priorities.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => togglePriority(opt.id)}
                    className={clsx(
                      'p-3.5 rounded-xl border cursor-pointer transition-tap flex flex-col justify-between h-24 select-none active:scale-[0.98]',
                      isSelected
                        ? 'bg-white border-takosan-green shadow-xs ring-1 ring-takosan-green'
                        : 'bg-white border-slate-200/80 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{opt.icon}</span>
                      <div
                        className={clsx(
                          'w-4 h-4 rounded-full flex items-center justify-center border',
                          isSelected
                            ? 'bg-takosan-green border-takosan-green text-white'
                            : 'border-slate-300'
                        )}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                      </div>
                    </div>
                    <span className="font-heading font-semibold text-xs text-slate-800 leading-snug">
                      {opt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: Shopping Frequency */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-md bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/60">
                Bước 5 / 5
              </span>
              <h2 className="font-heading font-bold text-xl text-slate-900 mt-2">
                Bạn muốn đi chợ mấy lần?
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Giúp Takosan sắp xếp nguyên liệu dễ hỏng và tính toán chuyến mua sắm
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: 'once',
                  title: '1 lần duy nhất đầu tuần (Khuyên dùng)',
                  desc: 'Đi chợ 1 chuyến, ưu tiên đồ dễ hỏng ăn trước',
                },
                {
                  id: 'twice',
                  title: '2 lần / tuần',
                  desc: 'Đi chợ đầu tuần và giữa tuần để rau củ luôn tươi',
                },
                {
                  id: 'three_plus',
                  title: '3 lần trở lên',
                  desc: 'Thích mua thực phẩm tươi sống mỗi ngày',
                },
                {
                  id: 'flexible',
                  title: 'Không cố định',
                  desc: 'Tùy theo nhu cầu từng bữa',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setFrequency(opt.id as ShoppingFrequency)}
                  className={clsx(
                    'p-4 rounded-xl border cursor-pointer transition-tap active:scale-[0.99] flex items-center justify-between',
                    frequency === opt.id
                      ? 'bg-white border-takosan-green shadow-xs ring-1 ring-takosan-green'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  )}
                >
                  <div>
                    <h4 className="font-heading font-semibold text-sm text-slate-900">
                      {opt.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>

                  <div
                    className={clsx(
                      'w-5 h-5 rounded-full flex items-center justify-center border shrink-0',
                      frequency === opt.id
                        ? 'bg-takosan-green border-takosan-green text-white'
                        : 'border-slate-300'
                    )}
                  >
                    {frequency === opt.id && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Next / Complete CTA */}
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 md:left-20 lg:left-64 p-4 md:pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-lg">
        <Button
          fullWidth
          size="lg"
          onClick={handleNext}
          className="flex items-center justify-center gap-2"
        >
          <span>{currentStep === 5 ? 'Tạo thực đơn tuần ngay' : 'Tiếp tục'}</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
