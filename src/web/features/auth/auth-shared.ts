export type AuthMode = 'login' | 'register' | 'otp_verify' | 'forgot_password';

export function apiErrorMessage(error: any, fallback: string): string {
  return typeof error?.payload?.error === 'string' ? error.payload.error : fallback;
}
