import 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** Present only after a successful Google login (PRD §11.1 step 7). */
    auth?: {
      userId: string;
      email: string;
      displayName: string;
      authenticatedAt: string;
      absoluteExpiresAt: string;
    };
    csrfToken?: string;
    /** Pre-auth state for one OIDC round trip; single use, 10 minutes. */
    oidc?: {
      state: string;
      nonce: string;
      codeVerifier: string;
      expiresAt: string;
    };
  }
}

export {};
