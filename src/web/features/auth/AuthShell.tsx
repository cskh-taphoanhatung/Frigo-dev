import React from 'react';
import { ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { TAKOSAN_BRAND } from '../../lib/takosan-brand';
import type { AuthMode } from './auth-shared';

interface AuthShellProps {
  mode: AuthMode;
  email: string;
  errorMessage: string | null;
  successMessage: string | null;
  devOtp: string | null;
  onFillDevOtp: () => void;
  onBack: () => void;
  onModeChange: (mode: 'login' | 'register') => void;
  children: React.ReactNode;
}

const HEADING: Record<AuthMode, string> = {
  login: 'Đăng nhập vào Takosan',
  register: 'Tạo tài khoản Takosan',
  otp_verify: 'Xác thực mã OTP',
  forgot_password: 'Quên mật khẩu',
};

/** Brand chrome + mode selection shared by every auth state (screen 02). */
export const AuthShell: React.FC<AuthShellProps> = ({
  mode,
  email,
  errorMessage,
  successMessage,
  devOtp,
  onFillDevOtp,
  onBack,
  onModeChange,
  children,
}) => (
  <div className="min-h-screen bg-takosan-cream px-6 py-8 flex flex-col justify-between text-takosan-navy animate-fade-in max-w-md mx-auto">
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl hover:bg-semantic-border/60 active:scale-95 text-semantic-text-secondary tap-target flex items-center justify-center transition-colors"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold text-semantic-text-muted">Tài khoản Takosan</span>
      </div>

      <div className="mt-6 text-center">
        <img src={TAKOSAN_BRAND.logos.horizontal} alt="Takosan" className="h-11 mx-auto mb-3 object-contain" />
        {/* Single page heading (accessibility checklist: sequential levels). */}
        <h1 className="font-heading font-bold text-xl text-semantic-text-primary tracking-tight">{HEADING[mode]}</h1>
        <p className="text-xs text-semantic-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
          {mode === 'login' && 'Đồng bộ tủ lạnh, thực đơn tuần và gợi ý món ăn mọi lúc mọi nơi'}
          {mode === 'register' && 'Gia nhập Takosan để quản lý thực phẩm thông minh và giảm lãng phí'}
          {mode === 'otp_verify' && `Nhập 6 số mã OTP đã gửi tới ${email}`}
          {mode === 'forgot_password' && 'Nhập email để nhận mã OTP khôi phục mật khẩu'}
        </p>
      </div>

      {(mode === 'login' || mode === 'register') && (
        <div className="flex bg-semantic-border/70 p-1 rounded-xl mt-6">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onModeChange(m)}
              className={`flex-1 py-2 rounded-lg font-heading font-semibold text-xs transition-tap tap-target ${
                mode === m ? 'bg-white text-semantic-text-primary shadow-xs' : 'text-semantic-text-secondary hover:text-semantic-text-primary'
              }`}
            >
              {m === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
            </button>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-3 bg-semantic-danger-soft border border-semantic-danger/30 text-semantic-danger-strong rounded-xl text-xs flex items-center gap-2 animate-fade-in" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 text-semantic-danger" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="mt-4 p-3 bg-takosan-mint border border-takosan-mint-deep text-takosan-green-deep rounded-xl text-xs flex items-center gap-2 animate-fade-in" role="status">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-takosan-green" />
          <span>{successMessage}</span>
        </div>
      )}

      {devOtp && (mode === 'otp_verify' || mode === 'forgot_password') && (
        <button
          type="button"
          onClick={onFillDevOtp}
          className="mt-3 w-full text-left p-3 bg-takosan-mint border border-takosan-mint-deep/80 rounded-xl text-xs flex items-center justify-between cursor-pointer hover:bg-takosan-mint-hover/70 transition-tap shadow-xs tap-target"
        >
          <div className="flex items-center gap-2 text-takosan-green-deep">
            <Sparkles className="w-4 h-4 text-takosan-green" aria-hidden="true" />
            <div>
              <span className="font-medium">Mã OTP Thử nghiệm: </span>
              <span className="font-heading font-bold text-sm tracking-widest text-takosan-green-deep">{devOtp}</span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-takosan-green bg-white px-2 py-0.5 rounded-md border border-takosan-mint-deep">
            Tự điền
          </span>
        </button>
      )}

      {children}
    </div>

    <div className="text-center pt-8">
      <div className="flex items-center justify-center gap-1.5 text-xs text-semantic-text-muted">
        <ShieldCheck className="w-4 h-4 text-takosan-green" aria-hidden="true" />
        <span>Bảo mật dữ liệu thực phẩm & Tôn trọng quyền riêng tư</span>
      </div>
    </div>
  </div>
);
