import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import { isInventoryTransferDeferred } from '../services/auth';
import { capturePrivateSession } from '../lib/private-session';
import { Button } from '../components/common/Button';
import { TurnstileWidget } from '../components/common/TurnstileWidget';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, KeyRound, Sparkles } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'otp_verify' | 'forgot_password';

function apiErrorMessage(error: any, fallback: string): string {
  return typeof error?.payload?.error === 'string' ? error.payload.error : fallback;
}

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const requestedProvider = searchParams.get('provider');
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
          navigate(res.user.onboardingCompleted ? '/' : '/onboarding', { replace: true });
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
          googleId.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: '100%',
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
        navigate(res.user.onboardingCompleted ? '/' : '/onboarding', { replace: true });
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
    document.head.appendChild(script);
    setGoogleStatus('loading');
    setGoogleRetry((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-takosan-cream px-6 py-8 flex flex-col justify-between text-takosan-navy animate-fade-in max-w-md mx-auto">
      <div>
        {/* Top bar back button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (mode === 'otp_verify' || mode === 'forgot_password') {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
                setDevOtp(null);
                setForgotOtpRequested(false);
                setTransferDeferred(false);
                setOtpDigits(['', '', '', '', '', '']);
              } else navigate('/landing');
            }}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 active:scale-95 text-slate-700 tap-target flex items-center justify-center transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="text-xs font-semibold text-slate-400">Tài khoản Takosan</span>
        </div>

        {/* Brand Header */}
        <div className="mt-6 text-center">
          <img src={TAKOSAN_BRAND.logos.horizontal} alt="Takosan" className="h-11 mx-auto mb-3 object-contain" />
          <h2 className="font-heading font-bold text-xl text-slate-900 tracking-tight">
            {mode === 'login' && 'Đăng nhập vào Takosan'}
            {mode === 'register' && 'Tạo tài khoản Takosan'}
            {mode === 'otp_verify' && 'Xác thực mã OTP'}
            {mode === 'forgot_password' && 'Quên mật khẩu'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            {mode === 'login' && 'Đồng bộ tủ lạnh, thực đơn tuần và gợi ý món ăn mọi lúc mọi nơi'}
            {mode === 'register' && 'Gia nhập Takosan để quản lý thực phẩm thông minh và giảm lãng phí'}
            {mode === 'otp_verify' && `Nhập 6 số mã OTP đã gửi tới ${email}`}
            {mode === 'forgot_password' && 'Nhập email để nhận mã OTP khôi phục mật khẩu'}
          </p>
        </div>

        {/* Mode Switcher (Login / Register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-slate-200/70 p-1 rounded-xl mt-6">
            <button
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg font-heading font-semibold text-xs transition-all tap-target ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg font-heading font-semibold text-xs transition-all tap-target ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>
        )}

        {/* Alert Banners */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-4 p-3 bg-takosan-mint border border-takosan-mint-deep text-takosan-green-deep rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-takosan-green" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Dev OTP Helper Badge */}
        {devOtp && (mode === 'otp_verify' || mode === 'forgot_password') && (
          <div
            onClick={() => {
              const digits = devOtp.split('');
              setOtpDigits(digits);
            }}
            className="mt-3 p-3 bg-takosan-mint border border-takosan-mint-deep/80 rounded-xl text-xs flex items-center justify-between cursor-pointer hover:bg-takosan-mint-hover/70 transition-all shadow-xs"
          >
            <div className="flex items-center gap-2 text-takosan-green-deep">
              <Sparkles className="w-4 h-4 text-takosan-green" />
              <div>
                <span className="font-medium">Mã OTP Thử nghiệm: </span>
                <span className="font-heading font-bold text-sm tracking-widest text-takosan-green-deep">{devOtp}</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-takosan-green bg-white px-2 py-0.5 rounded-md border border-takosan-mint-deep">
              Tự điền
            </span>
          </div>
        )}

        {/* ================= MODE 1: LOGIN ================= */}
        {mode === 'login' && (
          <div className="mt-5 space-y-4">
            {/* Google Sign In Area */}
            <div className="space-y-2">
              <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
              {googleStatus === 'loading' && (
                <p role="status" className="text-center text-xs text-slate-500">Đang kết nối Google…</p>
              )}
              {googleStatus === 'unavailable' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
                  <p>{googleClientId ? 'Không tải được Google Sign-In. Hãy kiểm tra chặn nội dung hoặc thử lại.' : 'Google Sign-In chưa được cấu hình. Bạn vẫn có thể đăng nhập bằng email.'}</p>
                  {googleClientId && (
                    <button type="button" onClick={retryGoogle} className="mt-1 font-semibold underline tap-target">
                      Tải lại Google Sign-In
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center my-2">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="px-3 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Hoặc qua Email</span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              {turnstileSiteKey && <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setDevOtp(null);
                      setForgotOtpRequested(false);
                      setOtpDigits(['', '', '', '', '', '']);
                    }}
                    className="text-xs font-semibold text-takosan-green hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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
        )}

        {/* ================= MODE 2: REGISTER ================= */}
        {mode === 'register' && (
          <div className="mt-5 space-y-4">
            <form onSubmit={handleRegister} className="space-y-3">
              {turnstileSiteKey && <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu (tối thiểu 6 ký tự)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 tap-target"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button fullWidth size="lg" type="submit" isLoading={isLoading} className="mt-2">
                Tạo tài khoản & Nhận mã OTP
              </Button>
            </form>
          </div>
        )}

        {/* ================= MODE 3: OTP VERIFICATION ================= */}
        {mode === 'otp_verify' && (
          <div className="mt-6 space-y-5">
            {turnstileSiteKey && <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* 6-box OTP input */}
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-13 text-center font-heading font-bold text-xl bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 transition-all text-slate-900 shadow-xs"
                  />
                ))}
              </div>

              {transferDeferred && otpPurpose === 'register' ? (
                <div
                  role="status"
                  data-testid="transfer-deferred"
                  className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-3 animate-in fade-in"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <p className="leading-relaxed">
                      Hiện Takosan chưa thể chuyển dữ liệu trong tủ khách sang tài khoản mới một cách an toàn.
                      Bạn vẫn có thể tiếp tục tạo tài khoản: dữ liệu của phiên khách được giữ riêng trên
                      hộ khách, không bị xóa và không được chuyển sang tài khoản mới.
                    </p>
                  </div>
                  <Button fullWidth size="lg" type="button" isLoading={isLoading} onClick={handleContinueWithoutTransfer}>
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
                  disabled={resendCountdown > 0 || isLoading}
                  onClick={handleResendOtp}
                  className="font-semibold text-takosan-green disabled:opacity-40 hover:underline flex items-center gap-1 tap-target cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{resendCountdown > 0 ? `Gửi lại sau (${resendCountdown}s)` : 'Gửi lại mã OTP'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= MODE 4: FORGOT PASSWORD ================= */}
        {mode === 'forgot_password' && (
          <div className="mt-5 space-y-4">
            {!forgotOtpRequested && (
              <form onSubmit={handleRequestForgotOtp} className="space-y-3">
                {turnstileSiteKey && <TurnstileWidget key={turnstileGeneration} siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email đăng ký tài khoản</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ban@example.com"
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
              <form onSubmit={handleResetPassword} className="space-y-3 animate-in fade-in">
                {/* 6-box OTP input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">Mã xác thực OTP (6 số)</label>
                  <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputsRef.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-11 h-13 text-center font-heading font-bold text-xl bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 transition-all text-slate-900 shadow-xs"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu mới (tối thiểu 6 ký tự)</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới"
                      className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
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
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 tap-target"
              >
                ← Quay lại màn hình đăng nhập
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Security Badge */}
      <div className="text-center pt-8">
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-takosan-green" />
          <span>Bảo mật dữ liệu thực phẩm & Tôn trọng quyền riêng tư</span>
        </div>
      </div>
    </div>
  );
};
