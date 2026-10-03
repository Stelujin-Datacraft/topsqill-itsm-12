/**
 * Phase 5–10 enterprise facade — wires codegen, security, governance,
 * observability, reconciliation, drift, marketplace, AI ops, self-healing.
 * Reuses Phase 1–4 VisStore + ExecutionEngine; does not duplicate engines.
 */
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getVisStore, VisStore } from '../store/vis.store';
import { CodeGenerationService } from '../codegen/code-generation.service';
import {
  RbacService,
  EncryptedSecretProvider,
  LocalSsoProvider,
  AiContextSanitizer,
  type AuthPrincipal,
} from '../security/enterprise-security';
import { GovernanceService } from '../governance/governance.service';
import { ObservabilityService } from '../observability/observability.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { DriftDetectionService } from '../drift/drift.service';
import { MarketplaceService, createSampleConnectorPackage } from '../marketplace/marketplace.service';
import { AiOpsService } from '../aiops/ai-ops.service';
import { SelfHealingService } from '../healing/self-healing.service';
import type { CodegenSpec, GovernanceEnvironment, PlatformPermission } from '../enterprise/types';
import type { FieldMappingSpec } from '../core/types/index';

@Injectable()
export class VisEnterpriseService {
  readonly store: VisStore;
  readonly codegen = new CodeGenerationService();
  readonly rbac = new RbacService();
  readonly secrets = new EncryptedSecretProvider();
  readonly sso = new LocalSsoProvider();
  readonly sanitizer = new AiContextSanitizer();
  readonly governance: GovernanceService;
  readonly observability: ObservabilityService;
  readonly reconciliation: ReconciliationService;
  readonly drift: DriftDetectionService;
  readonly marketplace: MarketplaceService;
  readonly aiops: AiOpsService;
  readonly healing: SelfHealingService;

  constructor() {
    this.store = getVisStore();
    this.governance = new GovernanceService(this.store);
    this.observability = new ObservabilityService(this.store);
    this.reconciliation = new ReconciliationService(this.store);
    this.drift = new DriftDetectionService(this.store);
    this.marketplace = new MarketplaceService(this.store);
    this.aiops = new AiOpsService(this.store);
    this.healing = new SelfHealingService(this.store);
  }

  // ── Auth helpers ───────────────────────────────────────────────────────
  assert(principal: AuthPrincipal | null | undefined, permission: PlatformPermission, resource?: { tenantId?: string; organizationId?: string }) {
    try {
      this.rbac.assert(principal, permission, resource);
    } catch (e: any) {
      if (e?.status === 401) throw new ForbiddenException(e.message);
      throw new ForbiddenException(e?.message || 'Forbidden');
    }
  }

  // ── 5A Codegen ─────────────────────────────────────────────────────────
  generateCode(opts: {
    integrationId: string;
    language?: CodegenSpec['language'];
    principal?: AuthPrincipal | null;
  }) {
    if (opts.principal) this.assert(opts.principal, 'codegen:generate');
    const integration = this.store.get('integrations', opts.integrationId);
    if (!integration) throw new NotFoundException('Integration not found');
    const version = integration.currentVersionId
      ? this.store.get('versions', String(integration.currentVersionId))
      : null;
    if (!version) throw new BadRequestException('No version');
    const design = (version.design || {}) as Record<string, unknown>;
    const directions = (version.directions as any[]) || [];
    const mappings: CodegenSpec['mappings'] = (directions[0]?.mappings || []).map((m: FieldMappingSpec) => ({
      sourceField: m.sourceField,
      targetField: m.targetField,
      transformation: m.transformation || null,
    }));
    const matching = directions[0]?.matchingStrategy || { sourceFields: [], targetFields: [] };
    const spec: CodegenSpec = {
      integrationId: opts.integrationId,
      versionId: version.id,
      language: opts.language || (design.language as any) || 'TYPESCRIPT',
      designSummary: String(design.summary || integration.name || ''),
      sourceKind: String((design.source as any)?.type || 'REST'),
      targetKind: String((design.target as any)?.type || 'INTERNAL_APP'),
      operations: ['map', 'upsert'],
      mappings,
      matchingStrategy: matching,
      retryPolicy: String(design.retryPolicy || 'exponential'),
      rateLimitPerMinute: (design.rateLimit as number) || null,
      eventEnabled: Boolean((version.eventConfig as any)?.eventEnabled),
    };
    const artifact = this.codegen.generate(spec);
    // Never auto-execute
    const row = this.store.create('codegenArtifacts', {
      integrationId: opts.integrationId,
      versionId: version.id,
      language: artifact.language,
      files: artifact.files,
      validation: artifact.validation,
      securityScan: artifact.securityScan,
      dependencyScan: artifact.dependencyScan,
      status: artifact.status,
      createdAt: new Date().toISOString(),
    });
    this.audit(opts.integrationId, version.id, 'CODEGEN_GENERATED', {
      language: artifact.language,
      status: artifact.status,
      artifactId: row.id,
    });
    return { artifactId: row.id, ...artifact, autoExecuted: false };
  }

  approveCodegen(artifactId: string, principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'codegen:approve');
    const row = this.store.get('codegenArtifacts', artifactId);
    if (!row) throw new NotFoundException('Artifact not found');
    if (row.status === 'REJECTED') throw new BadRequestException('Rejected artifact cannot be approved');
    if (!(row.validation as any)?.ok || !(row.securityScan as any)?.ok) {
      throw new BadRequestException('Validation/security scan must pass before approval');
    }
    const policy = this.governance.policy.evaluate({
      action: 'deploy-codegen',
      environment: 'PROD',
      securityScanOk: Boolean((row.securityScan as any)?.ok),
    });
    // Approval of artifact itself is allowed; deploy-to-prod is gated separately
    const updated = this.store.update('codegenArtifacts', artifactId, {
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
    });
    this.audit(String(row.integrationId), String(row.versionId), 'CODEGEN_APPROVED', {
      artifactId,
      prodDeployAllowed: policy.allowed,
    });
    return updated;
  }

  listCodegenLanguages() {
    return this.codegen.listLanguages();
  }

  // ── 5B Secrets / SSO ───────────────────────────────────────────────────
  async putSecret(refId: string, plaintext: string) {
    await this.secrets.put(refId, plaintext);
    return { credentialReferenceId: refId, stored: true };
  }

  async secretExists(refId: string) {
    const v = await this.secrets.get(refId);
    return { credentialReferenceId: refId, exists: v != null };
  }

  beginSsoLogin(returnUrl: string) {
    return this.sso.beginLogin(returnUrl);
  }

  async ssoCallback(params: Record<string, string>) {
    return this.sso.handleCallback(params);
  }

  // ── 5C Governance ──────────────────────────────────────────────────────
  promote(integrationId: string, targetEnvironment: GovernanceEnvironment, principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'environment:promote');
    const integration = this.store.get('integrations', integrationId);
    if (!integration) throw new NotFoundException('Integration not found');
    const versionId = String(integration.currentVersionId || '');
    const approvalCount = this.governance.countApprovals(integrationId, versionId)
      || (['APPROVED', 'ACTIVE', 'PAUSED'].includes(String(integration.status)) ? 1 : 0);
    try {
      const result = this.governance.promote(integrationId, {
        targetEnvironment,
        approvalCount,
        actorId: principal?.userId,
      });
      this.audit(integrationId, versionId, 'ENVIRONMENT_PROMOTED', {
        to: targetEnvironment,
        // Explicitly confirm credentials were NOT copied
        credentialsCopied: false,
      });
      return result;
    } catch (e: any) {
      if (e?.status === 403) throw new ForbiddenException(e.message);
      if (e?.status === 400) throw new BadRequestException(e.message);
      throw e;
    }
  }

  rollback(integrationId: string, targetVersionId: string, principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'integration:activate');
    try {
      const result = this.governance.rollback(integrationId, targetVersionId, principal?.userId);
      this.audit(integrationId, targetVersionId, 'VERSION_ROLLBACK', { targetVersionId });
      return result;
    } catch (e: any) {
      if (e?.status === 404) throw new NotFoundException(e.message);
      throw e;
    }
  }

  listVersions(integrationId: string) {
    return this.governance.listVersions(integrationId);
  }

  diffVersions(integrationId: string, fromVersionId: string, toVersionId: string) {
    try {
      return this.governance.diffVersions(integrationId, fromVersionId, toVersionId);
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  listPolicies() {
    return this.governance.policy.list();
  }

  // ── 7 Observability ────────────────────────────────────────────────────
  getPlatformMetrics() {
    return this.observability.platformMetrics();
  }

  getHealth(integrationId?: string) {
    return this.observability.computeHealth(integrationId);
  }

  listAlertRules() {
    return this.observability.listAlertRules();
  }

  async evaluateAlerts(metricValues: Record<string, number>) {
    return this.observability.evaluateAlerts(metricValues);
  }

  startTrace(opts: Parameters<ObservabilityService['startSpan']>[0]) {
    return this.observability.startSpan(opts);
  }

  // ── 8 Reconciliation ───────────────────────────────────────────────────
  reconcile(body: Parameters<ReconciliationService['reconcile']>[0], principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'reconciliation:run');
    return this.reconciliation.reconcile(body);
  }

  repair(opts: Parameters<ReconciliationService['executeRepair']>[0], principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'reconciliation:repair');
    try {
      return this.reconciliation.executeRepair(opts);
    } catch (e: any) {
      if (e?.status === 403) throw new ForbiddenException(e.message);
      throw e;
    }
  }

  // ── 9 Drift / Marketplace ──────────────────────────────────────────────
  detectDrift(opts: Parameters<DriftDetectionService['detectSchemaDrift']>[0]) {
    return this.drift.detectSchemaDrift(opts);
  }

  analyzeImpact(opts: Parameters<DriftDetectionService['analyzeImpact']>[0]) {
    return this.drift.analyzeImpact(opts);
  }

  registerConnector(pkg: Parameters<MarketplaceService['register']>[0], publisher: string, principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'marketplace:publish');
    return this.marketplace.register(pkg, publisher);
  }

  certifyConnector(id: string) {
    return this.marketplace.certify(id);
  }

  publishConnector(id: string, principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'marketplace:publish');
    return this.marketplace.publish(id);
  }

  installConnector(opts: Parameters<MarketplaceService['install']>[0], principal?: AuthPrincipal | null) {
    if (principal) this.assert(principal, 'connector:install');
    return this.marketplace.install(opts);
  }

  listConnectors(visibility?: string) {
    return this.marketplace.list(visibility);
  }

  sampleConnectorPackage() {
    return createSampleConnectorPackage();
  }

  // ── 10 AI Ops / Healing ────────────────────────────────────────────────
  analyzeFailure(executionId: string, integrationId?: string) {
    return this.aiops.analyzeFailure({ executionId, integrationId });
  }

  correlateIncident(integrationId: string, windowMinutes?: number) {
    return this.aiops.correlateIncident({ integrationId, windowMinutes });
  }

  recommendOptimization(opts: Parameters<AiOpsService['recommendOptimization']>[0]) {
    return this.aiops.recommendOptimization(opts);
  }

  generateTransform(instruction: string) {
    return this.aiops.generateTransformSpec(instruction);
  }

  generateTests(integrationId: string, mappings: Array<{ sourceField: string; targetField: string }>) {
    return this.aiops.generateTests({ integrationId, mappings });
  }

  generateDocs(opts: Parameters<AiOpsService['generateDocumentation']>[0]) {
    return this.aiops.generateDocumentation(opts);
  }

  setRecommendationStatus(id: string, status: Parameters<AiOpsService['setRecommendationStatus']>[1], principal?: AuthPrincipal | null) {
    if (principal && (status === 'APPROVED' || status === 'APPLIED')) {
      this.assert(principal, 'integration:approve');
    }
    return this.aiops.setRecommendationStatus(id, status);
  }

  listRecommendations(integrationId?: string) {
    return this.aiops.listRecommendations(integrationId);
  }

  sanitizeForAi(input: unknown) {
    return this.sanitizer.sanitize(input);
  }

  buildAiPrompt(opts: Parameters<AiOpsService['buildSafePrompt']>[0]) {
    return this.aiops.buildSafePrompt(opts);
  }

  async heal(opts: Parameters<SelfHealingService['execute']>[0]) {
    return this.healing.execute(opts);
  }

  adaptConcurrency(opts: Parameters<SelfHealingService['adaptConcurrency']>[0]) {
    return this.healing.adaptConcurrency(opts);
  }

  listHealingActions() {
    return this.healing.listActions();
  }

  enterpriseDashboard() {
    return {
      metrics: this.observability.platformMetrics(),
      health: this.observability.computeHealth(),
      alerts: this.store.list('alerts').slice(-20).reverse(),
      recommendations: this.store.list('aiRecommendations').slice(-20).reverse(),
      connectors: this.store.list('connectors').length,
      drift: this.store.list('driftFindings').slice(-10).reverse(),
      healing: this.store.list('healingActions').slice(-20).reverse(),
    };
  }

  private audit(integrationId: string | null, versionId: string | null, action: string, detail: unknown) {
    this.store.create('audits', {
      organizationId: null,
      integrationId,
      versionId,
      actorId: null,
      action,
      detail: this.sanitizer.sanitize(detail),
      createdAt: new Date().toISOString(),
    });
  }
}
