/**
 * OIDC SSO provider — configurable issuer / client / claims mapping.
 * Client secret resolved via SecretProvider (credentialReferenceId).
 * Includes a local test IdP for development (not for production).
 */
import { createHash, randomBytes, createHmac } from 'crypto';
import type { AuthPrincipal, SsoProvider } from './enterprise-security';
import type { PlatformRole } from '../enterprise/types';
import type { SecretProvider } from './secret-provider';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  /** SecretProvider reference — never plaintext in config dumps */
  clientSecretRef: string;
  redirectUri: string;
  scopes?: string[];
  claimsMapping?: {
    userId?: string;
    email?: string;
    tenantId?: string;
    organizationId?: string;
    roles?: string;
  };
  roleMapping?: Record<string, PlatformRole>;
}

export class OidcSsoProvider implements SsoProvider {
  readonly kind = 'OIDC' as const;
  private states = new Map<string, { returnUrl: string; nonce: string; createdAt: number }>();

  constructor(
    private readonly config: OidcConfig,
    private readonly secrets: SecretProvider,
    private readonly discovery?: {
      authorization_endpoint: string;
      token_endpoint: string;
      jwks_uri?: string;
    },
  ) {}

  async beginLogin(returnUrl: string) {
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(12).toString('hex');
    this.states.set(state, { returnUrl, nonce, createdAt: Date.now() });
    const scopes = (this.config.scopes || ['openid', 'profile', 'email']).join(' ');
    const auth =
      this.discovery?.authorization_endpoint
      || `${this.config.issuer.replace(/\/$/, '')}/authorize`;
    const redirectUrl =
      `${auth}?response_type=code`
      + `&client_id=${encodeURIComponent(this.config.clientId)}`
      + `&redirect_uri=${encodeURIComponent(this.config.redirectUri)}`
      + `&scope=${encodeURIComponent(scopes)}`
      + `&state=${state}`
      + `&nonce=${nonce}`;
    return { redirectUrl, state };
  }

  async handleCallback(params: Record<string, string>): Promise<AuthPrincipal> {
    const state = params.state;
    const code = params.code;
    if (!state || !code) throw Object.assign(new Error('Missing code/state'), { status: 400 });
    const st = this.states.get(state);
    if (!st) throw Object.assign(new Error('Invalid state'), { status: 400 });
    this.states.delete(state);

    const clientSecret = await this.secrets.get(this.config.clientSecretRef);
    if (!clientSecret) throw Object.assign(new Error('OIDC client secret unavailable'), { status: 500 });

    const tokenUrl =
      this.discovery?.token_endpoint
      || `${this.config.issuer.replace(/\/$/, '')}/token`;

    // Exchange authorization code — secrets never logged
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw Object.assign(new Error('OIDC token exchange failed'), { status: 401 });
    const json = (await res.json()) as any;
    const claims = decodeJwtPayload(json.id_token || json.access_token);
    return this.mapClaims(claims);
  }

  async logout(_principal: AuthPrincipal) {
    /* RP-initiated logout can be added via end_session_endpoint */
  }

  private mapClaims(claims: Record<string, unknown>): AuthPrincipal {
    const cm = this.config.claimsMapping || {};
    const userId = String(claims[cm.userId || 'sub'] || '');
    const email = claims[cm.email || 'email'] ? String(claims[cm.email || 'email']) : undefined;
    const tenantId = String(claims[cm.tenantId || 'tenant_id'] || 'tenant-default');
    const organizationId = String(claims[cm.organizationId || 'org_id'] || 'org-default');
    const rawRoles = claims[cm.roles || 'roles'];
    const roleList = Array.isArray(rawRoles) ? rawRoles.map(String) : typeof rawRoles === 'string' ? [rawRoles] : ['DEVELOPER'];
    const mapped: PlatformRole[] = roleList.map((r) => (this.config.roleMapping?.[r] || r) as PlatformRole);
    return { userId, email, tenantId, organizationId, roles: mapped.length ? mapped : ['DEVELOPER'] };
  }
}

/** Minimal local OIDC test IdP for development / CI. */
export class LocalTestIdp {
  readonly issuer: string;
  private codes = new Map<string, { sub: string; email?: string; roles: string[]; tenantId: string; orgId: string }>();
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(opts: { issuer: string; clientId: string; clientSecret: string }) {
    this.issuer = opts.issuer;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
  }

  discovery() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/authorize`,
      token_endpoint: `${this.issuer}/token`,
      jwks_uri: `${this.issuer}/jwks`,
    };
  }

  /** Issue an auth code as if the user logged in. */
  issueCode(user: { sub: string; email?: string; roles?: string[]; tenantId?: string; orgId?: string }) {
    const code = randomBytes(12).toString('hex');
    this.codes.set(code, {
      sub: user.sub,
      email: user.email,
      roles: user.roles || ['DEVELOPER'],
      tenantId: user.tenantId || 'tenant-default',
      orgId: user.orgId || 'org-default',
    });
    return code;
  }

  async token(params: URLSearchParams) {
    if (params.get('client_id') !== this.clientId || params.get('client_secret') !== this.clientSecret) {
      return { status: 401, body: { error: 'invalid_client' } };
    }
    const code = params.get('code') || '';
    const user = this.codes.get(code);
    if (!user) return { status: 400, body: { error: 'invalid_grant' } };
    this.codes.delete(code);
    const payload = {
      sub: user.sub,
      email: user.email,
      roles: user.roles,
      tenant_id: user.tenantId,
      org_id: user.orgId,
      iss: this.issuer,
      aud: this.clientId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const id_token = signTestJwt(payload, this.clientSecret);
    return { status: 200, body: { access_token: id_token, id_token, token_type: 'Bearer' } };
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

function signTestJwt(payload: object, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}
