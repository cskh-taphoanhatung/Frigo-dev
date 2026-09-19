import { afterEach, expect, it, vi } from 'vitest';
import { sendEmail } from '../../src/worker/services/email';
import type { Env } from '../../src/worker/types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const params = { to: 'private@example.com', subject: 'private OTP', html: '<p>private message</p>' };

it('does not log native mail exception details or the recipient', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const env = { SEND_EMAIL: { send: async () => { throw new Error(`${params.to} ${params.subject}`); } } } as unknown as Env;
  expect((await sendEmail(env, params)).sent).toBe(false);
  expect(log).toHaveBeenCalledWith(JSON.stringify({ event: 'email_delivery_failed', provider: 'workers-email', category: 'provider_unavailable' }));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private@example.com|private OTP/);
});

it('does not retain provider response bodies in delivery diagnostics', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(`${params.to} private-provider-response`, { status: 422 })));
  expect(await sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).toEqual({ sent: false, provider: 'resend', error: 'provider_unavailable' });
});

it('does not retain network exception details in delivery diagnostics', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('test-only-secret private@example.com'); }));
  expect(await sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).toEqual({ sent: false, provider: 'resend', error: 'provider_unavailable' });
});

it('uses the structured Cloudflare Email Service payload', async () => {
  const send = vi.fn(async () => ({ messageId: 'message-123' }));
  await expect(sendEmail({ SEND_EMAIL: { send } } as unknown as Env, { ...params, text: 'private text' }))
    .resolves.toEqual({ sent: true, provider: 'workers-email', messageId: 'message-123' });
  expect(send).toHaveBeenCalledWith({
    to: params.to,
    from: { email: 'no-reply@tungjpstore.net', name: 'Takosan' },
    subject: params.subject,
    html: params.html,
    text: 'private text',
    headers: { 'X-Frigo-Kind': 'transactional' },
  });
});

it('maps Cloudflare onboarding errors without retaining provider text', async () => {
  const error = Object.assign(new Error(`${params.to} should stay private`), { code: 'E_SENDER_NOT_VERIFIED' });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = await sendEmail({ SEND_EMAIL: { send: async () => { throw error; } } } as unknown as Env, params);
  expect(result).toEqual({ sent: false, provider: 'workers-email', error: 'sender_not_verified' });
  expect(JSON.stringify(log.mock.calls)).not.toContain(params.to);
});

it('maps Cloudflare subdomain authorization failures without retaining provider text', async () => {
  const error = new Error("email sending not authorized for subdomain 'private.example.com'");
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = await sendEmail({ SEND_EMAIL: { send: async () => { throw error; } } } as unknown as Env, params);
  expect(result).toEqual({ sent: false, provider: 'workers-email', error: 'sender_not_verified' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('private.example.com');
});
