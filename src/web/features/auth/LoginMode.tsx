import React, { useId, type RefObject } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';
import { AuthField } from './AuthField';
import { GoogleAuthSection } from './GoogleAuthSection';

interface LoginModeProps {
  googleButtonRef: RefObject<HTMLDivElement>;
  googleStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  googleClientId: string | null;
  onRetryGoogle: () => void;
  turnstileSiteKey: string | null;
  turnstileGeneration: number;
  onTurnstileToken: (token: string | null) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onForgotPassword: () => void;
}

export const LoginMode: React.FC<LoginModeProps> = ({
  googleButtonRef,
  googleStatus,
  googleClientId,
  onRetryGoogle,
  turnstileSiteKey,
  turnstileGeneration,
  onTurnstileToken,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  onSubmit,
  isLoading,
  onForgotPassword,
}) => {
  const passwordId = useId();
  return (
  <div className="mt-5 space-y-4">
    <GoogleAuthSection
      buttonRef={googleButtonRef}
      status={googleStatus}
      clientId={googleClientId}
      onRetry={onRetryGoogle}
    />

    <div className="flex items-center my-2">
      <div className="flex-1 border-t border-slate-200"></div>
      <span className="px-3 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Hoặc qua Email</span>
      <div className="flex-1 border-t border-slate-200"></div>
    </div>

    <form onSubmit={onSubmit} className="space-y-3">
      {turnstileSiteKey && (
        <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
      )}

      <AuthField
        label="Email"
        icon={Mail}
        type="email"
        value={email}
        onChange={onEmailChange}
        placeholder="ban@example.com"
      />

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={passwordId} className="block text-xs font-semibold text-slate-700">Mật khẩu</label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs font-semibold text-takosan-green hover:underline"
          >
            Quên mật khẩu?
          </button>
        </div>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
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
        Đăng nhập
      </Button>
    </form>
  </div>
  );
};
