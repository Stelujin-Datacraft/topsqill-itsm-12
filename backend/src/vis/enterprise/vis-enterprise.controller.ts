/**
 * Phase 5–10 enterprise API surface — /api/vis/enterprise/*
 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { VisEnterpriseService } from './vis-enterprise.service';
import type { AuthPrincipal } from '../security/enterprise-security';
import type { GovernanceEnvironment } from './types';
import { getDeploymentTopology } from './ha';

@Public()
@Controller('vis/enterprise')
export class VisEnterpriseController {
  constructor(private readonly ent: VisEnterpriseService) {}

  private principal(body?: { principal?: AuthPrincipal }): AuthPrincipal | null {
    return body?.principal || null;
  }

  @Get('dashboard')
  dashboard() {
    return this.ent.enterpriseDashboard();
  }

  // ── Codegen ────────────────────────────────────────────────────────────
  @Get('codegen/languages')
  languages() {
    return this.ent.listCodegenLanguages();
  }

  @Post('codegen/:integrationId')
  generate(
    @Param('integrationId') integrationId: string,
    @Body() body: { language?: string; principal?: AuthPrincipal },
  ) {
    return this.ent.generateCode({
      integrationId,
      language: body?.language as any,
      principal: this.principal(body),
    });
  }

  @Post('codegen/artifacts/:id/approve')
  approveCodegen(@Param('id') id: string, @Body() body?: { principal?: AuthPrincipal }) {
    return this.ent.approveCodegen(id, this.principal(body));
  }

  // ── Security / SSO / Secrets ───────────────────────────────────────────
  @Get('rbac/permissions')
  permissions() {
    return this.ent.rbac.allPermissions();
  }

  @Get('rbac/roles/:role')
  rolePerms(@Param('role') role: string) {
    return this.ent.rbac.listPermissions(role as any);
  }

  @Post('secrets')
  putSecret(@Body() body: { credentialReferenceId: string; plaintext: string }) {
    return this.ent.putSecret(body.credentialReferenceId, body.plaintext);
  }

  @Get('secrets/:refId')
  secretExists(@Param('refId') refId: string) {
    return this.ent.secretExists(refId);
  }

  @Post('sso/login')
  ssoLogin(@Body() body: { returnUrl: string }) {
    return this.ent.beginSsoLogin(body.returnUrl || '/');
  }

  @Post('sso/callback')
  ssoCallback(@Body() body: Record<string, string>) {
    return this.ent.ssoCallback(body);
  }

  // ── Governance ─────────────────────────────────────────────────────────
  @Post('integrations/:id/promote')
  promote(
    @Param('id') id: string,
    @Body() body: { targetEnvironment: GovernanceEnvironment; principal?: AuthPrincipal },
  ) {
    return this.ent.promote(id, body.targetEnvironment, this.principal(body));
  }

  @Post('integrations/:id/rollback')
  rollback(
    @Param('id') id: string,
    @Body() body: { targetVersionId: string; principal?: AuthPrincipal },
  ) {
    return this.ent.rollback(id, body.targetVersionId, this.principal(body));
  }

  @Get('integrations/:id/versions')
  versions(@Param('id') id: string) {
    return this.ent.listVersions(id);
  }

  @Get('integrations/:id/versions/diff')
  diff(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.ent.diffVersions(id, from, to);
  }

  @Get('policies')
  policies() {
    return this.ent.listPolicies();
  }

  // ── Observability ──────────────────────────────────────────────────────
  @Get('metrics')
  metrics() {
    return this.ent.getPlatformMetrics();
  }

  @Get('health')
  health(@Query('integrationId') integrationId?: string) {
    return this.ent.getHealth(integrationId);
  }

  @Get('alerts/rules')
  alertRules() {
    return this.ent.listAlertRules();
  }

  @Post('alerts/evaluate')
  evaluateAlerts(@Body() body: { metrics: Record<string, number> }) {
    return this.ent.evaluateAlerts(body.metrics || {});
  }

  // ── Reconciliation ─────────────────────────────────────────────────────
  @Post('reconciliation')
  reconcile(@Body() body: any) {
    return this.ent.reconcile(body, this.principal(body));
  }

  @Post('reconciliation/:reportId/repair')
  repair(@Param('reportId') reportId: string, @Body() body: any) {
    return this.ent.repair({ ...body, reportId }, this.principal(body));
  }

  // ── Drift ──────────────────────────────────────────────────────────────
  @Post('drift/detect')
  detectDrift(@Body() body: any) {
    return this.ent.detectDrift(body);
  }

  @Post('drift/impact')
  impact(@Body() body: any) {
    return this.ent.analyzeImpact(body);
  }

  // ── Marketplace ────────────────────────────────────────────────────────
  @Get('connectors/sample-package')
  samplePackage() {
    return this.ent.sampleConnectorPackage();
  }

  @Get('connectors')
  connectors(@Query('visibility') visibility?: string) {
    return this.ent.listConnectors(visibility);
  }

  @Post('connectors')
  registerConnector(@Body() body: any) {
    return this.ent.registerConnector(body.package || body, body.publisher || 'vis', this.principal(body));
  }

  @Post('connectors/:id/certify')
  certify(@Param('id') id: string) {
    return this.ent.certifyConnector(id);
  }

  @Post('connectors/:id/publish')
  publish(@Param('id') id: string, @Body() body?: { principal?: AuthPrincipal }) {
    return this.ent.publishConnector(id, this.principal(body));
  }

  @Post('connectors/:id/install')
  install(@Param('id') id: string, @Body() body: any) {
    return this.ent.installConnector({ connectorId: id, ...body }, this.principal(body));
  }

  @Get('deployment')
  deployment() {
    return getDeploymentTopology();
  }

  // ── AI Ops ─────────────────────────────────────────────────────────────
  @Post('ai/failure-analysis')
  failureAnalysis(@Body() body: { executionId: string; integrationId?: string }) {
    return this.ent.analyzeFailure(body.executionId, body.integrationId);
  }

  @Post('ai/correlate')
  correlate(@Body() body: { integrationId: string; windowMinutes?: number }) {
    return this.ent.correlateIncident(body.integrationId, body.windowMinutes);
  }

  @Post('ai/optimize')
  optimize(@Body() body: any) {
    return this.ent.recommendOptimization(body);
  }

  @Post('ai/transform')
  transform(@Body() body: { instruction: string }) {
    return this.ent.generateTransform(body.instruction);
  }

  @Post('ai/tests')
  tests(@Body() body: { integrationId: string; mappings: any[] }) {
    return this.ent.generateTests(body.integrationId, body.mappings || []);
  }

  @Post('ai/docs')
  docs(@Body() body: any) {
    return this.ent.generateDocs(body);
  }

  @Get('ai/recommendations')
  recommendations(@Query('integrationId') integrationId?: string) {
    return this.ent.listRecommendations(integrationId);
  }

  @Put('ai/recommendations/:id')
  setRec(@Param('id') id: string, @Body() body: { status: any; principal?: AuthPrincipal }) {
    return this.ent.setRecommendationStatus(id, body.status, this.principal(body));
  }

  @Post('ai/sanitize')
  sanitize(@Body() body: { input: unknown }) {
    return this.ent.sanitizeForAi(body.input);
  }

  @Post('ai/prompt')
  prompt(@Body() body: any) {
    return this.ent.buildAiPrompt(body);
  }

  // ── Self-healing ───────────────────────────────────────────────────────
  @Get('healing/actions')
  healingActions() {
    return this.ent.listHealingActions();
  }

  @Post('healing/execute')
  heal(@Body() body: any) {
    return this.ent.heal(body);
  }

  @Post('healing/adapt-concurrency')
  adapt(@Body() body: any) {
    return { concurrency: this.ent.adaptConcurrency(body) };
  }
}
