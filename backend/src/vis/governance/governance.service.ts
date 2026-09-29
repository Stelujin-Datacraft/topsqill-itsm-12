/**
 * Stage 5C — Governance: lifecycle, promotion, rollback, policy engine, versioning.
 */
import { randomUUID } from 'crypto';
import {
  PROMOTION_ORDER,
  type GovernanceEnvironment,
  type PolicyContext,
  type PolicyResult,
  type PolicyRule,
} from '../enterprise/types';
import type { VisStore, VisRecord } from '../store/vis.store';

export function nextPromotionEnv(current: string): GovernanceEnvironment | null {
  const idx = PROMOTION_ORDER.indexOf(current as GovernanceEnvironment);
  if (idx < 0 || idx >= PROMOTION_ORDER.length - 1) return null;
  return PROMOTION_ORDER[idx + 1];
}

export function canPromote(from: string, to: string): boolean {
  const fi = PROMOTION_ORDER.indexOf(from as GovernanceEnvironment);
  const ti = PROMOTION_ORDER.indexOf(to as GovernanceEnvironment);
  return fi >= 0 && ti === fi + 1;
}

/** Configurable policy engine — rules are data-driven, not hardcoded callers. */
export class PolicyEngine {
  private rules: PolicyRule[] = [];

  constructor(seed?: PolicyRule[]) {
    this.rules = seed || defaultPolicies();
  }

  list() {
    return this.rules.map(({ evaluate: _e, ...rest }) => rest);
  }

  add(rule: PolicyRule) {
    this.rules.push(rule);
  }

  evaluate(ctx: PolicyContext): { allowed: boolean; violations: PolicyResult[] } {
    const violations: PolicyResult[] = [];
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const result = rule.evaluate(ctx);
      if (!result.allowed) {
        violations.push({ ...result, ruleId: rule.id });
        if (rule.blocking) {
          return { allowed: false, violations };
        }
      }
    }
    return { allowed: true, violations };
  }
}

function defaultPolicies(): PolicyRule[] {
  return [
    {
      id: 'prod-requires-approval',
      name: 'Production requires approval',
      description: 'Activate/promote to PROD requires an approved version',
      enabled: true,
      blocking: true,
      evaluate: (ctx) => {
        if (ctx.environment === 'PROD' && (ctx.action === 'activate' || ctx.action === 'promote')) {
          if ((ctx.approvalCount || 0) < (ctx.requiredApprovals || 1)) {
            return { allowed: false, reason: 'Production requires at least one approval' };
          }
        }
        return { allowed: true };
      },
    },
    {
      id: 'prod-requires-security-scan',
      name: 'Production requires security scan',
      description: 'Codegen/deploy to PROD requires clean security scan',
      enabled: true,
      blocking: true,
      evaluate: (ctx) => {
        if (ctx.environment === 'PROD' && ctx.action === 'deploy-codegen' && ctx.securityScanOk === false) {
          return { allowed: false, reason: 'Critical security findings block production deployment' };
        }
        return { allowed: true };
      },
    },
    {
      id: 'approved-connectors-only',
      name: 'Only approved connectors',
      description: 'PROD integrations may only use approved connectors',
      enabled: true,
      blocking: true,
      evaluate: (ctx) => {
        if (ctx.environment === 'PROD' && ctx.action === 'activate' && ctx.connectorApproved === false) {
          return { allowed: false, reason: 'Only approved connectors may be used in PROD' };
        }
        return { allowed: true };
      },
    },
    {
      id: 'two-person-prod',
      name: 'Two-person approval for PROD',
      description: 'Critical integrations require two approvals before PROD activate',
      enabled: false,
      blocking: true,
      evaluate: (ctx) => {
        if (ctx.environment === 'PROD' && ctx.action === 'activate' && (ctx.requiredApprovals || 0) >= 2) {
          if ((ctx.approvalCount || 0) < 2) {
            return { allowed: false, reason: 'Two-person approval required for PROD' };
          }
        }
        return { allowed: true };
      },
    },
  ];
}

export class GovernanceService {
  readonly policy: PolicyEngine;

  constructor(private readonly store: VisStore, policy?: PolicyEngine) {
    this.policy = policy || new PolicyEngine();
  }

  listVersions(integrationId: string) {
    return this.store
      .list('versions')
      .filter((v) => v.integrationId === integrationId)
      .sort((a, b) => Number(a.version) - Number(b.version));
  }

  diffVersions(integrationId: string, fromVersionId: string, toVersionId: string) {
    const from = this.store.get('versions', fromVersionId);
    const to = this.store.get('versions', toVersionId);
    if (!from || !to || from.integrationId !== integrationId || to.integrationId !== integrationId) {
      throw Object.assign(new Error('Version not found'), { status: 404 });
    }
    const fromDesign = JSON.stringify(from.design || {}, null, 2);
    const toDesign = JSON.stringify(to.design || {}, null, 2);
    const fromMaps = JSON.stringify((from.directions as any)?.[0]?.mappings || [], null, 2);
    const toMaps = JSON.stringify((to.directions as any)?.[0]?.mappings || [], null, 2);
    return {
      from: { id: from.id, version: from.version, status: from.status },
      to: { id: to.id, version: to.version, status: to.status },
      designChanged: fromDesign !== toDesign,
      mappingsChanged: fromMaps !== toMaps,
      fromDesign: from.design,
      toDesign: to.design,
    };
  }

  /**
   * Promote design+config to next environment WITHOUT copying PROD credentials downward.
   * Credentials stay environment-scoped via credentialReferenceId.
   */
  promote(
    integrationId: string,
    opts: {
      targetEnvironment: GovernanceEnvironment;
      approvalCount?: number;
      connectorApproved?: boolean;
      actorId?: string;
    },
  ) {
    const integration = this.store.get('integrations', integrationId);
    if (!integration) throw Object.assign(new Error('Integration not found'), { status: 404 });
    const currentEnv = String(integration.environment || 'DEV');
    if (!canPromote(currentEnv, opts.targetEnvironment)) {
      throw Object.assign(
        new Error(`Illegal promotion ${currentEnv} → ${opts.targetEnvironment}`),
        { status: 400 },
      );
    }
    const policy = this.policy.evaluate({
      action: 'promote',
      environment: opts.targetEnvironment,
      integrationId,
      approvalCount: opts.approvalCount ?? (integration.status === 'APPROVED' || integration.status === 'ACTIVE' ? 1 : 0),
      requiredApprovals: 1,
      connectorApproved: opts.connectorApproved !== false,
    });
    if (!policy.allowed) {
      throw Object.assign(new Error(policy.violations[0]?.reason || 'Policy denied'), { status: 403 });
    }

    const version = integration.currentVersionId
      ? this.store.get('versions', String(integration.currentVersionId))
      : null;
    // Strip any credential material from environment config on promote
    const envConfig = {
      environment: opts.targetEnvironment,
      designVersionId: version?.id || null,
      // NEVER copy PROD credentials into lower envs; never copy any secret values
      credentialReferenceIds: [] as string[],
      note: 'Bind environment-specific credentials after promotion',
    };

    const promotion = this.store.create('promotions', {
      integrationId,
      fromEnvironment: currentEnv,
      toEnvironment: opts.targetEnvironment,
      versionId: version?.id || null,
      versionNumber: version?.version || null,
      envConfig,
      actorId: opts.actorId || null,
      createdAt: new Date().toISOString(),
    });

    this.store.update('integrations', integrationId, {
      environment: opts.targetEnvironment,
      updatedAt: new Date().toISOString(),
    });

    this.store.create('changeHistory', {
      integrationId,
      versionId: version?.id || null,
      action: 'PROMOTED',
      detail: { from: currentEnv, to: opts.targetEnvironment, promotionId: promotion.id },
      createdAt: new Date().toISOString(),
    });

    return { integration: this.store.get('integrations', integrationId), promotion };
  }

  /**
   * Rollback re-activates a known historical version. Never destroys history.
   */
  rollback(integrationId: string, targetVersionId: string, actorId?: string) {
    const integration = this.store.get('integrations', integrationId);
    if (!integration) throw Object.assign(new Error('Integration not found'), { status: 404 });
    const target = this.store.get('versions', targetVersionId);
    if (!target || target.integrationId !== integrationId) {
      throw Object.assign(new Error('Target version not found'), { status: 404 });
    }

    const previousVersionId = integration.currentVersionId;
    // Keep historical versions intact; point current to known version
    this.store.update('integrations', integrationId, {
      currentVersionId: target.id,
      status: target.status === 'PUBLISHED' || target.status === 'APPROVED' ? 'APPROVED' : integration.status,
      updatedAt: new Date().toISOString(),
    });

    const history = this.store.create('changeHistory', {
      integrationId,
      versionId: target.id,
      action: 'ROLLBACK',
      detail: { fromVersionId: previousVersionId, toVersionId: target.id, actorId: actorId || null },
      createdAt: new Date().toISOString(),
    });

    return {
      integration: this.store.get('integrations', integrationId),
      rolledBackTo: { id: target.id, version: target.version },
      history,
    };
  }

  listChangeHistory(integrationId: string) {
    return this.store
      .list('changeHistory')
      .filter((h) => h.integrationId === integrationId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  listPromotions(integrationId?: string) {
    const all = this.store.list('promotions');
    return integrationId ? all.filter((p) => p.integrationId === integrationId) : all;
  }

  recordApproval(integrationId: string, versionId: string, actorId: string) {
    return this.store.create('approvals', {
      integrationId,
      versionId,
      actorId,
      decision: 'APPROVED',
      createdAt: new Date().toISOString(),
    });
  }

  countApprovals(integrationId: string, versionId: string) {
    return this.store
      .list('approvals')
      .filter((a) => a.integrationId === integrationId && a.versionId === versionId && a.decision === 'APPROVED')
      .length;
  }
}

export function createPromotionId() {
  return randomUUID();
}

export type { VisRecord };
