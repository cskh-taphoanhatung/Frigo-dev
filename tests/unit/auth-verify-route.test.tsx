// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '../../src/web/pages/AuthPage';
import {
  VERIFY_CONTEXT_KEY,
  readVerifyContext,
  resendSecondsRemaining,
  writeVerifyContext,
} from '../../src/web/features/auth/verify-context';

// T17 screen 03: `/auth/verify` is a real route over the existing OTP state
// machine. The real AuthPage, auth store and api layer run; only `fetch` is
// replaced. No test here fabricates a verified session.
const EMAIL = 'verify-route@example.test';
const OTP = '493817';
const ACCOUNT = { id: 'usr_verify', email: EMAIL, displayName: 'Verify Route', avatarUrl: '', householdId: 'hh_usr_verify' };

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLDivElement;
let calls: Array<{ path: string; body: Record<string, unknown> }>;
let registerResponse: { status: number; body: unknown };
let verifyResponses: Array<{ status: number; body: unknown }>;
let resendResponse: { status: number; body: unknown };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}

async function until(assertion: () => void) {
  const deadline = Date.now() + 1_500;
  for (;;) {
    await flush();
    try { assertion(); return; } catch (failure) { if (Date.now() >= deadline) throw failure; }
  }
}

async function mount(initialEntry: string) {
  root ??= createRoot(container);
  await act(async () => {
    root!.render(<MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LocationProbe />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/verify" element={<AuthPage />} />
        <Route path="/onboarding" element={<output data-testid="onboarding">onboarding</output>} />
        <Route path="/landing" element={<output data-testid="landing">landing</output>} />
      </Routes>
    </MemoryRouter>);
  });
  await flush();
}

function location() {
  return container.querySelector('[data-testid="location"]')!.textContent;
}

function buttons() {
  return [...container.querySelectorAll('button')];
}

function button(label: string | RegExp) {
  const found = buttons().find((item) => {
    const text = item.textContent?.trim() || item.getAttribute('aria-label') || '';
    return typeof label === 'string' ? text === label : label.test(text);
  });
  expect(found, `button ${label}`).toBeTruthy();
  return found!;
}

async function click(label: string | RegExp) {
  await act(async () => { button(label).click(); });
  await flush();
}

function setNative(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function otpBoxes() {
  return [...container.querySelectorAll<HTMLInputElement>('form input[inputmode="numeric"]')];
}

function otpValue() {
  return otpBoxes().map((box) => box.value).join('');
}

async function fillRegisterForm() {
  const inputs = [...container.querySelectorAll<HTMLInputElement>('form input')];
  const byPlaceholder = (placeholder: string) => inputs.find((input) => input.placeholder === placeholder)!;
  await act(async () => {
    setNative(byPlaceholder('Nguyễn Văn A'), 'Verify Route');
    setNative(byPlaceholder('ban@example.com'), EMAIL);
    setNative(byPlaceholder('••••••••'), 'strong-password-1');
  });
  await flush();
}

async function registerAndReachVerify() {
  await mount('/auth?mode=register');
  await fillRegisterForm();
  await click('Tạo tài khoản & Nhận mã OTP');
  await until(() => expect(location()).toBe('/auth/verify'));
  await until(() => expect(otpBoxes()).toHaveLength(6));
}

async function typeOtp(code = OTP) {
  for (const [index, digit] of code.split('').entries()) {
    await act(async () => { setNative(otpBoxes()[index], digit); });
  }
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear(); sessionStorage.clear();
  calls = []; verifyResponses = [];
  registerResponse = { status: 200, body: { success: true, message: 'Mã xác thực OTP đã được gửi đến email của bạn.', email: EMAIL } };
  resendResponse = { status: 200, body: { success: true, message: 'Đã gửi lại mã OTP mới.' } };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const path = new URL(String(input), 'https://takosan.example.test').pathname;
    if (path.endsWith('/config')) return response({ turnstileSiteKey: null, googleClientId: null });
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ path, body });
    if (path.endsWith('/auth/register')) return response(registerResponse.body, registerResponse.status);
    if (path.endsWith('/auth/verify-otp')) {
      const next = verifyResponses.shift();
      if (!next) throw new Error(`unexpected verify-otp call #${calls.length}`);
      return response(next.body, next.status);
    }
    if (path.endsWith('/auth/resend-otp')) return response(resendResponse.body, resendResponse.status);
    throw new Error(`unexpected fetch ${path}`);
  });
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  container.remove();
  vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
});

describe('screen 03 — /auth/verify route', () => {
  it('direct load without a verification in progress states so and offers real exits, never an OTP form', async () => {
    await mount('/auth/verify');
    expect(container.querySelector('[data-testid="verify-context-missing"]')).toBeTruthy();
    expect(container.textContent).toContain('Không có yêu cầu xác thực đang chờ');
    expect(otpBoxes()).toHaveLength(0);
    expect(container.querySelector('h1')?.textContent).toBe('Xác thực mã OTP');
    // No network request is made on behalf of an unknown user.
    expect(calls).toEqual([]);
    await click('Đăng nhập bằng tài khoản đã có');
    expect(location()).toBe('/auth');
    expect(container.textContent).toContain('Đăng nhập vào Takosan');
  });

  it('missing-context exit to registration opens the register mode', async () => {
    await mount('/auth/verify');
    await click('Tạo tài khoản mới');
    expect(location()).toBe('/auth');
    expect(container.textContent).toContain('Tạo tài khoản Takosan');
  });

  it('registration navigates to /auth/verify with the email, a 60s cooldown and a tab-scoped context that never holds the code', async () => {
    await registerAndReachVerify();
    expect(container.textContent).toContain(`Nhập 6 số mã OTP đã gửi tới ${EMAIL}`);
    expect(container.textContent).toMatch(/Gửi lại sau \(\d+s\)/);
    const context = readVerifyContext();
    expect(context).toMatchObject({ email: EMAIL, delivered: true });
    expect(resendSecondsRemaining(context)).toBeGreaterThan(55);
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).not.toContain(OTP);
    expect(localStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
  });

  it('refresh of /auth/verify restores the verification (email, cooldown) from the tab-scoped context and completes with the server', async () => {
    writeVerifyContext({ email: EMAIL, resendAvailableAt: Date.now() + 42_000, delivered: true });
    verifyResponses.push({ status: 200, body: { success: true, message: 'ok', user: ACCOUNT } });
    await mount('/auth/verify');
    expect(container.querySelector('[data-testid="verify-context-missing"]')).toBeNull();
    expect(container.textContent).toContain(`Nhập 6 số mã OTP đã gửi tới ${EMAIL}`);
    expect(container.textContent).toMatch(/Gửi lại sau \(4[0-2]s\)/);
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    await until(() => expect(container.textContent).toContain('Xác thực tài khoản thành công!'));
    expect(calls.at(-1)).toEqual({ path: '/api/v1/auth/verify-otp', body: { email: EMAIL, code: OTP, purpose: 'register' } });
    // Verification consumed: the context is gone so a later visit is honest.
    expect(readVerifyContext()).toBeNull();
    await until(() => expect(container.querySelector('[data-testid="onboarding"]')).toBeTruthy());
  });

  it('restored context whose email was never delivered shows the delivery problem and enables resend immediately', async () => {
    writeVerifyContext({ email: EMAIL, resendAvailableAt: 0, delivered: false });
    await mount('/auth/verify');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Email OTP chưa gửi được. Hãy bấm gửi lại mã.');
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
  });

  it('typing advances focus, backspace on an empty box moves back, and non-digits are rejected', async () => {
    await registerAndReachVerify();
    const boxes = otpBoxes();
    boxes[0].focus();
    await act(async () => { setNative(boxes[0], '4'); });
    expect(document.activeElement).toBe(boxes[1]);
    await act(async () => { setNative(boxes[1], 'x'); });
    expect(boxes[1].value).toBe('');
    expect(document.activeElement).toBe(boxes[1]);
    await act(async () => { setNative(boxes[1], '9'); });
    expect(document.activeElement).toBe(boxes[2]);
    await act(async () => {
      boxes[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });
    expect(document.activeElement).toBe(boxes[1]);
    expect(otpValue()).toBe('49');
    // Every digit box is labelled for screen readers and uses OTP autofill.
    for (const [index, box] of boxes.entries()) {
      expect(box.getAttribute('aria-label')).toBe(`Chữ số ${index + 1} của 6`);
      expect(box.getAttribute('autocomplete')).toBe('one-time-code');
      expect(box.getAttribute('inputmode')).toBe('numeric');
    }
    expect(container.querySelector('[role="group"][aria-labelledby]')).toBeTruthy();
  });

  it('pasting a full code fills all six boxes (digits only) and lands focus on the last box', async () => {
    await registerAndReachVerify();
    const group = container.querySelector<HTMLElement>('[role="group"]')!;
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => ' 49-38 17abc' } });
    await act(async () => { group.dispatchEvent(paste); });
    expect(otpValue()).toBe(OTP);
    expect(document.activeElement).toBe(otpBoxes()[5]);
  });

  it('submitting fewer than six digits is refused locally with an announced error and no request', async () => {
    await registerAndReachVerify();
    const requestsBefore = calls.length;
    await typeOtp('4');
    await click('Xác thực & Hoàn tất');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Vui lòng nhập đủ 6 chữ số mã OTP');
    expect(calls.length).toBe(requestsBefore);
  });

  it('a wrong or expired code shows the exact server error as an alert and keeps the user on /auth/verify', async () => {
    verifyResponses.push({ status: 400, body: { error: 'Mã OTP không chính xác hoặc đã được sử dụng' } });
    await registerAndReachVerify();
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    await until(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Mã OTP không chính xác'));
    expect(location()).toBe('/auth/verify');
    expect(localStorage.getItem('frigo_user_id')).toBeFalsy();
    expect(readVerifyContext()).toMatchObject({ email: EMAIL });
  });

  it('resend is locked during the cooldown, then re-requests with the same email and purpose and restarts the cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await registerAndReachVerify();
    expect(button(/Gửi lại sau/).disabled).toBe(true);
    // The countdown is a chain of 1s timers; advance second by second.
    for (let second = 0; second < 61; second++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    }
    const resend = button(/Gửi lại mã OTP/);
    expect(resend.disabled).toBe(false);
    await act(async () => { resend.click(); });
    await until(() => expect(container.textContent).toContain('Đã gửi lại mã OTP mới.'));
    expect(calls.at(-1)).toMatchObject({ path: '/api/v1/auth/resend-otp', body: { email: EMAIL, purpose: 'register' } });
    expect(container.textContent).toMatch(/Gửi lại sau \(\d+s\)/);
    expect(resendSecondsRemaining(readVerifyContext())).toBeGreaterThan(55);
  });

  it('OTP_DELIVERY_UNAVAILABLE on register still reaches /auth/verify honestly: error shown, no cooldown, context marked undelivered', async () => {
    registerResponse = { status: 503, body: { error: 'Email OTP chưa gửi được.', code: 'OTP_DELIVERY_UNAVAILABLE', accountCreated: true } };
    await registerAndReachVerify();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Tài khoản đã được lưu nhưng email OTP chưa gửi được');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
    expect(readVerifyContext()).toMatchObject({ email: EMAIL, delivered: false, resendAvailableAt: 0 });
  });

  it('a failed resend surfaces the server error and leaves resend available', async () => {
    resendResponse = { status: 429, body: { error: 'Vui lòng chờ trước khi gửi lại mã.' } };
    registerResponse = { status: 503, body: { error: 'Email OTP chưa gửi được.', code: 'OTP_DELIVERY_UNAVAILABLE', accountCreated: true } };
    await registerAndReachVerify();
    await click(/Gửi lại mã OTP/);
    await until(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Vui lòng chờ trước khi gửi lại mã.'));
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
  });

  it('back from /auth/verify returns to login and clears the tab-scoped context, so re-entering the route is honest', async () => {
    await registerAndReachVerify();
    await click('Quay lại');
    expect(location()).toBe('/auth');
    expect(container.textContent).toContain('Đăng nhập vào Takosan');
    expect(readVerifyContext()).toBeNull();
    await act(async () => { root?.unmount(); });
    root = undefined;
    await mount('/auth/verify');
    expect(container.querySelector('[data-testid="verify-context-missing"]')).toBeTruthy();
  });

  it('a corrupt stored context is treated as absent', () => {
    sessionStorage.setItem(VERIFY_CONTEXT_KEY, '{not json');
    expect(readVerifyContext()).toBeNull();
    sessionStorage.setItem(VERIFY_CONTEXT_KEY, JSON.stringify({ email: '' }));
    expect(readVerifyContext()).toBeNull();
  });
});
