import {
  All,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  OnModuleInit,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { EngineHostService } from '../engines/engine-host.service';
import { FormApiService } from './form-api.service';

/**
 * TopSqill Form API — used by Integration Studio as the write target.
 * Marked @Public so Connection Test / Discover Forms can reach it without a
 * user JWT (machine-style). Writes still go through the service-role engine.
 */
@Public()
@Controller('form-api')
export class FormApiController implements OnModuleInit {
  private handler!: (req: globalThis.Request) => Promise<globalThis.Response>;

  constructor(
    private readonly engineHost: EngineHostService,
    private readonly formApi: FormApiService,
  ) {}

  onModuleInit() {
    this.handler = this.engineHost.createFormApiHandler();
  }

  /** Lightweight reachability probe — no DB. */
  @Get('health')
  health() {
    return { success: true, data: { ok: true, service: 'form-api' } };
  }

  /** List forms for Discover Forms (Integration Studio). */
  @Get('forms')
  async listForms(
    @Query('project_id') projectId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await this.formApi.listForms({
        projectId,
        status,
        limit: limit ? Number(limit) : 200,
      });
      return { success: true, data: result.data || [] };
    } catch (e: any) {
      throw new HttpException(
        {
          success: false,
          error: { code: 'FETCH_ERROR', message: e?.message || 'Failed to list forms' },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('forms/:formId')
  async getForm(@Param('formId') formId: string) {
    const result = await this.formApi.getForm(formId);
    return { success: true, data: result.data };
  }

  @Get('forms/:formId/fields')
  async getFields(@Param('formId') formId: string) {
    const result = await this.formApi.getFormFields(formId);
    return { success: true, data: result.data || [] };
  }

  /** Create a form submission — used by Integration Studio execution. */
  @Post('forms/:formId/records')
  async createRecord(@Param('formId') formId: string, @Body() body: Record<string, unknown>) {
    try {
      const result = await this.formApi.createRecord(formId, body || {});
      return { success: true, data: result.data };
    } catch (e: any) {
      const msg = String(e?.message || e?.response?.message || 'Failed to create record');
      const status =
        e?.status === 404 || e?.statusCode === 404 || /not found/i.test(msg)
          ? HttpStatus.NOT_FOUND
          : e?.status === 400 || e?.statusCode === 400
            ? HttpStatus.BAD_REQUEST
            : HttpStatus.INTERNAL_SERVER_ERROR;
      // Flat message + nested error so browser clients always surface something useful
      throw new HttpException(
        {
          success: false,
          message: msg,
          error: {
            code: status === 404 ? 'FORM_NOT_FOUND' : 'CREATE_ERROR',
            message: msg,
          },
        },
        status,
      );
    }
  }

  /** Catch-all for remaining Form API routes (records update/delete/etc.). */
  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    const original = String(req.originalUrl || req.url || '/');
    const normalizedPath = original
      .replace(/^\/api\/form-api/, '')
      .replace(/^\/form-api/, '')
      || '/';
    // Strip query for path rebuild; preserve search on URL
    const pathOnly = normalizedPath.split('?')[0] || '/';
    const search = original.includes('?') ? original.slice(original.indexOf('?')) : '';
    const url = `${req.protocol}://${req.get('host')}/form-api${pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`}${search}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const part of value) headers.append(key, part);
      } else {
        headers.set(key, value);
      }
    }

    const init: RequestInit = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)
        ? JSON.stringify(req.body)
        : req.body;
    }

    const response = await this.handler(new globalThis.Request(url, init));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  }
}
