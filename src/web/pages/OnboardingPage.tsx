import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Button } from '../components/common/Button';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import {
  Users,
  Check,
  Calendar,
  Sparkles,
  ArrowRight,
  Mail,
  ChevronLeft,
  Utensils
} from 'lucide-react';
import { clsx } from 'clsx';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setOnboardingData, setGuestSession } = useAuthStore();
  const [guestError, setGuestError] = useState<string | null>(null);

  // 7 steps matching Master Board:
  // 1: Splash (1.1)
  // 2: Giới thiệu (1.2)
  // 3: Tạo tài khoản (1.3)
  // 4: Thông tin cơ bản (1.4)
  // 5: Sở thích & hạn chế (1.5)
  // 6: Takosan sẽ giúp bạn thế nào? (1.6)
  // 7: Hoàn tất (1.7)
  const [step, setStep] = useState(2); // Start at Intro 1.2 by default, can toggle to Splash 1.1

  // Form State
  const [householdSize, setHouseholdSize] = useState<number>(2);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<'today' | 'week' | 'both'>();

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

  const toggleCuisine = (id: string) => {
    if (selectedCuisines.includes(id)) {
      setSelectedCuisines(selectedCuisines.filter((c) => c !== id));
    } else {
      setSelectedCuisines([...selectedCuisines, id]);
    }
  };

  const toggleRestriction = (id: string) => {
    if (restrictions.includes(id)) {
      setRestrictions(restrictions.filter((r) => r !== id));
    } else {
      setRestrictions([...restrictions, id]);
    }
  };

  const handleFinish = async () => {
    setGuestError(null);
    try {
      await setGuestSession();
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Không thể khởi tạo phiên khách. Vui lòng thử lại.');
      return;
    }
    setOnboardingData({
      householdSize,
      spicyLevel: restrictions.includes('spicy') ? 'none' : 'medium',
      favoriteCuisines: selectedCuisines,
      dietaryRestrictions: restrictions,
      primaryGoal,
    });
    if (primaryGoal === 'week') {
      navigate('/week/setup');
    } else {
      navigate('/');
    }
  };

  // SEC-5: fake social login removed — real Google OAuth lives in AuthPage.
  // This screen only supports the guest flow now.

  // 1.1 SPLASH SCREEN
  if (step === 1) {
    return (
      <div
        onClick={() => setStep(2)}
        data-testid="onboarding-splash"
        className="min-h-screen bg-takosan-navy text-white flex flex-col justify-between items-center py-12 px-6 relative cursor-pointer max-w-md mx-auto overflow-hidden animate-fade-in"
      >
        {/* Top bar indicators */}
        <div className="w-full flex justify-between items-center text-xs text-white/60 font-medium pt-2">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-takosan-coral" />
            <span>Takosan</span>
          </div>
        </div>

        {/* Center Brand Header — supplied white lockup, never typed text */}
        <div className="text-center space-y-3 mt-4 z-10">
          <img
            src={TAKOSAN_BRAND.logos.horizontalWhite}
            alt="Takosan"
            className="h-12 w-auto mx-auto object-contain"
          />
          <p className="text-sm font-medium text-takosan-mint tracking-wide">
            Ăn đủ. Mua đủ. Dùng hết.
          </p>
        </div>

        {/* Center mascot */}
        <div className="relative my-auto z-10 py-6">
          <div className="w-64 h-64 mx-auto relative flex items-center justify-center">
            <div className="absolute inset-6 rounded-full bg-takosan-coral/15 blur-2xl" aria-hidden="true" />
            <img
              src={TAKOSAN_BRAND.mascot.wave}
              alt="Takosan vẫy tay chào"
              className="relative w-full h-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)] animate-float"
            />
          </div>
        </div>

        {/* Bottom Slogan */}
        <div className="text-center space-y-2 z-10 pb-4">
          <p className="font-heading font-bold text-lg text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-takosan-yellow" />
            <span>Tươi ngon hơn Mỗi ngày</span>
          </p>
          <p className="text-[11px] text-white/60">Chạm màn hình để bắt đầu</p>
        </div>
      </div>
    );
  }

  // 1.2 GIỚI THIỆU (WELCOME HERO)
  if (step === 2) {
    return (
      <div className="min-h-screen bg-takosan-cream flex flex-col justify-between px-6 py-10 relative max-w-md mx-auto animate-fade-in">
        <div className="pt-2">
          {/* Subtle link back to splash */}
          <button
            onClick={() => setStep(1)}
            className="text-xs text-slate-600 hover:text-takosan-green flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Xem Splash</span>
          </button>
        </div>

        {/* Brand Header */}
        <div className="text-center pt-2 space-y-2">
          <div className="flex justify-center mb-1">
            <img
              src={TAKOSAN_BRAND.logos.horizontal}
              alt="Takosan"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h2 className="font-heading font-bold text-2xl text-takosan-navy leading-tight">
            Biến tủ lạnh thành những bữa ăn tuyệt vời
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Ăn đủ. Mua đủ. Dùng hết. Tiết kiệm chi phí và không lãng phí thực phẩm.
          </p>
        </div>

        {/* Hero Artwork */}
        <div className="my-6">
          <div className="w-60 h-60 mx-auto flex items-center justify-center">
            <img
              src={TAKOSAN_BRAND.mascot.cooking}
              alt="Takosan nấu ăn"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-3 pb-2">
          <Button
            fullWidth
            size="lg"
            onClick={() => setStep(3)}
            className="bg-takosan-green hover:bg-[#26694C] text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md active:scale-98 transition-all"
          >
            Bắt đầu
          </Button>

          <div className="text-center pt-1">
            <button
              onClick={() => setStep(3)}
              className="text-xs font-semibold text-slate-600 hover:text-takosan-green transition-colors"
            >
              Đã có tài khoản? <span className="text-takosan-green underline underline-offset-2">Đăng nhập</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1.3 TẠO TÀI KHOẢN (SOCIAL AUTH)
  if (step === 3) {
    return (
      <div className="min-h-screen bg-takosan-cream flex flex-col justify-between px-6 py-10 relative max-w-md mx-auto animate-fade-in">
        <div>
          <button
            onClick={() => setStep(2)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50 mb-6 shadow-xs"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="space-y-2 mb-8">
            <h2 className="font-heading font-bold text-2xl text-takosan-navy tracking-tight">
              Chào mừng đến với Takosan
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tạo tài khoản hoặc đăng nhập nhanh để lưu trữ tủ lạnh và đồng bộ dữ liệu gia đình.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {/* Google — SEC-5: real OAuth flow lives in AuthPage */}
            <button
              onClick={() => navigate('/auth?mode=login&provider=google')}
              className="w-full py-3.5 px-4 rounded-2xl bg-white border border-slate-200 hover:border-takosan-green/60 shadow-xs flex items-center justify-center gap-3 active:scale-98 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="font-heading font-semibold text-sm text-slate-800">
                Đăng ký bằng Google
              </span>
            </button>

            {/* Apple — SEC-5: not yet supported server-side, route to auth */}
            <button
              onClick={() => navigate('/auth?mode=login')}
              className="w-full py-3.5 px-4 rounded-2xl bg-white border border-slate-200 hover:border-takosan-green/60 shadow-xs flex items-center justify-center gap-3 active:scale-98 transition-all"
            >
              <svg className="w-5 h-5 fill-current text-takosan-navy" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.07.63-2.73 1.4-.58.67-1.09 1.76-.95 2.81 1.04.08 2.11-.53 2.74-1.28z" />
              </svg>
              <span className="font-heading font-semibold text-sm text-slate-800">
                Đăng ký bằng Apple
              </span>
            </button>

            {/* Email */}
            <button
              onClick={() => navigate('/auth?mode=register')}
              className="w-full py-3.5 px-4 rounded-2xl bg-white border border-slate-200 hover:border-takosan-green/60 shadow-xs flex items-center justify-center gap-3 active:scale-98 transition-all"
            >
              <Mail className="w-5 h-5 text-slate-700" />
              <span className="font-heading font-semibold text-sm text-slate-800">
                Đăng ký bằng Email
              </span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center pt-8 space-y-3">
          {guestError && <p role="alert" className="text-sm text-rose-700">{guestError}</p>}
          <button
            onClick={async () => {
              setGuestError(null);
              try {
                await setGuestSession();
                setStep(4);
              } catch (error) {
                setGuestError(error instanceof Error ? error.message : 'Không thể khởi tạo phiên khách. Vui lòng thử lại.');
              }
            }}
            className="text-xs font-semibold text-takosan-green hover:underline"
          >
            Bỏ qua & Dùng thử ở chế độ Khách →
          </button>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
            Được áp dụng điều khoản dịch vụ và chính sách bảo mật của chúng tôi.
          </p>
        </div>
      </div>
    );
  }

  // 1.4 THÔNG TIN CƠ BẢN (FAMILY SIZE & CUISINE)
  if (step === 4) {
    return (
      <div className="min-h-screen bg-takosan-cream flex flex-col justify-between px-6 py-8 relative max-w-md mx-auto animate-fade-in">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setStep(3)}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-takosan-green uppercase tracking-wider">
              Bước 1 / 4
            </span>
          </div>

          <div className="space-y-1 mb-6">
            <h2 className="font-heading font-bold text-2xl text-takosan-navy">
              Một chút thông tin về gia đình bạn
            </h2>
            <p className="text-xs text-slate-500">Giúp Takosan căn chuẩn định lượng và khẩu vị</p>
          </div>

          {/* Section 1: Family size selector */}
          <div className="space-y-2 mb-6">
            <label className="text-xs font-heading font-bold text-slate-700 uppercase tracking-wider">
              Số người trong gia đình
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => {
                const label = num === 5 ? '5+' : `${num}`;
                const isSelected = householdSize === num;
                return (
                  <button
                    key={num}
                    onClick={() => setHouseholdSize(num)}
                    className={clsx(
                      'flex-1 py-3 rounded-2xl font-heading font-bold text-sm transition-all border shadow-xs active:scale-95 flex flex-col items-center gap-1',
                      isSelected
                        ? 'bg-takosan-green text-white border-takosan-green shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <Users className="w-4 h-4 opacity-75" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Favorite Cuisine Pills */}
          <div className="space-y-2.5">
            <label className="text-xs font-heading font-bold text-slate-700 uppercase tracking-wider">
              Gu ruột trong gia đình
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {CUISINE_TAGS.map((tag) => {
                const isSelected = selectedCuisines.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleCuisine(tag.id)}
                    className={clsx(
                      'px-4 py-2.5 rounded-full text-xs font-heading font-semibold transition-all border active:scale-95 flex items-center gap-1.5',
                      isSelected
                        ? 'bg-takosan-green text-white border-takosan-green shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <span>{tag.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Next CTA */}
        <div className="pt-6">
          <Button
            fullWidth
            size="lg"
            onClick={() => setStep(5)}
            className="bg-takosan-green hover:bg-[#26694C] text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md"
          >
            Tiếp tục
          </Button>
        </div>
      </div>
    );
  }

  // 1.5 SỞ THÍCH & HẠN CHẾ (DIETARY RESTRICTIONS)
  if (step === 5) {
    return (
      <div className="min-h-screen bg-takosan-cream flex flex-col justify-between px-6 py-8 relative max-w-md mx-auto animate-fade-in">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setStep(4)}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-takosan-green uppercase tracking-wider">
              Bước 2 / 4
            </span>
          </div>

          <div className="space-y-1 mb-6">
            <h2 className="font-heading font-bold text-2xl text-takosan-navy">
              Bạn có món nào không ăn không?
            </h2>
            <p className="text-xs text-slate-500">Bấm vào để chọn hoặc bỏ chọn</p>
          </div>

          {/* Restriction Tags Grid */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            {RESTRICTION_TAGS.map((tag) => {
              const isSelected = restrictions.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleRestriction(tag.id)}
                  className={clsx(
                    'px-4 py-2.5 rounded-2xl text-xs font-heading font-semibold transition-all border active:scale-95 flex items-center gap-1.5',
                    isSelected
                      ? 'bg-[#EF4444] text-white border-[#EF4444] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  )}
                >
                  <span>{tag.label}</span>
                  {isSelected && <span className="font-bold ml-1">✕</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Next CTA */}
        <div className="pt-6">
          <Button
            fullWidth
            size="lg"
            onClick={() => setStep(6)}
            className="bg-takosan-green hover:bg-[#26694C] text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md"
          >
            Tiếp tục
          </Button>
        </div>
      </div>
    );
  }

  // 1.6 TAKOSAN SẼ GIÚP BẠN THẾ NÀO? (GOAL SELECTION)
  if (step === 6) {
    return (
      <div className="min-h-screen bg-takosan-cream flex flex-col justify-between px-6 py-8 relative max-w-md mx-auto animate-fade-in">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setStep(5)}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-takosan-green uppercase tracking-wider">
              Bước 3 / 4
            </span>
          </div>

          <div className="space-y-1 mb-6">
            <h2 className="font-heading font-bold text-2xl text-takosan-navy">
              Takosan sẽ giúp bạn thế nào?
            </h2>
            <p className="text-xs text-slate-500">Chọn mục tiêu để Takosan tối ưu trải nghiệm</p>
          </div>

          {/* 3 Main Choice Cards */}
          <div className="space-y-3 pt-1">
            {[
              {
                id: 'today' as const,
                title: 'Hôm nay ăn gì?',
                icon: Utensils,
                desc: 'Gợi ý món tức thì dựa trên những gì tủ lạnh đang có sẵn.',
              },
              {
                id: 'week' as const,
                title: 'Lên thực đơn tuần',
                icon: Calendar,
                desc: 'Lập kế hoạch ăn uống, tạo danh sách đi chợ tiết kiệm và khoa học.',
              },
              {
                id: 'both' as const,
                title: 'Cả hai',
                recommended: true,
                icon: Sparkles,
                desc: 'Vừa chủ động lên kế hoạch tuần, vừa linh hoạt ứng biến bữa ăn mỗi ngày.',
              },
            ].map((card) => {
              const isSelected = primaryGoal === card.id;
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => setPrimaryGoal(card.id)}
                  className={clsx(
                    'w-full p-4 rounded-2xl border text-left transition-all shadow-xs relative active:scale-99',
                    isSelected
                      ? 'bg-white border-takosan-green ring-2 ring-takosan-green/30'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={clsx(
                        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                        isSelected
                          ? 'bg-takosan-mint text-takosan-green'
                          : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 pr-6">
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading font-bold text-base text-takosan-navy">
                          {card.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>

                    {card.recommended && (
                      <span className="absolute bottom-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-takosan-mint text-takosan-green border border-[#BFE3CC]">
                        Khuyên dùng
                      </span>
                    )}

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-takosan-green flex items-center justify-center text-white shrink-0 absolute top-4 right-4">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next CTA */}
        <div className="pt-6">
          <Button
            fullWidth
            size="lg"
            onClick={() => setStep(7)}
            className="bg-takosan-green hover:bg-[#26694C] text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md"
          >
            Tiếp tục
          </Button>
        </div>
      </div>
    );
  }

  // 1.7 HOÀN TẤT (CELEBRATION & MASCOT)
  return (
    <div className="min-h-screen bg-takosan-cream flex flex-col justify-between px-6 py-10 relative max-w-md mx-auto animate-fade-in">
      <div className="text-center pt-6 space-y-2">
        <h2 className="font-heading font-extrabold text-2xl text-takosan-navy tracking-tight flex items-center justify-center gap-2">
          <span>Tuyệt vời!</span>
          <span>Bạn đã sẵn sàng 🎉</span>
        </h2>
      </div>

      {/* Mascot Artwork */}
      <div className="my-auto py-6">
        <div className="w-56 h-56 mx-auto relative flex items-center justify-center">
          <img
            src={TAKOSAN_BRAND.mascot.celebrate}
            alt="Takosan ăn mừng"
            className="w-full h-full object-contain animate-bounce-slow"
          />
        </div>
      </div>

      {/* Message and Start Action */}
      <div className="space-y-6 pb-4 text-center">
        {guestError && <p role="alert" className="text-sm text-rose-700">{guestError}</p>}
        <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
          Takosan sẽ đồng hành cùng bạn trong hành trình ăn ngon, sống khỏe, tiết kiệm và không lãng phí.
        </p>

        <Button
          fullWidth
          size="lg"
          onClick={handleFinish}
          className="bg-takosan-green hover:bg-[#26694C] text-white font-heading font-bold text-base py-4 rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <span>Bắt đầu khám phá</span>
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
