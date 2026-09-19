import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { TopBar } from '../components/common/TopBar';
import { Button } from '../components/common/Button';
import { VietQRModal } from '../components/payment/VietQRModal';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { Check, Sparkles, ArrowRight, LogIn, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

export const PlusPaywallPage: React.FC = () => {
  const navigate = useNavigate();
  const syncPlusFromServer = useAuthStore((s) => s.syncPlusFromServer);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isPlus = useAuthStore((s) => s.isPlus);

  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const plans = {
    annual: {
      id: 'annual' as const,
      name: 'Gói 1 Năm',
      price: 599000,
      monthlyPriceText: '~ 49.000đ / tháng',
      badge: 'Tiết kiệm 37%',
    },
    monthly: {
      id: 'monthly' as const,
      name: 'Gói 1 Tháng',
      price: 79000,
      monthlyPriceText: 'Thanh toán theo tháng',
      badge: null,
    },
  };

  const handlePaymentSuccess = () => {
    // Server already granted Plus (the modal only fires onSuccess on a verified
    // grant); reflect the authoritative state rather than self-activating.
    void syncPlusFromServer();
    setIsQRModalOpen(false);
    navigate('/me');
  };

  if (isGuest) {
    return (
      <div className="min-h-screen bg-semantic-background pb-12 max-w-md mx-auto">
        <TopBar showBack title="Takosan Plus" />
        <main className="px-4 pt-8">
          <section className="overflow-hidden rounded-feature border border-semantic-border bg-semantic-surface shadow-card">
            <div className="bg-gradient-to-br from-semantic-action-primary-pressed to-semantic-action-primary-hover px-6 py-7 text-white">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <ShieldCheck aria-hidden="true" className="h-6 w-6 text-amber-300" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">Tài khoản bắt buộc</p>
              <h1 className="mt-2 text-balance font-heading text-2xl font-bold leading-tight text-white">Đăng nhập trước khi chọn gói Plus</h1>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Gói Plus được gắn với tài khoản để quyền lợi không mất khi bạn đổi thiết bị. Dữ liệu phiên khách vẫn được giữ riêng khi bạn đăng nhập.
              </p>
            </div>
            <div className="space-y-3 p-5">
              <Link
                to="/auth?mode=login&returnTo=%2Fplus"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-takosan-green px-4 py-3 font-heading text-sm font-bold text-white shadow-xs transition hover:bg-takosan-green-deep active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-takosan-green focus-visible:ring-offset-2"
              >
                <LogIn aria-hidden="true" className="h-4 w-4" />
                Đăng nhập để tiếp tục
              </Link>
              <Link
                to="/"
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
              >
                Quay lại bảng điều khiển
              </Link>
              <p className="text-center text-xs leading-relaxed text-slate-500">
                Chưa có tài khoản? Bạn có thể đăng ký từ màn hình đăng nhập.
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-semantic-background pb-12 max-w-md mx-auto">
      <TopBar showBack title="Nâng cấp Takosan Plus" />

      <div className="px-4 pt-3 space-y-5">
        {/* Support Art Hero Card */}
        <div className="bg-gradient-to-br from-semantic-action-primary-pressed to-semantic-action-primary-hover text-white rounded-card p-5 shadow-card flex items-center justify-between gap-3 overflow-hidden border border-semantic-action-primary/40">
          <div className="space-y-1 max-w-[200px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                Takosan Plus
              </span>
            </div>
            <h2 className="font-heading font-bold text-xl leading-tight text-white">
              {isPlus ? 'Bạn là hội viên Plus' : 'Nấu ăn thông minh hơn'}
            </h2>
            <p className="text-xs text-slate-200">
              {isPlus
                ? 'Gói hội viên đang hoạt động với đầy đủ đặc quyền'
                : 'Mở khóa toàn bộ tính năng cao cấp cùng AI Chef'}
            </p>
          </div>

          <div className="w-24 h-24 shrink-0 overflow-hidden flex items-center justify-center">
            <img
              src={TAKOSAN_BRAND.mascot.celebrate}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Pricing Plan Selector */}
        <div className="grid grid-cols-2 gap-3">
          {(['annual', 'monthly'] as const).map((key) => {
            const p = plans[key];
            const isSelected = selectedPlan === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedPlan(key)}
                className={clsx(
                  'text-left rounded-xl p-4 relative shadow-xs cursor-pointer transition-tap active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-t17-focus',
                  isSelected
                    ? 'bg-semantic-surface border-semantic-action-primary ring-1 ring-semantic-action-primary'
                    : 'bg-white border border-slate-200/80 hover:border-slate-300'
                )}
              >
                {p.badge && (
                  <span className="absolute -top-2.5 right-3 bg-rose-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                    {p.badge}
                  </span>
                )}
                <p className="font-heading font-semibold text-xs text-slate-700">{p.name}</p>
                <p className="font-heading font-bold text-xl text-slate-900 mt-1">
                  {p.price.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.monthlyPriceText}</p>
              </button>
            );
          })}
        </div>

        {/* Feature Comparison List */}
        <div className="space-y-2 bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <h3 className="font-heading font-bold text-sm text-slate-900 mb-2">Quyền lợi thành viên:</h3>
          {[
            'Không giới hạn số lượng nguyên liệu trong tủ lạnh',
            'Không giới hạn lượt quét AI tủ lạnh & hóa đơn siêu thị OCR',
            'Trọn bộ Takosan Planner lập thực đơn tuần tự động',
            'AI Voice Sous Chef trợ lý nấu ăn rảnh tay thông minh',
            'Đầy đủ 6 nền ẩm thực (Việt, Hàn, Nhật, Trung, Thái, Ý)',
            'Gợi ý công thức nâng cao bởi DeepSeek AI Chef',
            'Chia sẻ tủ lạnh gia đình không giới hạn thiết bị',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium py-1">
              <div className="w-5 h-5 rounded-full bg-semantic-success-soft border border-semantic-action-primary/30 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-semantic-action-primary stroke-[2.5]" />
              </div>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <Button
            fullWidth
            size="lg"
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center justify-center gap-2"
          >
            <span>
              {isPlus ? 'Gia hạn hội viên' : `Nâng cấp ngay với ${plans[selectedPlan].price.toLocaleString('vi-VN')}đ`}
            </span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* VietQR Payment Modal */}
      <VietQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        planType={selectedPlan}
        amount={plans[selectedPlan].price}
      />
    </div>
  );
};
