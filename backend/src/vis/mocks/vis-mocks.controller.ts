import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { getVisStore } from '../store/vis.store';

/**
 * Mock EXTERNAL systems for demo + resilience testing.
 * Configurable via query params / headers / body `_mock` flags.
 */
@Public()
@Controller('vis/mocks')
export class VisMocksController {
  private vulnerabilities = [
    {
      id: 'VUL-1001',
      severity: 'Critical',
      description: 'Apache vulnerability',
      team: 'Infrastructure',
      status: 'Open',
    },
    {
      id: 'VUL-1002',
      severity: 'High',
      description: 'Outdated OpenSSL library',
      team: 'Platform',
      status: 'Open',
    },
    {
      id: 'VUL-1003',
      severity: 'Medium',
      description: 'Missing security headers',
      team: 'Application',
      status: 'Open',
    },
    {
      id: 'VUL-1004',
      severity: 'Low',
      description: 'Informational cookie flag',
      team: 'Application',
      status: 'Closed',
    },
  ];

  /** Runtime resilience knobs (mutable for tests). */
  private behavior = {
    latencyMs: 0,
    failRate: 0,
    forceStatus: null as number | null,
    requireAuth: false,
    accessToken: 'valid-token',
    timeout: false,
  };

  private oauthTokens = {
    accessToken: 'access-initial',
    refreshToken: 'refresh-initial',
    expiresAt: Date.now() + 3600_000,
    refreshCount: 0,
  };

  @Post('behavior')
  setBehavior(@Body() body: Record<string, unknown>) {
    if (body.latencyMs !== undefined) this.behavior.latencyMs = Number(body.latencyMs);
    if (body.failRate !== undefined) this.behavior.failRate = Number(body.failRate);
    if (body.forceStatus !== undefined) {
      this.behavior.forceStatus = body.forceStatus === null ? null : Number(body.forceStatus);
    }
    if (body.requireAuth !== undefined) this.behavior.requireAuth = Boolean(body.requireAuth);
    if (body.accessToken !== undefined) this.behavior.accessToken = String(body.accessToken);
    if (body.timeout !== undefined) this.behavior.timeout = Boolean(body.timeout);
    if (body.resetOAuth) {
      this.oauthTokens = {
        accessToken: 'access-initial',
        refreshToken: 'refresh-initial',
        expiresAt: Date.now() - 1000, // expired by default for refresh tests
        refreshCount: 0,
      };
    }
    return { ok: true, behavior: this.behavior, oauth: { refreshCount: this.oauthTokens.refreshCount } };
  }

  @Get('behavior')
  getBehavior() {
    return {
      behavior: this.behavior,
      oauth: {
        expiresAt: this.oauthTokens.expiresAt,
        refreshCount: this.oauthTokens.refreshCount,
        accessTokenPreview: this.oauthTokens.accessToken.slice(0, 12),
      },
    };
  }

  @Post('oauth/token')
  oauthToken(@Body() body: Record<string, unknown>) {
    if (body.grant_type === 'refresh_token' || body.refresh_token) {
      this.oauthTokens.refreshCount += 1;
      this.oauthTokens.accessToken = `access-refreshed-${this.oauthTokens.refreshCount}`;
      this.oauthTokens.expiresAt = Date.now() + 3600_000;
      this.behavior.accessToken = this.oauthTokens.accessToken;
      return {
        access_token: this.oauthTokens.accessToken,
        refresh_token: this.oauthTokens.refreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
      };
    }
    this.oauthTokens.accessToken = 'access-initial';
    this.oauthTokens.expiresAt = Date.now() + 3600_000;
    return {
      access_token: this.oauthTokens.accessToken,
      refresh_token: this.oauthTokens.refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }

  @Get('oauth/refresh-count')
  refreshCount() {
    return { refreshCount: this.oauthTokens.refreshCount };
  }

  // ── Mock Vulnerability SOURCE API ──────────────────────────────────────
  @Get('vulnerabilities')
  async listVulnerabilities(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('cursor') cursor?: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.applyResilience(authorization);
    let rows = status
      ? this.vulnerabilities.filter((v) => v.status.toLowerCase() === status.toLowerCase())
      : this.vulnerabilities.slice();

    // Synthetic bulk for perf tests: ?generate=N
    // handled via generate query below

    const pageSize = Math.max(1, Number(limit) || 500);
    if (page || offset || cursor) {
      const pageNum = Math.max(1, Number(page) || 1);
      const off = offset !== undefined ? Number(offset) : (pageNum - 1) * pageSize;
      const slice = rows.slice(off, off + pageSize);
      const nextOff = off + pageSize;
      return {
        items: slice,
        count: rows.length,
        page: pageNum,
        limit: pageSize,
        nextPage: nextOff < rows.length ? pageNum + 1 : null,
        next: nextOff < rows.length ? `/vis/mocks/vulnerabilities?offset=${nextOff}&limit=${pageSize}` : null,
        done: nextOff >= rows.length,
      };
    }

    return { items: rows, count: rows.length };
  }

  @Get('vulnerabilities/generate')
  async generateVulnerabilities(@Query('count') count = '100', @Query('page') page = '1', @Query('limit') limit = '500') {
    await this.applyResilience();
    const total = Math.min(200_000, Math.max(0, Number(count) || 0));
    const pageSize = Math.max(1, Number(limit) || 500);
    const pageNum = Math.max(1, Number(page) || 1);
    const start = (pageNum - 1) * pageSize;
    const items: Record<string, unknown>[] = [];
    for (let i = start; i < Math.min(total, start + pageSize); i++) {
      const sev = ['Critical', 'High', 'Medium', 'Low'][i % 4];
      items.push({
        id: `VUL-${100000 + i}`,
        severity: sev,
        description: `Generated vulnerability ${i}`,
        team: ['Infrastructure', 'Platform', 'Application'][i % 3],
        status: 'Open',
      });
    }
    return {
      items,
      count: total,
      page: pageNum,
      nextPage: start + pageSize < total ? pageNum + 1 : null,
      done: start + pageSize >= total,
    };
  }

  @Get('vulnerabilities/:id')
  async getVulnerability(@Param('id') id: string) {
    await this.applyResilience();
    const row = this.vulnerabilities.find((v) => v.id === id);
    if (!row) throw new NotFoundException('Vulnerability not found');
    return row;
  }

  // ── Mock Internal Application API ──────────────────────────────────────
  @Get('forms')
  async listForms(@Headers('authorization') authorization?: string) {
    await this.applyResilience(authorization);
    const store = getVisStore();
    return {
      items: store.list('mockForms').map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
      })),
    };
  }

  @Get('forms/:id')
  async getForm(@Param('id') id: string) {
    await this.applyResilience();
    const form = getVisStore().get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    return { id: form.id, name: form.name, description: form.description };
  }

  @Get('forms/:id/fields')
  async getFormFields(@Param('id') id: string) {
    await this.applyResilience();
    const form = getVisStore().get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    return { formId: id, fields: form.fields || [] };
  }

  @Get('forms/:id/records')
  async listRecords(
    @Param('id') id: string,
    @Query('external_id') externalId?: string,
    @Query('vulnerability_id') vulnerabilityId?: string,
    @Query('ids') ids?: string,
  ) {
    await this.applyResilience();
    const store = getVisStore();
    const form = store.get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    let items = store.list('mockRecords').filter((r) => r.formId === id);
    if (externalId) {
      items = items.filter((r) => String((r.data as any)?.external_id) === externalId);
    }
    if (vulnerabilityId) {
      items = items.filter((r) => String((r.data as any)?.vulnerability_id) === vulnerabilityId);
    }
    if (ids) {
      const set = new Set(ids.split(',').map((s) => s.trim()));
      items = items.filter((r) => {
        const d = r.data as any;
        return set.has(String(d?.external_id || '')) || set.has(String(d?.vulnerability_id || ''));
      });
    }
    return { items, count: items.length };
  }

  /** Bulk existence check */
  @Post('forms/:id/records/search')
  async searchRecords(@Param('id') id: string, @Body() body: { ids?: string[]; field?: string }) {
    await this.applyResilience();
    const store = getVisStore();
    const field = body.field || 'external_id';
    const idSet = new Set((body.ids || []).map(String));
    const items = store
      .list('mockRecords')
      .filter((r) => r.formId === id)
      .filter((r) => idSet.has(String((r.data as any)?.[field] || '')))
      .map((r) => ({
        id: r.id,
        key: String((r.data as any)?.[field] || ''),
        data: r.data,
      }));
    return { items, count: items.length };
  }

  @Get('forms/:id/records/:recordId')
  async getRecord(@Param('id') id: string, @Param('recordId') recordId: string) {
    await this.applyResilience();
    const row = getVisStore().get('mockRecords', recordId);
    if (!row || row.formId !== id) throw new NotFoundException('Record not found');
    return row;
  }

  @Post('forms/:id/records')
  async createRecord(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    await this.applyResilience(authorization);
    const store = getVisStore();
    const form = store.get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    const row = store.create('mockRecords', {
      formId: id,
      data: body,
      correlationId: correlationId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { ...row, status: 201 };
  }

  @Post('forms/:id/records/bulk')
  async createBulk(@Param('id') id: string, @Body() body: { records?: Record<string, unknown>[] }) {
    await this.applyResilience();
    const store = getVisStore();
    const form = store.get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    const created = (body.records || []).map((data) =>
      store.create('mockRecords', {
        formId: id,
        data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    return { items: created, count: created.length };
  }

  @Put('forms/:id/records/:recordId')
  async updateRecord(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    await this.applyResilience();
    const store = getVisStore();
    const row = store.get('mockRecords', recordId);
    if (!row || row.formId !== id) throw new NotFoundException('Record not found');
    return store.update('mockRecords', recordId, {
      data: { ...(row.data as object), ...body },
      correlationId: correlationId || row.correlationId || null,
      updatedAt: new Date().toISOString(),
    });
  }

  private async applyResilience(authorization?: string) {
    if (this.behavior.timeout) {
      await new Promise((r) => setTimeout(r, 120_000));
    }
    if (this.behavior.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.behavior.latencyMs));
    }
    if (this.behavior.requireAuth) {
      const token = (authorization || '').replace(/^Bearer\s+/i, '');
      if (!token || token !== this.behavior.accessToken) {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }
    if (this.behavior.forceStatus) {
      const s = this.behavior.forceStatus;
      if (s === 429) {
        throw new HttpException(
          { message: 'Rate limited', retryAfter: 1 },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (s === 503) throw new ServiceUnavailableException('Upstream unavailable');
      if (s === 500) throw new HttpException('Internal error', HttpStatus.INTERNAL_SERVER_ERROR);
      if (s === 401) throw new UnauthorizedException('Unauthorized');
    }
    if (this.behavior.failRate > 0 && Math.random() < this.behavior.failRate) {
      throw new HttpException('Random failure', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
