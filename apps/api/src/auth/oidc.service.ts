import { Inject, Injectable } from '@nestjs/common';
import * as client from 'openid-client';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';

export interface AuthRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface VerifiedIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Google OIDC via openid-client 6: Authorization Code + PKCE S256 + state + nonce,
 * scopes `openid email profile` only. Tokens are discarded after verification.
 */
@Injectable()
export class OidcService {
  private configuration: Promise<client.Configuration> | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private discover(): Promise<client.Configuration> {
    if (!this.configuration) {
      const { issuer, clientId, clientSecret } = this.config.google;
      const insecure = this.config.appEnv === 'test' && issuer.startsWith('http://');
      this.configuration = client
        .discovery(new URL(issuer), clientId!, clientSecret!, undefined, insecure ? { execute: [client.allowInsecureRequests] } : undefined)
        .then((cfg) => {
          // Also verify the ID token JWS signature against the provider JWKS.
          client.enableNonRepudiationChecks(cfg);
          return cfg;
        })
        .catch((err) => {
          this.configuration = null; // allow a later retry when discovery failed (network)
          throw err;
        });
    }
    return this.configuration;
  }

  async createAuthRequest(): Promise<AuthRequest> {
    const cfg = await this.discover();
    const codeVerifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const url = client.buildAuthorizationUrl(cfg, {
      redirect_uri: this.config.google.redirectUri,
      scope: 'openid email profile',
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
      prompt: 'select_account',
    });
    return { url: url.href, state, nonce, codeVerifier };
  }

  /** Validates state, exchanges the code, and checks iss/aud/exp/nonce/signature. */
  async verifyCallback(callbackUrl: URL, pending: { state: string; nonce: string; codeVerifier: string }): Promise<VerifiedIdentity> {
    const cfg = await this.discover();
    const tokens = await client.authorizationCodeGrant(cfg, callbackUrl, {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new Error('ID token missing');
    return {
      sub: String(claims.sub),
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name : null,
    };
  }
}
