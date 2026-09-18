// Google OAuth ID Token Verification Utility
// Verifies Google ID tokens via Google's official public tokeninfo endpoint.
// SEC-8: the token's `aud` claim MUST match our OAuth Client ID — without this
// check, an ID token minted for ANY other Google OAuth client would be accepted
// (cross-client token substitution).

export interface GoogleUserPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

export async function verifyGoogleToken(
  idToken: string,
  expectedAudience: string | undefined,
): Promise<{ valid: boolean; user?: GoogleUserPayload; error?: string }> {
  try {
    if (!idToken || typeof idToken !== 'string') {
      return { valid: false, error: 'Missing or invalid Google token' };
    }

    if (!expectedAudience) {
      return { valid: false, error: 'Google OAuth is not configured' };
    }

    // Query Google's tokeninfo API to cryptographically verify signature, audience and expiration
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { valid: false, error: (errBody as any)?.error_description || 'Invalid Google token signature' };
    }

    const data: any = await res.json();

    if (!data.email || !data.sub) {
      return { valid: false, error: 'Google token does not contain email or sub claim' };
    }

    // SEC-8: audience binding — token must have been issued FOR this app.
    if (data.aud !== expectedAudience) {
      return { valid: false, error: 'Google token was issued for a different application (aud mismatch)' };
    }

    // Ensure email is verified by Google
    if (data.email_verified === 'false' || data.email_verified === false) {
      return { valid: false, error: 'Google account email is not verified' };
    }

    return {
      valid: true,
      user: {
        sub: data.sub,
        email: data.email.toLowerCase(),
        name: data.name || data.email.split('@')[0],
        picture: data.picture,
        email_verified: true,
      },
    };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to verify Google token' };
  }
}
