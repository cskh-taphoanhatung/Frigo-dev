import React, { useId } from 'react';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';

interface ForgotPasswordModeProps {
  forgotOtpRequested: boolean;
  turnstileSiteKey: string | null;
  turnstileGeneration: number;
  onTurnstileToken: (token: string | null) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onRequestOtp: (e: React.FormEvent) => void;
  otpDigits: string[];
  otpInputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onOtpChange: (index: number, value: string) => void;
  onOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOtpPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onResetPassword: (e: React.FormEvent) => void;
  isLoading: boolean;
  onBackToLogin: () => void;
}

export const ForgotPasswordMode: React.FC<ForgotPasswordModeProps> = ({
  forgotOtpRequested,
  turnstileSiteKey,
  turnstileGeneration,
  onTurnstileToken,
  email,
  onEmailChange,
  onRequestOtp,
  otpDigits,
  otpInputsRef,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  newPassword,
  onNewPasswordChange,
  showPassword,
  onToggleShowPassword,
  onResetPassword,
  isLoading,
  onBackToLogin,
}) => {
  const emailId = useId();
  const newPasswordId = useId();
  const otpGroupId = useId();
  return (
  <div className="mt-5 space-y-4">
    {!forgotOtpRequested && (
      <form onSubmit={onRequestOtp} className="space-y-3">
        {turnstileSiteKey && (
          <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
        )}
        <div>
          <label htmlFor={emailId} className="block text-xs font-semibold text-slate-700 mb-1">Email đăng ký tài khoản</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
            <input
              id={emailId}
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="ban@example.com"
              autoComplete="email"
              className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
            />
          </div>
        </div>

        <Button fullWidth size="lg" type="submit" isLoading={isLoading}>
          Gửi mã OTP khôi phục
        </Button>
      </form>
    )}

    {forgotOtpRequested && (
      <form onSubmit={onResetPassword} className="space-y-3 animate-fade-in">
        <div>
          <p id={otpGroupId} className="block text-xs font-semibold text-slate-700 mb-2 text-center">Mã xác thực OTP (6 số)</p>
          <div className="flex justify-center gap-2" role="group" aria-labelledby={otpGroupId} onPaste={onOtpPaste}>
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (otpInputsRef.current[idx] = el)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={`Chữ số ${idx + 1} của 6`}
                maxLength={1}
                value={digit}
                onChange={(e) => onOtpChange(idx, e.target.value)}
                onKeyDown={(e) => onOtpKeyDown(idx, e)}
                className="w-11 h-13 text-center font-heading font-bold text-xl bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 transition-tap text-slate-900 shadow-xs"
              />
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={newPasswordId} className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu mới (tối thiểu 6 ký tự)</label>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
            <input
              id={newPasswordId}
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="Nhập mật khẩu mới"
              autoComplete="new-password"
              className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
            />
            <button
              type="button"
              onClick={onToggleShowPassword}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 tap-target"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button fullWidth size="lg" type="submit" isLoading={isLoading} className="mt-2">
          Lưu mật khẩu mới & Đăng nhập
        </Button>
      </form>
    )}

    <div className="text-center pt-2">
      <button
        type="button"
        onClick={onBackToLogin}
        className="text-xs font-semibold text-slate-500 hover:text-slate-900 tap-target"
      >
        ← Quay lại màn hình đăng nhập
      </button>
    </div>
  </div>
  );
};
