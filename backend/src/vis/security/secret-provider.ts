/**
 * Production SecretProvider architecture.
 * Select via VIS_SECRET_PROVIDER=local|vault (default local).
 */
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { isVisSupabasePersistenceEnabled } from '../store/vis-supabase-client';
import { SupabaseVisStore } from '../store/supabase-vis.store';

export interface SecretProvider {
  readonly kind: string;
  put(refId: string, plaintext: string): Promise<void>;
  get(refId: string): Promise<string | null>;
  delete(refId: string): Promise<void>;
  rotate(refId: string, plaintext: string): Promise<void>;
}

function masterKey(): Buffer {
  return createHash('sha256')
    .update(process.env.VIS_SECRET_MASTER_KEY || 'dev-only-not-for-prod')
    .digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(packed: string): string {
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Local AES-GCM store — memory + optional Supabase durability (`vis_secret_blobs`). */
export class LocalEncryptedSecretProvider implements SecretProvider {
  readonly kind = 'local-encrypted';
  private memory = new Map<string, string>();
  private durable: SupabaseVisStore | null = null;

  private durableStore(): SupabaseVisStore | null {
    if (!isVisSupabasePersistenceEnabled()) return null;
    if (!this.durable) this.durable = new SupabaseVisStore();
    return this.durable;
  }

  async put(refId: string, plaintext: string): Promise<void> {
    const ciphertext = encrypt(plaintext);
    this.memory.set(refId, ciphertext);
    const store = this.durableStore();
    if (store) await store.putSecret(refId, ciphertext, this.kind);
  }

  async get(refId: string): Promise<string | null> {
    let packed = this.memory.get(refId);
    if (!packed) {
      const store = this.durableStore();
      if (store) {
        const row = await store.getSecret(refId);
        packed = row?.ciphertext;
        if (packed) this.memory.set(refId, packed);
      }
    }
    if (!packed) return null;
    return decrypt(packed);
  }

  async delete(refId: string): Promise<void> {
    this.memory.delete(refId);
    const store = this.durableStore();
    if (store) await store.deleteSecret(refId);
  }

  async rotate(refId: string, plaintext: string): Promise<void> {
    const ciphertext = encrypt(plaintext);
    this.memory.set(refId, ciphertext);
    const store = this.durableStore();
    if (store) await store.rotateSecret(refId, ciphertext, this.kind);
  }
}

/**
 * HashiCorp Vault KV v2 HTTP client.
 * Requires VAULT_ADDR + VAULT_TOKEN (token from env or LocalEncryptedSecretProvider lookup).
 */
export class VaultSecretProvider implements SecretProvider {
  readonly kind = 'vault';
  constructor(
    private readonly opts: {
      addr?: string;
      token?: string;
      mount?: string;
      timeoutMs?: number;
    } = {},
  ) {}

  private get addr() {
    return this.opts.addr || process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
  }
  private get token() {
    return this.opts.token || process.env.VAULT_TOKEN || '';
  }
  private get mount() {
    return this.opts.mount || process.env.VAULT_KV_MOUNT || 'secret';
  }

  private async req(method: string, path: string, body?: unknown): Promise<any> {
    if (!this.token) throw Object.assign(new Error('Vault token unavailable'), { code: 'VAULT_UNAVAILABLE' });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs || 5000);
    try {
      const res = await fetch(`${this.addr}${path}`, {
        method,
        headers: {
          'X-Vault-Token': this.token,
          'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw Object.assign(new Error(`Vault HTTP ${res.status}`), { code: 'VAULT_ERROR', status: res.status });
      }
      if (res.status === 204) return {};
      return res.json();
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.code === 'ECONNREFUSED') {
        throw Object.assign(new Error('Vault provider unavailable'), { code: 'VAULT_UNAVAILABLE' });
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  async put(refId: string, plaintext: string): Promise<void> {
    await this.req('POST', `/v1/${this.mount}/data/${encodeURIComponent(refId)}`, {
      data: { value: plaintext },
    });
  }

  async get(refId: string): Promise<string | null> {
    const json = await this.req('GET', `/v1/${this.mount}/data/${encodeURIComponent(refId)}`);
    if (!json) return null;
    return json?.data?.data?.value ?? null;
  }

  async delete(refId: string): Promise<void> {
    await this.req('DELETE', `/v1/${this.mount}/data/${encodeURIComponent(refId)}`);
  }

  async rotate(refId: string, plaintext: string): Promise<void> {
    await this.put(refId, plaintext);
  }
}

/** In-memory Vault mock for tests (KV v2 shape). */
export class MockVaultServer {
  private store = new Map<string, string>();
  private available = true;

  setAvailable(v: boolean) {
    this.available = v;
  }

  handler = async (req: { method: string; path: string; body?: any; token?: string }) => {
    if (!this.available) throw Object.assign(new Error('Vault unavailable'), { code: 'VAULT_UNAVAILABLE' });
    if (req.token !== 'test-token') throw Object.assign(new Error('Vault HTTP 403'), { status: 403 });
    const m = req.path.match(/\/v1\/secret\/data\/(.+)$/);
    if (!m) return { status: 404 };
    const key = decodeURIComponent(m[1]);
    if (req.method === 'POST') {
      this.store.set(key, req.body?.data?.value);
      return { status: 200, json: {} };
    }
    if (req.method === 'GET') {
      if (!this.store.has(key)) return { status: 404 };
      return { status: 200, json: { data: { data: { value: this.store.get(key) } } } };
    }
    if (req.method === 'DELETE') {
      this.store.delete(key);
      return { status: 204 };
    }
    return { status: 405 };
  };

  /** Provider that talks to this mock without network. */
  asProvider(): SecretProvider {
    const server = this;
    return {
      kind: 'vault-mock',
      async put(refId, plaintext) {
        const r = await server.handler({ method: 'POST', path: `/v1/secret/data/${refId}`, body: { data: { value: plaintext } }, token: 'test-token' });
        if (r.status >= 400) throw Object.assign(new Error('Vault error'), { status: r.status });
      },
      async get(refId) {
        const r = await server.handler({ method: 'GET', path: `/v1/secret/data/${refId}`, token: 'test-token' });
        if (r.status === 404) return null;
        return r.json?.data?.data?.value ?? null;
      },
      async delete(refId) {
        await server.handler({ method: 'DELETE', path: `/v1/secret/data/${refId}`, token: 'test-token' });
      },
      async rotate(refId, plaintext) {
        await this.put(refId, plaintext);
      },
    };
  }
}

export function createSecretProviderFromEnv(): SecretProvider {
  const kind = (process.env.VIS_SECRET_PROVIDER || 'local').toLowerCase();
  if (kind === 'vault') return new VaultSecretProvider();
  return new LocalEncryptedSecretProvider();
}

// Re-export sanitizer/rbac from previous module path for compatibility
export {
  RbacService,
  AiContextSanitizer,
  LocalSsoProvider,
  type AuthPrincipal,
  type SsoProvider,
  EncryptedSecretProvider,
} from './enterprise-security';
