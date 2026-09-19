import React from 'react';
import { Mail, User, Lock } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';
import { AuthField } from './AuthField';

interface RegisterModeProps {
  turnstileSiteKey: string | null;
  turnstileGeneration: number;
  onTurnstileToken: (token: string | null) => void;
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export const RegisterMode: React.FC<RegisterModeProps> = ({
  turnstileSiteKey,
  turnstileGeneration,
  onTurnstileToken,
  name,
  onNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  onSubmit,
  isLoading,
}) => (
  <div className="mt-5 space-y-4">
    <form onSubmit={onSubmit} className="space-y-3">
      {turnstileSiteKey && (
        <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
      )}
      <AuthField
        label="Họ và tên"
        icon={User}
        type="text"
        value={name}
        onChange={onNameChange}
        placeholder="Nguyễn Văn A"
      />
      <AuthField
        label="Email"
        icon={Mail}
        type="email"
        value={email}
        onChange={onEmailChange}
        placeholder="ban@example.com"
      />
      <AuthField
        label="Mật khẩu (tối thiểu 6 ký tự)"
        icon={Lock}
        type="password"
        value={password}
        onChange={onPasswordChange}
        placeholder="••••••••"
        autoComplete="new-password"
        reveal={{ show: showPassword, onToggle: onToggleShowPassword }}
      />

      <Button fullWidth size="lg" type="submit" isLoading={isLoading} className="mt-2">
        Tạo tài khoản & Nhận mã OTP
      </Button>
    </form>
  </div>
);
