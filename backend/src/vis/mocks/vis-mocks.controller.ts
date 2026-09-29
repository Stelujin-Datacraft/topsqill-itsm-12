import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { getVisStore } from '../store/vis.store';

/**
 * Mock EXTERNAL systems for demo only.
 * These represent systems outside Versatile Integration Studio.
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

  // ── Mock Vulnerability SOURCE API ──────────────────────────────────────
  @Get('vulnerabilities')
  listVulnerabilities(@Query('status') status?: string) {
    const rows = status
      ? this.vulnerabilities.filter((v) => v.status.toLowerCase() === status.toLowerCase())
      : this.vulnerabilities;
    return { items: rows, count: rows.length };
  }

  @Get('vulnerabilities/:id')
  getVulnerability(@Param('id') id: string) {
    const row = this.vulnerabilities.find((v) => v.id === id);
    if (!row) throw new NotFoundException('Vulnerability not found');
    return row;
  }

  // ── Mock Internal Application API ──────────────────────────────────────
  @Get('forms')
  listForms() {
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
  getForm(@Param('id') id: string) {
    const form = getVisStore().get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    return { id: form.id, name: form.name, description: form.description };
  }

  @Get('forms/:id/fields')
  getFormFields(@Param('id') id: string) {
    const form = getVisStore().get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    return { formId: id, fields: form.fields || [] };
  }

  @Get('forms/:id/records')
  listRecords(@Param('id') id: string) {
    const store = getVisStore();
    const form = store.get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    const items = store.list('mockRecords').filter((r) => r.formId === id);
    return { items, count: items.length };
  }

  @Get('forms/:id/records/:recordId')
  getRecord(@Param('id') id: string, @Param('recordId') recordId: string) {
    const row = getVisStore().get('mockRecords', recordId);
    if (!row || row.formId !== id) throw new NotFoundException('Record not found');
    return row;
  }

  @Post('forms/:id/records')
  createRecord(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const store = getVisStore();
    const form = store.get('mockForms', id);
    if (!form) throw new NotFoundException('Form not found');
    const row = store.create('mockRecords', {
      formId: id,
      data: body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return row;
  }

  @Put('forms/:id/records/:recordId')
  updateRecord(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const store = getVisStore();
    const row = store.get('mockRecords', recordId);
    if (!row || row.formId !== id) throw new NotFoundException('Record not found');
    return store.update('mockRecords', recordId, {
      data: { ...(row.data as object), ...body },
      updatedAt: new Date().toISOString(),
    });
  }
}
