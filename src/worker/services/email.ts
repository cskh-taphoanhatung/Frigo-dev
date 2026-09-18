/**
 * Email delivery service for Frigo Workers.
 *
 * Primary: Cloudflare Email Service (send_email binding, Paid plan) — no API
 *          key or third party. The sending domain must be onboarded before
 *          arbitrary recipients are accepted.
 * Fallback 1: Resend HTTP API (if RESEND_API_KEY secret is configured)
 * Fallback 2: Cloudflare MailChannels (free, no key — subject to CF policy)
 *
 * Provider details are deliberately reduced to stable categories. Never retain
 * recipients, subjects, message bodies, OTPs, or provider exception text.
 */

import { Env } from '../types';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
}

export interface EmailResult {
  sent: boolean;
  provider: 'workers-email' | 'resend' | 'none';
  messageId?: string;
  error?: 'sender_not_verified' | 'recipient_not_allowed' | 'rate_limited' | 'daily_limit' | 'provider_unavailable' | 'not_configured';
}

const FROM_NAME = 'Takosan';
// This apex domain is the sending domain currently onboarded in Cloudflare
// Email Service. A subdomain must be onboarded separately before it can send.
const FROM_EMAIL = 'no-reply@tungjpstore.net';

function classifyWorkersEmailError(error: unknown): EmailResult['error'] {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : '';
  if (code === 'E_SENDER_NOT_VERIFIED' || code === 'E_SENDER_DOMAIN_NOT_AVAILABLE') return 'sender_not_verified';
  if (message.includes('email sending not authorized for subdomain')) return 'sender_not_verified';
  if (code === 'E_RECIPIENT_NOT_ALLOWED') return 'recipient_not_allowed';
  if (code === 'E_RATE_LIMIT_EXCEEDED') return 'rate_limited';
  if (code === 'E_DAILY_LIMIT_EXCEEDED') return 'daily_limit';
  return 'provider_unavailable';
}

export async function sendEmail(
  env: Env,
  params: SendEmailParams
): Promise<EmailResult> {
  let workersFailure: EmailResult['error'];

  // Cloudflare Email Service structured API supports arbitrary recipients once
  // the sending domain has completed Email Service onboarding.
  if (env.SEND_EMAIL) {
    try {
      const result = await env.SEND_EMAIL.send({
        to: params.to,
        from: { email: FROM_EMAIL, name: params.fromName || FROM_NAME },
        subject: params.subject,
        html: params.html,
        text: params.text || params.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        headers: { 'X-Frigo-Kind': 'transactional' },
      });
      return { sent: true, provider: 'workers-email', messageId: result.messageId };
    } catch (error) {
      workersFailure = classifyWorkersEmailError(error);
      console.error(JSON.stringify({ event: 'email_delivery_failed', provider: 'workers-email', category: workersFailure }));
      // fall through to HTTP providers
    }
  }

  const from = `${params.fromName || FROM_NAME} <${FROM_EMAIL}>`;

  // 1. Resend (preferred — deliverability, bounce handling, logs)
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
        // Email send must not hang the request path
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({})) as { id?: string };
        return { sent: true, provider: 'resend', ...(body.id ? { messageId: body.id } : {}) };
      }
      const error = res.status === 429 ? 'rate_limited' : 'provider_unavailable';
      return { sent: false, provider: 'resend', error };
    } catch {
      return { sent: false, provider: 'resend', error: 'provider_unavailable' };
    }
  }

  // 2. MailChannels fallback removed: Cloudflare ended free MailChannels
  // support for Workers (returns HTTP 401 since 2024). Configure RESEND_API_KEY
  // as a Wrangler secret for a reliable HTTP fallback instead.
  return env.SEND_EMAIL
    ? { sent: false, provider: 'workers-email', error: workersFailure || 'provider_unavailable' }
    : { sent: false, provider: 'none', error: 'not_configured' };
}

/**
 * Build Frigo-styled OTP email. Purpose-specific copy in Vietnamese.
 */
export function buildOtpEmail(code: string, purpose: 'register' | 'forgot_password' | 'login'): { subject: string; html: string; text: string } {
  const action =
    purpose === 'register'
      ? 'xác thực tài khoản'
      : purpose === 'forgot_password'
        ? 'đặt lại mật khẩu'
        : 'đăng nhập';

  const subject = `Mã xác thực Takosan: ${code}`;

  const text = `Mã ${action} của bạn là: ${code}\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n— Takosan: Ăn đủ. Mua đủ. Dùng hết.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <tr><td style="background:#059669;padding:24px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">Takosan</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:18px;color:#0F172A;">Mã ${action}</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.5;">Nhập mã sau vào ứng dụng Frigo để tiếp tục. Mã có hiệu lực trong <strong>10 phút</strong>.</p>
          <div style="background:#E6F4EA;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#059669;font-family:'SF Mono',Menlo,monospace;">${code}</span>
          </div>
          <p style="margin:0 0 4px;font-size:13px;color:#475569;">Không chia sẻ mã này với bất kỳ ai — nhân viên Frigo không bao giờ hỏi mã của bạn.</p>
          <p style="margin:0;font-size:13px;color:#94A3B8;">Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>
        </td></tr>
        <tr><td style="background:#F8FAF9;padding:16px 32px;text-align:center;">
          <span style="font-size:12px;color:#94A3B8;">Takosan — Ăn đủ. Mua đủ. Dùng hết.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
