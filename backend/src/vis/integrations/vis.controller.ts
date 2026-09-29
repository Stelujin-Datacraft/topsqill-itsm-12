import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { VisService } from './vis.service';

/**
 * Versatile Integration Studio APIs.
 * Mounted at /api/vis/*
 * Phase 1: @Public for demo/tests; tighten auth in later phase.
 */
@Public()
@Controller('vis')
export class VisController {
  constructor(private readonly vis: VisService) {}

  @Get('dashboard')
  dashboard() {
    return this.vis.getDashboard();
  }

  @Get('integrations')
  listIntegrations() {
    return this.vis.listIntegrations();
  }

  @Post('integrations')
  createIntegration(@Body() body: Record<string, unknown>) {
    return this.vis.createIntegration(body as any);
  }

  @Get('integrations/:id')
  getIntegration(@Param('id') id: string) {
    return this.vis.getIntegration(id);
  }

  @Put('integrations/:id')
  updateIntegration(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.vis.updateIntegration(id, body);
  }

  @Delete('integrations/:id')
  deleteIntegration(@Param('id') id: string) {
    return this.vis.deleteIntegration(id);
  }

  @Post('integrations/:id/analyze')
  analyze(@Param('id') id: string, @Body() body: { promptText?: string }) {
    return this.vis.analyzeIntegration(id, body?.promptText);
  }

  @Post('integrations/:id/language')
  setLanguage(@Param('id') id: string, @Body() body: { language: string }) {
    return this.vis.setLanguage(id, body.language as any);
  }

  @Post('integrations/:id/validate')
  validate(@Param('id') id: string) {
    return this.vis.validateIntegration(id);
  }

  @Post('integrations/:id/discover-schema')
  discoverSchema(
    @Param('id') id: string,
    @Body() body: { connectionId: string; formId: string },
  ) {
    return this.vis.discoverSchema(id, body);
  }

  @Get('integrations/:id/mappings')
  getMappings(@Param('id') id: string) {
    return this.vis.getMappings(id);
  }

  @Put('integrations/:id/mappings')
  saveMappings(@Param('id') id: string, @Body() body: { mappings: any[] }) {
    return this.vis.saveMappings(id, body.mappings || []);
  }

  @Post('integrations/:id/suggest-mappings')
  suggestMappings(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.vis.suggestMappings(id, body as any);
  }

  @Post('integrations/:id/executions')
  createExecution(@Param('id') id: string) {
    return this.vis.createExecution(id);
  }

  @Get('connections')
  listConnections() {
    return this.vis.listConnections();
  }

  @Post('connections')
  createConnection(@Body() body: Record<string, unknown>) {
    return this.vis.createConnection(body);
  }

  @Post('connections/:id/test')
  testConnection(@Param('id') id: string) {
    return this.vis.testConnection(id);
  }

  @Get('connections/:id/forms')
  discoverForms(
    @Param('id') id: string,
    @Query('baseUrl') baseUrl?: string,
  ) {
    return this.vis.discoverForms(id, baseUrl);
  }

  @Get('schema-cache')
  schemaCache(@Query('connectionId') connectionId?: string) {
    return this.vis.getSchemaCache(connectionId);
  }

  @Get('executions')
  listExecutions(@Query('integrationId') integrationId?: string) {
    return this.vis.listExecutions(integrationId);
  }

  @Get('executions/:id')
  getExecution(@Param('id') id: string) {
    return this.vis.getExecution(id);
  }

  @Get('logs')
  listLogs(
    @Query('executionId') executionId?: string,
    @Query('level') level?: string,
  ) {
    return this.vis.listLogs({ executionId, level });
  }

  @Get('audit')
  listAudit(@Query('integrationId') integrationId?: string) {
    return this.vis.listAudit(integrationId);
  }

  /** Create demo source + internal-app connections pointed at this Nest process. */
  @Post('demo/bootstrap')
  bootstrapDemo() {
    return this.vis.bootstrapDemoConnections();
  }
}
