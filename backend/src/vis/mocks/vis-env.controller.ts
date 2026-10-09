/**
 * HTTP REST APIs for ENV-DEV (source) and ENV-UAT (target) backed by PostgreSQL.
 * Used for readiness-gate E2E when live TopSqill forms are unavailable.
 * Contract mirrors Internal Application + REST vulnerability APIs.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  OnModuleInit,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { createDevUatMockPair, type PgMockEnterpriseApp } from './pg-mock-app';

let shared: { dev: PgMockEnterpriseApp; uat: PgMockEnterpriseApp } | null = null;

async function apps() {
  if (!shared) {
    shared = await createDevUatMockPair();
  }
  return shared;
}

@Public()
@Controller('vis/env')
export class VisEnvController implements OnModuleInit {
  async onModuleInit() {
    try {
      await apps();
    } catch (e) {
      console.warn('VIS env PG apps not initialized:', (e as Error)?.message);
    }
  }

  // ── Source-style vulnerability API (ENV-DEV) ───────────────────────────
  @Get('dev/api/v1/vulnerabilities')
  async listDev(@Query() query: Record<string, string>, @Res() res: Response) {
    const { dev } = await apps();
    const r = await dev.list(query);
    return this.send(res, r);
  }

  @Get('dev/api/v1/vulnerabilities/:id')
  async getDev(@Param('id') id: string, @Res() res: Response) {
    const { dev } = await apps();
    return this.send(res, await dev.get(id));
  }

  @Post('dev/api/v1/vulnerabilities')
  async createDev(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const { dev } = await apps();
    // Map severity→priority style source payload
    const mapped = {
      ...body,
      vulnerability_id: body.vulnerability_id || body.id,
      priority: body.priority || severityToPriority(String(body.severity || '')),
      description: body.description,
      status: body.status || 'Open',
      external_id: body.external_id || body.id || body.vulnerability_id,
    };
    return this.send(res, await dev.create(mapped));
  }

  @Patch('dev/api/v1/vulnerabilities/:id')
  async patchDev(@Param('id') id: string, @Body() body: Record<string, unknown>, @Res() res: Response) {
    const { dev } = await apps();
    return this.send(res, await dev.patch(id, body));
  }

  @Delete('dev/api/v1/vulnerabilities/:id')
  async delDev(@Param('id') id: string, @Res() res: Response) {
    const { dev } = await apps();
    return this.send(res, await dev.remove(id));
  }

  // ── Target Internal Application form API (ENV-UAT) ─────────────────────
  @Get('uat/api/forms')
  async listForms() {
    return {
      items: [
        {
          id: 'form-vulnerability',
          name: 'Vulnerability',
          description: 'UAT Vulnerability form (PG-backed)',
        },
      ],
    };
  }

  @Get('uat/api/forms/:formId')
  async getForm(@Param('formId') formId: string) {
    if (formId !== 'form-vulnerability') return { error: 'not_found' };
    return { id: formId, name: 'Vulnerability' };
  }

  @Get('uat/api/forms/:formId/fields')
  async getFields(@Param('formId') formId: string) {
    return {
      formId,
      fields: [
        { name: 'vulnerability_id', label: 'Vulnerability ID', type: 'text', required: true, unique: true },
        { name: 'priority', label: 'Priority', type: 'select', required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
        { name: 'status', label: 'Status', type: 'select', required: true },
        { name: 'external_id', label: 'External ID', type: 'text', required: false, unique: true },
      ],
    };
  }

  @Get('uat/api/forms/:formId/records')
  async listRecords(
    @Param('formId') formId: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const { uat } = await apps();
    const limit = query.limit != null && query.limit !== '' ? Number(query.limit) : undefined;
    const offset = query.offset != null && query.offset !== '' ? Number(query.offset) : undefined;
    const r = await uat.list({
      status: query.status,
      q: query.q,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    if (r.status !== 200) return this.send(res, r);
    let items = r.body.items || [];
    if (query.external_id) {
      items = items.filter((i: any) => String(i.external_id) === query.external_id);
    }
    if (query.vulnerability_id) {
      items = items.filter((i: any) => String(i.vulnerability_id) === query.vulnerability_id);
    }
    return res.status(200).json({ items, count: items.length, formId });
  }

  @Get('uat/api/forms/:formId/records/:recordId')
  async getRecord(@Param('recordId') recordId: string, @Res() res: Response) {
    const { uat } = await apps();
    return this.send(res, await uat.get(recordId));
  }

  @Post('uat/api/forms/:formId/records')
  async createRecord(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const { uat } = await apps();
    return this.send(res, await uat.create(body));
  }

  @Put('uat/api/forms/:formId/records/:recordId')
  async updateRecord(
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const { uat } = await apps();
    return this.send(res, await uat.patch(recordId, body));
  }

  @Delete('uat/api/forms/:formId/records/:recordId')
  async deleteRecord(@Param('recordId') recordId: string, @Res() res: Response) {
    const { uat } = await apps();
    return this.send(res, await uat.remove(recordId));
  }

  @Get('health')
  async health() {
    try {
      const { dev, uat } = await apps();
      return {
        ok: true,
        devCount: await dev.count(),
        uatCount: await uat.count(),
        persistence: 'postgresql',
      };
    } catch (e: any) {
      return { ok: false, error: e?.message };
    }
  }

  private send(res: Response, r: { status: number; body: any; headers?: Record<string, string> }) {
    if (r.headers) {
      for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    }
    if (r.status === 204) return res.status(204).send();
    return res.status(r.status || HttpStatus.OK).json(r.body);
  }
}

function severityToPriority(severity: string) {
  const m: Record<string, string> = { Critical: '1', High: '2', Medium: '3', Low: '4' };
  return m[severity] || severity || '3';
}

export async function resetVisEnvAppsForTests() {
  shared = await createDevUatMockPair();
  return shared;
}
