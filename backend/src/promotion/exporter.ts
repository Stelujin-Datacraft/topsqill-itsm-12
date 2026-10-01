/**
 * Export platform configuration into a versioned package (DEV-only foundation).
 * Does not export transactional data or secrets.
 */
import { buildPackage } from './package';
import { composeKey, resolveLogicalKey } from './logical-keys';
import { scrubSecrets } from './secrets';
import type { PackagedComponent, PlatformPackage } from './types';

export interface ExportSourceProject {
  id?: string;
  name: string;
  logicalKey?: string | null;
  referenceId?: string | null;
  description?: string | null;
  status?: string;
}

export interface ExportSourceForm {
  id?: string;
  name: string;
  logicalKey?: string | null;
  referenceId?: string | null;
  description?: string | null;
  status?: string;
  pages?: unknown;
  layout?: unknown;
  formRules?: unknown;
  fieldRules?: unknown;
  fields?: Array<{
    id?: string;
    label: string;
    fieldType: string;
    logicalKey?: string | null;
    referenceId?: string | null;
    required?: boolean | null;
    options?: unknown;
    validation?: unknown;
    customConfig?: unknown;
    fieldOrder?: number | null;
  }>;
}

export interface ExportSourceWorkflow {
  id?: string;
  name: string;
  logicalKey?: string | null;
  referenceId?: string | null;
  description?: string | null;
  status?: string;
  definition?: Record<string, unknown>;
  formRefs?: string[]; // logical keys preferred
}

export interface ExportSourceRole {
  name: string;
  logicalKey?: string | null;
  description?: string | null;
  topLevelAccess?: string;
  permissions?: Array<{
    resourceType: string;
    resourceKey?: string | null; // logical key, not UUID
    permissionType: string;
  }>;
}

export interface ExportSourceReport {
  name: string;
  logicalKey?: string | null;
  referenceId?: string | null;
  description?: string | null;
  config?: Record<string, unknown>;
  formKey?: string | null;
}

export interface ExportSourceDashboard {
  name: string;
  logicalKey?: string | null;
  referenceId?: string | null;
  description?: string | null;
  layout?: unknown;
  reportKeys?: string[];
}

export interface ExportSourceIntegration {
  name: string;
  logicalKey?: string | null;
  provider?: string;
  authType?: string;
  baseUrlSlot?: string; // environment slot name, not concrete URL secrets
  credentialReferenceId?: string | null;
  mappings?: unknown;
  transformations?: unknown;
  scheduleCron?: string | null;
  /** Must be scrubbed — never exported as values */
  credentials?: Record<string, unknown>;
}

export interface ExportInput {
  packageKey: string;
  version: string;
  displayName?: string;
  createdBy?: string;
  project: ExportSourceProject;
  forms?: ExportSourceForm[];
  workflows?: ExportSourceWorkflow[];
  roles?: ExportSourceRole[];
  reports?: ExportSourceReport[];
  dashboards?: ExportSourceDashboard[];
  integrations?: ExportSourceIntegration[];
  referenceData?: Array<{
    key: string;
    domain: string;
    items: Array<{ key: string; label: string; meta?: Record<string, unknown> }>;
  }>;
  notificationTemplates?: Array<{
    key: string;
    name: string;
    channel: string;
    subject?: string;
    body?: string;
    trigger?: string;
  }>;
}

export function exportPlatformPackage(input: ExportInput): PlatformPackage {
  const projectKey = resolveLogicalKey({
    logicalKey: input.project.logicalKey,
    referenceId: input.project.referenceId,
    name: input.project.name,
    namespace: input.packageKey,
  });

  const components: PackagedComponent[] = [];

  components.push({
    kind: 'project',
    key: projectKey,
    classification: 'PLATFORM_CONFIGURATION',
    definition: scrubSecrets({
      name: input.project.name,
      description: input.project.description || null,
      status: input.project.status || 'active',
    }),
    dependsOn: [],
  });

  for (const form of input.forms || []) {
    const formKey = resolveLogicalKey({
      logicalKey: form.logicalKey,
      referenceId: form.referenceId,
      name: form.name,
      namespace: projectKey,
    });
    components.push({
      kind: 'form',
      key: formKey,
      classification: 'PLATFORM_CONFIGURATION',
      definition: scrubSecrets({
        name: form.name,
        description: form.description || null,
        status: form.status || 'draft',
        pages: form.pages ?? null,
        layout: form.layout ?? null,
        formRules: form.formRules ?? null,
        fieldRules: form.fieldRules ?? null,
      }),
      dependsOn: [{ kind: 'project', key: projectKey }],
    });

    for (const field of form.fields || []) {
      const fieldKey = resolveLogicalKey({
        logicalKey: field.logicalKey,
        referenceId: field.referenceId,
        name: field.label,
        namespace: formKey,
      });
      components.push({
        kind: 'form_field',
        key: fieldKey,
        classification: 'PLATFORM_CONFIGURATION',
        definition: scrubSecrets({
          label: field.label,
          fieldType: field.fieldType,
          required: !!field.required,
          options: field.options ?? null,
          validation: field.validation ?? null,
          customConfig: field.customConfig ?? null,
          fieldOrder: field.fieldOrder ?? null,
          formKey,
        }),
        dependsOn: [{ kind: 'form', key: formKey }],
      });
    }
  }

  for (const wf of input.workflows || []) {
    const wfKey = resolveLogicalKey({
      logicalKey: wf.logicalKey,
      referenceId: wf.referenceId,
      name: wf.name,
      namespace: projectKey,
    });
    const dependsOn = [
      { kind: 'project' as const, key: projectKey },
      ...(wf.formRefs || []).map((k) => ({ kind: 'form' as const, key: k })),
    ];
    components.push({
      kind: 'workflow',
      key: wfKey,
      classification: 'PLATFORM_CONFIGURATION',
      definition: scrubSecrets({
        name: wf.name,
        description: wf.description || null,
        status: wf.status || 'draft',
        definition: wf.definition || {},
        formRefs: wf.formRefs || [],
      }),
      dependsOn,
    });
  }

  for (const role of input.roles || []) {
    const roleKey = resolveLogicalKey({
      logicalKey: role.logicalKey,
      name: role.name,
      namespace: projectKey,
    });
    components.push({
      kind: 'role',
      key: roleKey,
      classification: 'PLATFORM_CONFIGURATION',
      definition: scrubSecrets({
        name: role.name,
        description: role.description || null,
        topLevelAccess: role.topLevelAccess || 'no_access',
        permissions: (role.permissions || []).map((p) => ({
          resourceType: p.resourceType,
          resourceKey: p.resourceKey || null,
          permissionType: p.permissionType,
        })),
      }),
      dependsOn: [{ kind: 'project', key: projectKey }],
    });
  }

  for (const report of input.reports || []) {
    const reportKey = resolveLogicalKey({
      logicalKey: report.logicalKey,
      referenceId: report.referenceId,
      name: report.name,
      namespace: projectKey,
    });
    components.push({
      kind: 'report',
      key: reportKey,
      classification: 'PLATFORM_CONFIGURATION',
      definition: scrubSecrets({
        name: report.name,
        description: report.description || null,
        config: report.config || {},
        formKey: report.formKey || null,
      }),
      dependsOn: [
        { kind: 'project', key: projectKey },
        ...(report.formKey ? [{ kind: 'form' as const, key: report.formKey }] : []),
      ],
    });
  }

  for (const dash of input.dashboards || []) {
    const dashKey = resolveLogicalKey({
      logicalKey: dash.logicalKey,
      referenceId: dash.referenceId,
      name: dash.name,
      namespace: projectKey,
    });
    components.push({
      kind: 'dashboard',
      key: dashKey,
      classification: 'PLATFORM_CONFIGURATION',
      definition: scrubSecrets({
        name: dash.name,
        description: dash.description || null,
        layout: dash.layout ?? null,
        reportKeys: dash.reportKeys || [],
      }),
      dependsOn: [
        { kind: 'project', key: projectKey },
        ...(dash.reportKeys || []).map((k) => ({ kind: 'report' as const, key: k })),
      ],
    });
  }

  for (const integ of input.integrations || []) {
    const integKey = resolveLogicalKey({
      logicalKey: integ.logicalKey,
      name: integ.name,
      namespace: projectKey,
    });
    components.push({
      kind: 'integration',
      key: integKey,
      classification: 'PLATFORM_CONFIGURATION',
      definition: scrubSecrets({
        name: integ.name,
        provider: integ.provider || 'generic_http',
        authType: integ.authType || 'api_key',
        baseUrlSlot: integ.baseUrlSlot || 'INTEGRATION_BASE_URL',
        credentialReferenceId: integ.credentialReferenceId || null,
        mappings: integ.mappings ?? null,
        transformations: integ.transformations ?? null,
        scheduleCron: integ.scheduleCron ?? null,
        // credentials intentionally scrubbed
        credentials: integ.credentials || {},
      }),
      dependsOn: [{ kind: 'project', key: projectKey }],
      environmentSlots: ['INTEGRATION_BASE_URL', 'credentialReferenceId'],
    });
  }

  for (const rd of input.referenceData || []) {
    const domainKey = composeKey(projectKey, rd.domain);
    components.push({
      kind: 'reference_data',
      key: rd.key.includes('.') ? rd.key : composeKey(domainKey, rd.key),
      classification: 'REFERENCE_DATA',
      definition: {
        domain: rd.domain,
        items: rd.items,
      },
      dependsOn: [{ kind: 'project', key: projectKey }],
    });
  }

  for (const n of input.notificationTemplates || []) {
    components.push({
      kind: 'notification_template',
      key: n.key.includes('.') ? n.key : composeKey(projectKey, n.key),
      classification: 'PLATFORM_CONFIGURATION',
      definition: scrubSecrets({
        name: n.name,
        channel: n.channel,
        subject: n.subject || null,
        body: n.body || null,
        trigger: n.trigger || null,
      }),
      dependsOn: [{ kind: 'project', key: projectKey }],
      environmentSlots: ['NOTIFICATION_DESTINATION'],
    });
  }

  return buildPackage(components, {
    key: input.packageKey,
    version: input.version,
    displayName: input.displayName,
    createdBy: input.createdBy,
  });
}
