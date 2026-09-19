import React, { useId } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';

interface OtpModeProps {
  turnstileSiteKey: string | null;
  turnstileGeneration: number;
  onTurnstileToken: (token: string | null) => void;
  otpDigits: string[];
  otpInputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onOtpChange: (index: number, value: string) => void;
  onOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOtpPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  transferDeferred: boolean;
  otpPurpose: 'register' | 'forgot_password';
  onContinueWithoutTransfer: () => void;
  onSubmitVerify: (e: React.FormEvent) => void;
  isLoading: boolean;
  resendCountdown: number;
  onResend: () => void;
  turnstileToken: string | null;
}

/** Six-digit verification (screen 03): paste support, no disruptive shaking,
 *  honest transfer-deferred continuation (DEC-012). */
export const OtpMode: React.FC<OtpModeProps> = ({
  turnstileSiteKey,
  turnstileGeneration,
  onTurnstileToken,
  otpDigits,
  otpInputsRef,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  transferDeferred,
  otpPurpose,
  onContinueWithoutTransfer,
  onSubmitVerify,
  isLoading,
  resendCountdown,
  onResend,
  turnstileToken,
}) => {
  const otpGroupId = useId();
  return (
  <div className="mt-6 space-y-5">
    {turnstileSiteKey && (
      <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
    )}
    <form onSubmit={onSubmitVerify} className="space-y-4">
      <p id={otpGroupId} className="sr-only">Mã OTP 6 chữ số</p>
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

      {transferDeferred && otpPurpose === 'register' ? (
        <div
          role="status"
          data-testid="transfer-deferred"
          className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-3 animate-fade-in"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="leading-relaxed">
              Hiện Takosan chưa thể chuyển dữ liệu trong tủ khách sang tài khoản mới một cách an toàn.
              Bạn vẫn có thể tiếp tục tạo tài khoản: dữ liệu của phiên khách được giữ riêng trên
              hộ khách, không bị xóa và không được chuyển sang tài khoản mới.
            </p>
          </div>
          <Button fullWidth size="lg" type="button" isLoading={isLoading} onClick={onContinueWithoutTransfer}>
            Tiếp tục không chuyển dữ liệu khách
          </Button>
        </div>
      ) : (
        <Button fullWidth size="lg" type="submit" isLoading={isLoading}>
          Xác thực & Hoàn tất
        </Button>
      )}

      <div className="flex items-center justify-between text-xs pt-2">
        <span className="text-slate-500">Chưa nhận được mã?</span>
        <button
          type="button"
          disabled={resendCountdown > 0 || isLoading || Boolean(turnstileSiteKey && !turnstileToken)}
          onClick={onResend}
          className="font-semibold text-takosan-green disabled:opacity-40 hover:underline flex items-center gap-1 tap-target cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>
            {resendCountdown > 0
              ? `Gửi lại sau (${resendCountdown}s)`
              : turnstileSiteKey && !turnstileToken
                ? 'Đang xác minh…'
                : 'Gửi lại mã OTP'}
          </span>
        </button>
      </div>
    </form>
  </div>
  );
};
