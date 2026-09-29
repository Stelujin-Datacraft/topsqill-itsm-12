import type {
  ConnectorAuthConfig,
  ConnectorContext,
  ConnectorResult,
  IRestConnector,
  ReadOptions,
  RestConnectorConfig,
  WritePayload,
} from '../core/connectors/index';
import { assertSafeOutboundUrl } from '../core/security/index';

/** Generic REST connector — not vendor-specific. */
export class RestConnector implements IRestConnector {
  readonly kind = 'REST_API' as const;
  private authHeader: Record<string, string> = {};

  constructor(
    private readonly config: RestConnectorConfig,
    private readonly opts?: { allowPrivateNetwork?: boolean; fetchImpl?: typeof fetch },
  ) {}

  async connect(_ctx: ConnectorContext): Promise<void> {
    assertSafeOutboundUrl(this.config.baseUrl, {
      allowPrivateNetwork: this.opts?.allowPrivateNetwork,
    });
  }

  async authenticate(auth: ConnectorAuthConfig, _ctx: ConnectorContext): Promise<void> {
    this.authHeader = {};
    const extra = auth.extra || {};
    switch (auth.type) {
      case 'API_KEY':
        this.authHeader[String(extra.header || 'X-API-Key')] = String(extra.value || '');
        break;
      case 'BEARER_TOKEN':
        this.authHeader.Authorization = `Bearer ${extra.token || ''}`;
        break;
      case 'BASIC_AUTH': {
        const token = Buffer.from(`${extra.username || ''}:${extra.password || ''}`).toString('base64');
        this.authHeader.Authorization = `Basic ${token}`;
        break;
      }
      case 'OAUTH2':
        // Phase 1: caller supplies access token via extra.token; refresh lock later
        if (extra.token) this.authHeader.Authorization = `Bearer ${extra.token}`;
        break;
      default:
        break;
    }
  }

  async testConnection(ctx: ConnectorContext): Promise<ConnectorResult> {
    try {
      await this.connect(ctx);
      const res = await this.request('GET', '/', {}, ctx);
      return { ok: res.status !== undefined && res.status < 500, status: res.status, data: res.data, error: res.error };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async read(options: ReadOptions, ctx: ConnectorContext): Promise<ConnectorResult> {
    return this.request('GET', options.path || '/', {
      query: options.query,
      headers: options.headers,
    }, ctx);
  }

  async create(payload: WritePayload, ctx: ConnectorContext): Promise<ConnectorResult> {
    return this.request('POST', payload.path || '/', { body: payload.body, headers: payload.headers }, ctx);
  }

  async update(payload: WritePayload, ctx: ConnectorContext): Promise<ConnectorResult> {
    const path = payload.recordId
      ? `${payload.path || ''}/${payload.recordId}`.replace(/\/+/g, '/')
      : payload.path || '/';
    return this.request('PUT', path, { body: payload.body, headers: payload.headers }, ctx);
  }

  async delete(payload: WritePayload, ctx: ConnectorContext): Promise<ConnectorResult> {
    const path = payload.recordId
      ? `${payload.path || ''}/${payload.recordId}`.replace(/\/+/g, '/')
      : payload.path || '/';
    return this.request('DELETE', path, { headers: payload.headers }, ctx);
  }

  async disconnect(_ctx: ConnectorContext): Promise<void> {
    this.authHeader = {};
  }

  async request(
    method: string,
    path: string,
    options: {
      query?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
      body?: unknown;
    },
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const p = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    const url = new URL(p);
    assertSafeOutboundUrl(url.toString(), { allowPrivateNetwork: this.opts?.allowPrivateNetwork });
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) url.searchParams.set(k, String(v));
    }
    const fetchImpl = this.opts?.fetchImpl || fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || ctx.timeoutMs || 15000);
    try {
      const res = await fetchImpl(url.toString(), {
        method,
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': ctx.correlationId,
          ...this.config.defaultHeaders,
          ...this.authHeader,
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* keep text */
      }
      return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    } finally {
      clearTimeout(timeout);
    }
  }
}
