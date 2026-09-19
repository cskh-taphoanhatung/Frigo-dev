import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import { isInventoryTransferDeferred } from '../services/auth';
import { capturePrivateSession } from '../lib/private-session';
import { Slide } from '../design-system/motion';
import { apiErrorMessage, type AuthMode } from '../features/auth/auth-shared';
import { AuthShell } from '../features/auth/AuthShell';
import { LoginMode } from '../features/auth/LoginMode';
import { RegisterMode } from '../features/auth/RegisterMode';
import { OtpMode } from '../features/auth/OtpMode';
import { ForgotPasswordMode } from '../features/auth/ForgotPasswordMode';

/**
 * Auth state machine (screen 02). Presentation lives in `features/auth/*`;
 * security semantics (Turnstile, GSI, DEC-012 guest transfer, private-session
 * capture) stay here, byte-compatible with the previous monolith.
 */
export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const requestedProvider = searchParams.get('provider');
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/';
  const { setAuthSession } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>(() => requestedMode === 'register' ? 'register' : 'login');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password new password
  const [newPassword, setNewPassword] = useState('');

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpPurpose, setOtpPurpose] = useState<'register' | 'forgot_password'>('register');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  // Production responses intentionally omit devOtp; this flag tracks that a
  // reset code was requested so the user can still enter it and set a password.
  const [forgotOtpRequested, setForgotOtpRequested] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  // DEC-012: guest data transfer was refused by the server; the guest session
  // stays intact until the user explicitly continues without a transfer.
  const [transferDeferred, setTransferDeferred] = useState(false);

  // SEC-6: Turnstile bot protection (inactive when server has no site key)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null | undefined>(undefined);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);
  const handleTurnstileToken = useCallback((token: string | null) => setTurnstileToken(token), []);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [googleRetry, setGoogleRetry] = useState(0);

  useEffect(() => {
    api
      .getPublicConfig()
      .then((cfg) => {
        setTurnstileSiteKey(cfg.turnstileSiteKey || null);
        setGoogleClientId(cfg.googleClientId || null);
      })
      .catch(() => {
        setTurnstileSiteKey(null);
        setGoogleClientId(null);
      });
  }, []);

  useEffect(() => {
    if (requestedMode === 'register') setMode('register');
  }, [requestedMode]);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize Google Identity Services after its async script is ready. The
  // browser button is the only production Google auth entry point: it always
  // supplies a signed credential to the server.
  useEffect(() => {
    if (mode !== 'login') {
      setGoogleStatus('idle');
      return;
    }
    if (googleClientId === undefined) {
      setGoogleStatus('loading');
      return;
    }
    if (!googleClientId) {
      setGoogleStatus('unavailable');
      return;
    }
    let active = true;
    let timer: number | undefined;
    let attempts = 0;
    const handleGoogleResponse = async (response: any) => {
      if (!active) return;
      if (typeof response?.credential !== 'string' || response.credential.length === 0) {
        setErrorMessage('Google không trả về thông tin xác thực hợp lệ. Hãy thử lại hoặc dùng email.');
        return;
      }
      const isCurrent = capturePrivateSession();
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await api.loginWithGoogle(response.credential);
        if (!active || !isCurrent()) return;
        if (res.success && res.user) {
          setAuthSession({
            id: res.user.id,
            email: res.user.email,
            displayName: res.user.displayName,
            avatarUrl: res.user.avatarUrl,
            householdId: res.user.householdId,
          });
          navigate(res.user.onboardingCompleted ? returnTo : '/onboarding', { replace: true });
        } else {
          setErrorMessage('Không thể xác thực tài khoản Google.');
        }
      } catch (err: any) {
        setErrorMessage(apiErrorMessage(err, 'Đăng nhập Google thất bại. Hãy thử lại hoặc dùng email.'));
      } finally {
        setIsLoading(false);
      }
    };

    const initializeGoogle = () => {
      if (!active) return;
      const googleId = window.google?.accounts?.id;
      if (!googleId) {
        attempts += 1;
        if (attempts < 40) {
          timer = window.setTimeout(initializeGoogle, 250);
          return;
        }
        setGoogleStatus('unavailable');
        return;
      }
      try {
        setGoogleStatus('ready');
        googleId.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        if (googleBtnRef.current && active) {
          googleBtnRef.current.replaceChildren();
          const measuredWidth = Math.floor(googleBtnRef.current.getBoundingClientRect().width);
          const buttonWidth = Math.min(400, Math.max(200, measuredWidth || 320));
          googleId.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: buttonWidth,
            text: 'continue_with',
            shape: 'pill',
            locale: 'vi',
          });
          if (requestedProvider === 'google') {
            googleBtnRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
      } catch (e) {
        console.warn('Google Sign-In init error:', e);
        setGoogleStatus('unavailable');
      }
    };

    setGoogleStatus('loading');
    initializeGoogle();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [mode, googleRetry, googleClientId, navigate, requestedProvider, setAuthSession]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    const isCurrent = capturePrivateSession();
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.login(email, password, turnstileToken);
      if (!isCurrent()) return;
      if (res.success && res.user) {
        setAuthSession({
          id: res.user.id,
          email: res.user.email,
          displayName: res.user.displayName,
          avatarUrl: res.user.avatarUrl,
          householdId: res.user.householdId,
        });
        navigate(res.user.onboardingCompleted ? returnTo : '/onboarding', { replace: true });
      }
    } catch (err: any) {
      if (err?.payload?.requireOtp === true) {
        setOtpPurpose('register');
        if (typeof err.payload.devOtp === 'string') setDevOtp(err.payload.devOtp);
        setTransferDeferred(false);
        setMode('otp_verify');
        if (err.payload.otpDelivered === true) {
          setResendCountdown(60);
          setSuccessMessage('Mã OTP mới đã được gửi đến email của bạn.');
        } else {
          setResendCountdown(0);
          setErrorMessage('Tài khoản chưa xác thực và email OTP chưa gửi được. Hãy bấm gửi lại mã.');
        }
      } else {
        setErrorMessage(apiErrorMessage(err, 'Email hoặc mật khẩu không chính xác'));
      }
    } finally {
      setTurnstileToken(null);
      setTurnstileGeneration((value) => value + 1);
      setIsLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Vui lòng điền đầy đủ họ tên, email và mật khẩu');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.register(name, email, password, turnstileToken);
      if (res.success) {
        if (res.devOtp) setDevOtp(res.devOtp);
        setOtpPurpose('register');
        setTransferDeferred(false);
        setMode('otp_verify');
        setResendCountdown(60);
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      if (err?.code === 'OTP_DELIVERY_UNAVAILABLE') {
        setOtpPurpose('register');
        setTransferDeferred(false);
        setMode('otp_verify');
        setResendCountdown(0);
        setSuccessMessage(null);
        setErrorMessage('Tài khoản đã được lưu nhưng email OTP chưa gửi được. Hãy bấm gửi lại mã.');
      } else {
        setErrorMessage(apiErrorMessage(err, 'Đăng ký thất bại. Email có thể đã tồn tại.'));
      }
    } finally {
      setTurnstileToken(null);
      setTurnstileGeneration((value) => value + 1);
      setIsLoading(false);
    }
  };

  // Handle OTP digit change
  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const newDigits = [...otpDigits];
    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);

    // Auto move focus to next input
    if (clean && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
    }
  };

  // Verify the entered OTP. `transferGuestData` asks the server to move the
  // current guest household into the new account; the server may refuse that
  // (DEC-012) without consuming the OTP, in which case the guest session is left
  // untouched and the user decides whether to continue without a transfer.
  const submitOtpVerification = async (transferGuestData: boolean) => {
    const isCurrent = capturePrivateSession();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số mã OTP');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Guest data migration: only pass the current household when the visitor
      // is actually in a guest session (server validates the hh_guest_ prefix).
      const authState = useAuthStore.getState();
      const guestHouseholdId =
        transferGuestData && otpPurpose === 'register' && authState.isGuest && authState.householdId.startsWith('hh_guest_')
          ? authState.householdId
          : null;
      const res = await api.verifyOtp(email, code, otpPurpose, guestHouseholdId);
      if (!isCurrent()) return;
      if (res.success) {
        setTransferDeferred(false);
        if (otpPurpose === 'register') {
          if (res.user) {
            setAuthSession({
              id: res.user.id,
              email: res.user.email,
              displayName: res.user.displayName,
              avatarUrl: res.user.avatarUrl,
              householdId: res.user.householdId,
            });
          }
          setSuccessMessage('Xác thực tài khoản thành công!');
          const isNewSession = capturePrivateSession();
          setTimeout(() => { if (isNewSession()) navigate('/onboarding', { replace: true }); }, 500);
        } else if (otpPurpose === 'forgot_password') {
          setSuccessMessage('Mã OTP chính xác. Hãy nhập mật khẩu mới.');
          // proceed to new password form
        }
      }
    } catch (err: any) {
      if (transferGuestData && isInventoryTransferDeferred(err)) {
        // Not an OTP failure: the code is still valid and nothing was changed.
        if (isCurrent()) setTransferDeferred(true);
        return;
      }
      setErrorMessage(apiErrorMessage(err, 'Mã OTP không đúng hoặc đã hết hạn'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP Submit
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitOtpVerification(true);
  };

  // Explicit user choice after a deferred transfer: keep the guest data where it
  // is and finish creating the separate account with the same OTP.
  const handleContinueWithoutTransfer = async () => {
    await submitOtpVerification(false);
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    if (turnstileSiteKey && !turnstileToken) {
      setErrorMessage('Vui lòng hoàn tất xác minh chống bot trước khi gửi lại mã.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.resendOtp(email, otpPurpose, turnstileToken);
      if (res.success) {
        if (res.devOtp) setDevOtp(res.devOtp);
        setResendCountdown(60);
        setTransferDeferred(false);
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(apiErrorMessage(err, 'Không thể gửi lại OTP'));
    } finally {
      setTurnstileToken(null);
      setTurnstileGeneration((value) => value + 1);
      setIsLoading(false);
    }
  };

  // Handle Request Forgot Password OTP
  const handleRequestForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Vui lòng nhập email của bạn');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setDevOtp(null);
    setForgotOtpRequested(false);
    setOtpDigits(['', '', '', '', '', '']);
    try {
      const res = await api.forgotPassword(email, turnstileToken);
      if (res.success) {
        if (res.devOtp) setDevOtp(res.devOtp);
        setForgotOtpRequested(true);
        setOtpPurpose('forgot_password');
        setResendCountdown(60);
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(apiErrorMessage(err, 'Không thể tạo yêu cầu đặt lại mật khẩu lúc này'));
    } finally {
      setTurnstileToken(null);
      setTurnstileGeneration((value) => value + 1);
      setIsLoading(false);
    }
  };

  // Handle Reset Password with OTP + New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    const isCurrent = capturePrivateSession();
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số mã OTP');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.resetPassword(email, code, newPassword);
      if (!isCurrent()) return;
      if (res.success) {
        if (res.user) {
          setAuthSession(res.user);
          navigate(res.user.onboardingCompleted ? '/' : '/onboarding', { replace: true });
          return;
        }
        setSuccessMessage('Đặt lại mật khẩu thành công! Hãy đăng nhập với mật khẩu mới.');
        setPassword(newPassword);
        setDevOtp(null);
        setForgotOtpRequested(false);
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          setMode('login');
          setSuccessMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(apiErrorMessage(err, 'Lỗi đặt lại mật khẩu'));
    } finally {
      setIsLoading(false);
    }
  };

  const retryGoogle = () => {
    if (!googleClientId) return;
    document.getElementById('google-identity-services')?.remove();
    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = () => setGoogleStatus('unavailable');
    document.head.appendChild(script);
    setGoogleStatus('loading');
    setGoogleRetry((value) => value + 1);
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const backOutOfVerification = () => {
    if (mode === 'otp_verify' || mode === 'forgot_password') {
      setMode('login');
      setErrorMessage(null);
      setSuccessMessage(null);
      setDevOtp(null);
      setForgotOtpRequested(false);
      setTransferDeferred(false);
      setOtpDigits(['', '', '', '', '', '']);
    } else {
      navigate('/landing');
    }
  };

  const startForgotPassword = () => {
    setMode('forgot_password');
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevOtp(null);
    setForgotOtpRequested(false);
    setOtpDigits(['', '', '', '', '', '']);
  };

  const backToLogin = () => {
    setMode('login');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  return (
    <AuthShell
      mode={mode}
      email={email}
      errorMessage={errorMessage}
      successMessage={successMessage}
      devOtp={devOtp}
      onFillDevOtp={() => setOtpDigits(devOtp ? devOtp.split('') : otpDigits)}
      onBack={backOutOfVerification}
      onModeChange={switchMode}
    >
      {/* Auth-state transition (screen 02): fade + horizontal slide on mode
          change; controlled values live above, so input is never cleared. */}
      <Slide key={mode} direction={mode === 'register' || mode === 'forgot_password' ? 1 : -1}>
        {mode === 'login' && (
          <LoginMode
            googleButtonRef={googleBtnRef}
            googleStatus={googleStatus}
            googleClientId={googleClientId ?? null}
            onRetryGoogle={retryGoogle}
            turnstileSiteKey={turnstileSiteKey}
            turnstileGeneration={turnstileGeneration}
            onTurnstileToken={handleTurnstileToken}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onSubmit={handleLogin}
            isLoading={isLoading}
            onForgotPassword={startForgotPassword}
          />
        )}
        {mode === 'register' && (
          <RegisterMode
            turnstileSiteKey={turnstileSiteKey}
            turnstileGeneration={turnstileGeneration}
            onTurnstileToken={handleTurnstileToken}
            name={name}
            onNameChange={setName}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onSubmit={handleRegister}
            isLoading={isLoading}
          />
        )}
        {mode === 'otp_verify' && (
          <OtpMode
            turnstileSiteKey={turnstileSiteKey}
            turnstileGeneration={turnstileGeneration}
            onTurnstileToken={handleTurnstileToken}
            otpDigits={otpDigits}
            otpInputsRef={otpInputsRef}
            onOtpChange={handleOtpChange}
            onOtpKeyDown={handleOtpKeyDown}
            onOtpPaste={handleOtpPaste}
            transferDeferred={transferDeferred}
            otpPurpose={otpPurpose}
            onContinueWithoutTransfer={() => void handleContinueWithoutTransfer()}
            onSubmitVerify={handleVerifyOtp}
            isLoading={isLoading}
            resendCountdown={resendCountdown}
            onResend={() => void handleResendOtp()}
            turnstileToken={turnstileToken}
          />
        )}
        {mode === 'forgot_password' && (
          <ForgotPasswordMode
            forgotOtpRequested={forgotOtpRequested}
            turnstileSiteKey={turnstileSiteKey}
            turnstileGeneration={turnstileGeneration}
            onTurnstileToken={handleTurnstileToken}
            email={email}
            onEmailChange={setEmail}
            onRequestOtp={handleRequestForgotOtp}
            otpDigits={otpDigits}
            otpInputsRef={otpInputsRef}
            onOtpChange={handleOtpChange}
            onOtpKeyDown={handleOtpKeyDown}
            onOtpPaste={handleOtpPaste}
            newPassword={newPassword}
            onNewPasswordChange={setNewPassword}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onResetPassword={handleResetPassword}
            isLoading={isLoading}
            onBackToLogin={backToLogin}
          />
        )}
      </Slide>
    </AuthShell>
  );
};
