import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Button } from '../components/common/Button';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { ArrowRight, LogIn } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startGuest = async (path: string) => {
    setGuestError(null);
    setIsStarting(true);
    try {
      await setGuestSession();
      navigate(path);
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Không thể khởi tạo phiên khách. Vui lòng thử lại.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div
      data-testid="landing-page"
      className="min-h-screen bg-takosan-cream flex flex-col justify-between px-6 py-10 relative overflow-hidden"
    >
      {/* Brand Header */}
      <div className="relative z-10 text-center pt-4">
        <div className="flex justify-center mb-4">
          <img
            src={TAKOSAN_BRAND.logos.horizontal}
            alt="Takosan"
            className="h-14 w-auto object-contain"
            data-testid="landing-logo"
          />
        </div>
        {/* Single page heading (accessibility checklist). */}
        <h1 className="font-heading font-extrabold text-xl text-takosan-navy mb-1">{TAKOSAN_BRAND.tagline}</h1>
        <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
          Trợ lý bếp thân thiện: quản lý thực phẩm, giảm lãng phí và gợi ý món ngon chuẩn xác cùng AI.
        </p>
      </div>

      {/* Hero: mascot with fridge */}
      <div className="relative z-10 my-6">
        <div className="relative rounded-3xl overflow-hidden border border-takosan-cream-line bg-white p-6 text-center shadow-xs">
          <div className="absolute inset-x-0 top-0 h-28 bg-takosan-mint/60 rounded-b-[48px]" aria-hidden="true" />
          <div className="relative w-44 h-44 mx-auto mb-3 flex items-center justify-center">
            <img
              src={TAKOSAN_BRAND.mascot.fridge}
              alt="Takosan cầm tủ lạnh"
              className="w-full h-full object-contain"
              width={176}
              height={176}
            />
          </div>
          <h3 className="font-heading font-bold text-base text-takosan-navy">Nhận diện nguyên liệu tức thì</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Chỉ cần 1 bức ảnh chụp tủ lạnh, Takosan sẽ phân loại và tính toán món ăn tối ưu ngay cho bạn.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="relative z-10 space-y-3">
        {guestError && <p role="alert" className="text-sm text-rose-700">{guestError}</p>}
        <Button
          fullWidth
          size="lg"
          onClick={() => startGuest('/onboarding')}
          isLoading={isStarting}
          className="flex items-center justify-center gap-2 rounded-2xl text-base"
        >
          <span>Dùng thử Takosan ngay</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>

        <Button fullWidth size="md" variant="secondary" onClick={() => navigate('/auth')} disabled={isStarting} className="flex items-center justify-center gap-2 rounded-2xl">
          <LogIn className="h-4 w-4" />
          <span>Đăng nhập hoặc tạo tài khoản</span>
        </Button>
        <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-500">Dùng thử không cần tài khoản. Đăng nhập khi bạn muốn đồng bộ giữa các thiết bị.</p>
      </div>
    </div>
  );
};
