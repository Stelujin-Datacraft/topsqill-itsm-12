/**
 * PostgreSQL-backed mock enterprise application for ENV-DEV and ENV-UAT.
 * Real REST APIs over pg — not in-memory arrays.
 */
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'crypto';

export type MockEnvName = 'ENV-DEV' | 'ENV-UAT';

const DDL = `
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id TEXT PRIMARY KEY,
  vulnerability_id TEXT UNIQUE,
  priority TEXT,
  description TEXT,
  status TEXT DEFAULT 'Open',
  external_id TEXT,
  risk_level TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vuln_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vuln_updated ON vulnerabilities(updated_at);
CREATE TABLE IF NOT EXISTS oauth_tokens (
  client_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL
);
`;

export interface MockAppOptions {
  databaseUrl: string;
  envName: MockEnvName;
  /** Failure injection */
  failMode?: 'none' | '429' | '500' | '503' | 'timeout';
  retryAfterSec?: number;
}

export class PgMockEnterpriseApp {
  readonly envName: MockEnvName;
  private pool: Pool;
  failMode: MockAppOptions['failMode'] = 'none';
  retryAfterSec = 1;
  private refreshCount = 0;

  constructor(opts: MockAppOptions) {
    this.envName = opts.envName;
    this.pool = new Pool({ connectionString: opts.databaseUrl });
    this.failMode = opts.failMode || 'none';
    this.retryAfterSec = opts.retryAfterSec || 1;
  }

  async init() {
    await this.pool.query(DDL);
  }

  async close() {
    await this.pool.end();
  }

  setFailMode(mode: MockAppOptions['failMode'], retryAfterSec?: number) {
    this.failMode = mode;
    if (retryAfterSec != null) this.retryAfterSec = retryAfterSec;
  }

  getRefreshCount() {
    return this.refreshCount;
  }

  resetRefreshCount() {
    this.refreshCount = 0;
  }

  private async maybeFail(): Promise<{ status: number; body: any; headers?: Record<string, string> } | null> {
    if (this.failMode === 'none') return null;
    if (this.failMode === 'timeout') {
      await new Promise((r) => setTimeout(r, 50));
      return { status: 504, body: { error: 'timeout' } };
    }
    if (this.failMode === '429') {
      return {
        status: 429,
        body: { error: 'rate_limited' },
        headers: { 'Retry-After': String(this.retryAfterSec) },
      };
    }
    if (this.failMode === '500') return { status: 500, body: { error: 'internal' } };
    if (this.failMode === '503') return { status: 503, body: { error: 'unavailable' } };
    return null;
  }

  async list(query: { status?: string; limit?: number; offset?: number; q?: string }) {
    const fail = await this.maybeFail();
    if (fail) return fail;
    const limit = Math.min(Number(query.limit || 50), 200);
    const offset = Number(query.offset || 0);
    const params: any[] = [];
    const where: string[] = [];
    if (query.status) {
      params.push(query.status);
      where.push(`status = $${params.length}`);
    }
    if (query.q) {
      params.push(`%${query.q}%`);
      where.push(`(description ILIKE $${params.length} OR vulnerability_id ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit, offset);
    const res = await this.pool.query(
      `SELECT * FROM vulnerabilities ${whereSql} ORDER BY created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const count = await this.pool.query(`SELECT COUNT(*)::int AS c FROM vulnerabilities ${whereSql}`, params.slice(0, -2));
    return {
      status: 200,
      body: {
        items: res.rows.map(mapRow),
        total: count.rows[0].c,
        limit,
        offset,
        env: this.envName,
      },
    };
  }

  async get(id: string) {
    const fail = await this.maybeFail();
    if (fail) return fail;
    const res = await this.pool.query(
      `SELECT * FROM vulnerabilities WHERE id = $1 OR vulnerability_id = $1 OR external_id = $1 LIMIT 1`,
      [id],
    );
    if (!res.rows[0]) return { status: 404, body: { error: 'not_found' } };
    return { status: 200, body: mapRow(res.rows[0]) };
  }

  async create(body: Record<string, unknown>) {
    const fail = await this.maybeFail();
    if (fail) return fail;
    const id = String(body.id || randomUUID());
    const vulnerabilityId = String(body.vulnerability_id || body.id || id);
    try {
      await this.pool.query(
        `INSERT INTO vulnerabilities (id, vulnerability_id, priority, description, status, external_id, risk_level, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          vulnerabilityId,
          body.priority ?? null,
          body.description ?? null,
          body.status || 'Open',
          body.external_id ?? vulnerabilityId,
          body.risk_level ?? body.riskLevel ?? null,
          JSON.stringify(body),
        ],
      );
    } catch (e: any) {
      if (String(e?.code) === '23505') return { status: 409, body: { error: 'duplicate' } };
      throw e;
    }
    return this.get(id);
  }

  async patch(id: string, body: Record<string, unknown>) {
    const fail = await this.maybeFail();
    if (fail) return fail;
    const existing = await this.get(id);
    if (existing.status !== 200) return existing;
    const cur = existing.body;
    const next = { ...cur, ...body, updated_at: new Date().toISOString() };
    await this.pool.query(
      `UPDATE vulnerabilities SET
        priority = $2, description = $3, status = $4, external_id = $5,
        risk_level = $6, payload = $7, updated_at = NOW()
       WHERE id = $1`,
      [
        cur.id,
        next.priority ?? null,
        next.description ?? null,
        next.status ?? 'Open',
        next.external_id ?? null,
        next.risk_level ?? next.riskLevel ?? null,
        JSON.stringify(next),
      ],
    );
    return this.get(String(cur.id));
  }

  async remove(id: string) {
    const fail = await this.maybeFail();
    if (fail) return fail;
    const res = await this.pool.query(
      `DELETE FROM vulnerabilities WHERE id = $1 OR vulnerability_id = $1 RETURNING id`,
      [id],
    );
    if (!res.rowCount) return { status: 404, body: { error: 'not_found' } };
    return { status: 204, body: null };
  }

  async count() {
    const res = await this.pool.query(`SELECT COUNT(*)::int AS c FROM vulnerabilities`);
    return res.rows[0].c as number;
  }

  async clear() {
    await this.pool.query(`TRUNCATE vulnerabilities`);
  }

  /** Shared OAuth mock — concurrent refresh lock via advisory lock. */
  async issueToken(clientId: string) {
    const access = `access-${randomUUID()}`;
    const refresh = `refresh-${randomUUID()}`;
    const expires = new Date(Date.now() + 60_000);
    await this.pool.query(
      `INSERT INTO oauth_tokens (client_id, access_token, refresh_token, expires_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (client_id) DO UPDATE SET access_token = $2, refresh_token = $3, expires_at = $4`,
      [clientId, access, refresh, expires.toISOString()],
    );
    return { access_token: access, refresh_token: refresh, expires_in: 60, token_type: 'Bearer' };
  }

  async refreshToken(clientId: string, refreshToken: string) {
    const client: PoolClient = await this.pool.connect();
    try {
      // Distributed-safe single refresh using advisory lock
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [`oauth-refresh:${clientId}`]);
      this.refreshCount += 1;
      await new Promise((r) => setTimeout(r, 20)); // simulate latency
      const cur = await client.query(`SELECT * FROM oauth_tokens WHERE client_id = $1`, [clientId]);
      if (!cur.rows[0] || cur.rows[0].refresh_token !== refreshToken) {
        return { status: 401, body: { error: 'invalid_refresh' } };
      }
      const access = `access-${randomUUID()}`;
      const refresh = `refresh-${randomUUID()}`;
      const expires = new Date(Date.now() + 60_000);
      await client.query(
        `UPDATE oauth_tokens SET access_token = $2, refresh_token = $3, expires_at = $4 WHERE client_id = $1`,
        [clientId, access, refresh, expires.toISOString()],
      );
      return {
        status: 200,
        body: { access_token: access, refresh_token: refresh, expires_in: 60, token_type: 'Bearer' },
      };
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`oauth-refresh:${clientId}`]);
      client.release();
    }
  }

  async expireToken(clientId: string) {
    await this.pool.query(
      `UPDATE oauth_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE client_id = $1`,
      [clientId],
    );
  }

  async validateAccess(token: string) {
    const res = await this.pool.query(
      `SELECT * FROM oauth_tokens WHERE access_token = $1 AND expires_at > NOW()`,
      [token],
    );
    return res.rows[0] || null;
  }
}

function mapRow(r: any) {
  return {
    id: r.id,
    vulnerability_id: r.vulnerability_id,
    priority: r.priority,
    description: r.description,
    status: r.status,
    external_id: r.external_id,
    risk_level: r.risk_level,
    created_at: r.created_at,
    updated_at: r.updated_at,
    ...(r.payload && typeof r.payload === 'object' ? {} : {}),
  };
}

export async function createDevUatMockPair() {
  const fromVisUrl = process.env.VIS_DATABASE_URL?.replace(/\/[^/?]+(\?.*)?$/, '') || '';
  const base = process.env.VIS_MOCK_PG_BASE || fromVisUrl;
  if (!base) {
    throw new Error('VIS_MOCK_PG_BASE is required for PG mock apps. VIS persistence does not use VIS_DATABASE_URL.');
  }
  const dev = new PgMockEnterpriseApp({ databaseUrl: `${base}/vis_mock_dev`, envName: 'ENV-DEV' });
  const uat = new PgMockEnterpriseApp({ databaseUrl: `${base}/vis_mock_uat`, envName: 'ENV-UAT' });
  await dev.init();
  await uat.init();
  await dev.clear();
  await uat.clear();
  return { dev, uat };
}
