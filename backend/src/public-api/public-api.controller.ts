import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Req, Res, UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PublicApiService } from './public-api.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('public-api')
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('docs')
  docs() {
    return {
      name: 'TopSqill BPM Public API',
      version: '1.0.0',
      authentication: { type: 'API Key', header: 'x-api-key' },
    };
  }

  private async withAuth(req: Request, handler: (keyInfo: Record<string, unknown>) => Promise<unknown>) {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) throw new UnauthorizedException('API key required');
    const keyInfo = await this.publicApiService.validateApiKey(apiKey);
    if (!keyInfo) throw new UnauthorizedException('Invalid or expired API key');
    return handler(keyInfo);
  }

  @Public()
  @Get('forms')
  listForms(@Req() req: Request) {
    return this.withAuth(req, (keyInfo) => this.publicApiService.listForms(keyInfo));
  }

  @Public()
  @Get('forms/:id')
  getForm(@Req() req: Request, @Param('id') id: string) {
    return this.withAuth(req, (keyInfo) => this.publicApiService.getForm(keyInfo, id));
  }

  @Public()
  @Get('submissions')
  listSubmissions(@Req() req: Request) {
    const formId = req.query.form_id as string;
    return this.withAuth(req, (keyInfo) => this.publicApiService.listSubmissions(keyInfo, formId));
  }

  @Public()
  @Post('submissions')
  createSubmission(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.withAuth(req, (keyInfo) => this.publicApiService.createSubmission(keyInfo, body));
  }

  @Public()
  @Get('workflows')
  listWorkflows(@Req() req: Request) {
    return this.withAuth(req, (keyInfo) => this.publicApiService.listWorkflows(keyInfo));
  }

  @Public()
  @Get('reports')
  listReports(@Req() req: Request) {
    return this.withAuth(req, (keyInfo) => this.publicApiService.listReports(keyInfo));
  }
}
