/**
 * Verification context for the `/auth/verify` route (screen 03). Tab-scoped
 * (sessionStorage) so a refresh or back/forward does not strand the user, and
 * intentionally minimal: the OTP code, dev OTP and any token are never stored.
 * The server remains the only authority on whether a code is valid.
 */
export const VERIFY_CONTEXT_KEY = 'frigo_auth_verify_context';

export interface VerifyContext {
  email: string;
  /** Epoch ms after which resend is allowed; 0 when resend is immediately allowed. */
  resendAvailableAt: number;
  /** Whether the server reported that the OTP email was actually delivered. */
  delivered: boolean;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readVerifyContext(): VerifyContext | null {
  const raw = storage()?.getItem(VERIFY_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VerifyContext>;
    if (typeof parsed.email !== 'string' || parsed.email.length === 0) return null;
    return {
      email: parsed.email,
      resendAvailableAt: typeof parsed.resendAvailableAt === 'number' ? parsed.resendAvailableAt : 0,
      delivered: parsed.delivered === true,
    };
  } catch {
    return null;
  }
}

export function writeVerifyContext(context: VerifyContext): void {
  storage()?.setItem(VERIFY_CONTEXT_KEY, JSON.stringify(context));
}

export function clearVerifyContext(): void {
  storage()?.removeItem(VERIFY_CONTEXT_KEY);
}

export function resendSecondsRemaining(context: VerifyContext | null, now = Date.now()): number {
  if (!context) return 0;
  return Math.max(0, Math.ceil((context.resendAvailableAt - now) / 1000));
}
