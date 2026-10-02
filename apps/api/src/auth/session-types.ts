import 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** Present only after a successful login. */
    auth?: {
      userId: string;
      email: string;
      displayName: string;
      authenticatedAt: string;
      absoluteExpiresAt: string;
    };
    csrfToken?: string;
  }
}

export {};
