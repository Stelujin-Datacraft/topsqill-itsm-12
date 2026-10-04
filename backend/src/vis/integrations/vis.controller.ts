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
  analyze(
    @Param('id') id: string,
    @Body() body: { promptText?: string; answers?: Record<string, string> },
  ) {
    return this.vis.analyzeIntegration(id, body?.promptText, body?.answers);
  }

  @Post('integrations/:id/clarify')
  clarify(@Param('id') id: string, @Body() body: { promptText?: string }) {
    return this.vis.clarifyIntegration(id, body?.promptText);
  }

  @Post('integrations/:id/language')
  setLanguage(@Param('id') id: string, @Body() body: { language: string }) {
    return this.vis.setLanguage(id, body.language as any);
  }

  @Post('integrations/:id/validate')
  validate(@Param('id') id: string) {
    return this.vis.validateIntegration(id);
  }

  @Post('integrations/:id/approve')
  approve(@Param('id') id: string) {
    return this.vis.approveIntegration(id);
  }

  @Post('integrations/:id/save-draft')
  saveDraft(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.vis.saveDraft(id, body || {});
  }

  @Post('integrations/:id/connections')
  bindConnections(
    @Param('id') id: string,
    @Body()
    body: {
      sourceConnectionId?: string;
      targetConnectionId?: string;
      selectedFormId?: string;
    },
  ) {
    return this.vis.setDirectionConnections(id, body || {});
  }

  @Post('integrations/:id/matching-strategy')
  matchingStrategy(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.vis.setMatchingStrategy(id, body as any);
  }

  @Post('integrations/:id/discover-schema')
  discoverSchema(
    @Param('id') id: string,
    @Body() body: { connectionId: string; formId: string },
  ) {
    return this.vis.discoverSchema(id, body);
  }

  @Post('integrations/:id/refresh-schema')
  refreshSchema(
    @Param('id') id: string,
    @Body() body: { connectionId: string; formId: string },
  ) {
    return this.vis.refreshSchema(id, body);
  }

  @Get('integrations/:id/mappings')
  getMappings(
    @Param('id') id: string,
    @Query('filter') filter?: 'ALL' | 'HIGH' | 'NEEDS_REVIEW',
  ) {
    return filter ? this.vis.filterMappings(id, filter) : this.vis.getMappings(id);
  }

  @Put('integrations/:id/mappings')
  saveMappings(@Param('id') id: string, @Body() body: { mappings: any[] }) {
    return this.vis.saveMappings(id, body.mappings || []);
  }

  @Post('integrations/:id/suggest-mappings')
  suggestMappings(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.vis.suggestMappings(id, body as any);
  }

  @Post('integrations/:id/nl-mapping')
  nlMapping(@Param('id') id: string, @Body() body: { instruction: string }) {
    return this.vis.applyNaturalLanguageMapping(id, body.instruction);
  }

  @Post('integrations/:id/sample-source')
  sampleSource(@Param('id') id: string, @Body() body: { sample: unknown }) {
    return this.vis.setSampleSourceData(id, body.sample as any);
  }

  @Post('integrations/:id/openapi')
  openApi(@Param('id') id: string, @Body() body: { document?: unknown; url?: string }) {
    return this.vis.discoverOpenApi(id, body || {});
  }

  @Post('integrations/:id/openapi/select')
  selectEndpoint(
    @Param('id') id: string,
    @Body() body: { path: string; method: string },
  ) {
    return this.vis.selectOpenApiEndpoint(id, body);
  }

  @Post('integrations/:id/dry-run')
  dryRun(@Param('id') id: string, @Body() body: { sample?: Record<string, unknown>[] }) {
    return this.vis.dryRun(id, body);
  }

  @Post('integrations/:id/executions')
  createExecution(
    @Param('id') id: string,
    @Body() body?: { awaitCompletion?: boolean; maxPages?: number; workers?: number; concurrency?: number },
  ) {
    return this.vis.createExecution(id, body || {});
  }

  @Post('executions/:id/cancel')
  cancelExecution(@Param('id') id: string) {
    return this.vis.cancelExecution(id);
  }

  @Post('executions/:id/retry-failed')
  retryFailed(@Param('id') id: string, @Body() body?: { awaitCompletion?: boolean }) {
    return this.vis.retryFailedRecords(id, body);
  }

  @Get('executions/:id/records/:recordId/trace')
  recordTrace(@Param('id') id: string, @Param('recordId') recordId: string) {
    return this.vis.getRecordTrace(id, recordId);
  }

  @Get('dead-letters')
  listDeadLetters(
    @Query('executionId') executionId?: string,
    @Query('integrationId') integrationId?: string,
  ) {
    return this.vis.listDeadLetters({ executionId, integrationId });
  }

  @Post('dead-letters/:id/ignore')
  ignoreDeadLetter(@Param('id') id: string) {
    return this.vis.ignoreDeadLetter(id);
  }

  @Get('connections')
  listConnections() {
    return this.vis.listConnections();
  }

  @Post('connections')
  createConnection(@Body() body: Record<string, unknown>) {
    return this.vis.createConnection(body);
  }

  @Delete('connections/:id')
  deleteConnection(@Param('id') id: string) {
    return this.vis.deleteConnection(id);
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

  /** @deprecated Built-in demo seeding disabled — returns empty create result. */
  @Post('demo/bootstrap')
  bootstrapDemo() {
    return this.vis.bootstrapDemoConnections();
  }

  /** Remove lab/demo stub connections left from earlier internal testing. */
  @Post('demo/purge')
  purgeDemo() {
    return this.vis.purgeLabConnections();
  }
}
