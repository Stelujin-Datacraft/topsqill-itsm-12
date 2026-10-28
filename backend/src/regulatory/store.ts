import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectAccess {
  id: string;
  organizationId: string;
}

export interface FormRow {
  id: string;
  name: string;
  referenceId: string;
  projectId: string;
  organizationId: string;
  pages: Array<{ id: string; name: string; order: number; fields: string[] }>;
}

export interface FieldRow {
  id: string;
  formId: string;
  key: string;
  label: string;
  type: string;
  customConfig: Record<string, unknown>;
}

export interface SubmissionRow {
  id: string;
  formId: string;
  sourceKey: string;
  data: Record<string, unknown>;
  approvalStatus: string | null;
}

export interface RegulatoryStore {
  getProjectForUser(projectId: string, userId: string): Promise<ProjectAccess | null>;
  findForm(projectId: string, referenceId: string): Promise<FormRow | null>;
  insertForm(row: Omit<FormRow, 'id' | 'pages'> & { description: string; createdBy: string }): Promise<FormRow>;
  updateFormPages(formId: string, pages: FormRow['pages']): Promise<void>;
  listFields(formId: string): Promise<FieldRow[]>;
  insertField(row: Omit<FieldRow, 'id'> & { required: boolean; order: number; options: unknown }): Promise<FieldRow>;
  updateFieldConfig(fieldId: string, customConfig: Record<string, unknown>): Promise<void>;
  listSubmissions(formId: string): Promise<SubmissionRow[]>;
  insertSubmission(row: Omit<SubmissionRow, 'id'> & { createdBy: string }): Promise<SubmissionRow>;
  updateSubmission(id: string, data: Record<string, unknown>, approval?: { status?: string; notes?: string; userId?: string }): Promise<void>;
  findPolicies(organizationId: string, ids: string[]): Promise<Array<{ id: string; name: string }>>;
  searchPolicies(organizationId: string): Promise<Array<{ id: string; name: string; reference: string }>>;
  insertAudit(row: { userId: string; eventType: string; description: string; metadata: Record<string, unknown> }): Promise<void>;
  insertFormAudit(row: { userId: string; formId: string; formName: string; eventType: string; description: string; metadata: Record<string, unknown> }): Promise<void>;
  ensureFeed(row: { projectId: string; organizationId: string; createdBy: string; name: string; referenceName: string; targetFormId: string; sourceUrl: string }): Promise<string>;
  insertFeedRun(row: { feedId: string; userId: string; status: string; created: number; updated: number; skipped: number; errors: number; log: unknown }): Promise<void>;
  ensureWorkflow(row: { projectId: string; organizationId: string; createdBy: string; name: string; referenceId: string; description: string; formId: string; formName: string }): Promise<string>;
  ensureReport(row: { projectId: string; organizationId: string; createdBy: string; dashboardId: string; name: string; referenceId: string; description: string; formId: string; columns: string[]; filter?: { field: string; operator: string; value: string } }): Promise<void>;
  ensureDashboard(row: { projectId: string; organizationId: string; createdBy: string; name: string; referenceId: string }): Promise<string>;
}

export function textChecksum(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createMemoryStore(): RegulatoryStore & {
  forms: FormRow[];
  fields: FieldRow[];
  submissions: SubmissionRow[];
  audits: unknown[];
  feedRuns: unknown[];
} {
  const forms: FormRow[] = [];
  const fields: FieldRow[] = [];
  const submissions: SubmissionRow[] = [];
  const audits: unknown[] = [];
  const feedRuns: unknown[] = [];
  const feeds = new Map<string, string>();
  const workflows = new Set<string>();
  const reports = new Set<string>();
  const dashboards = new Map<string, string>();
  let n = 1;
  const id = () => `mem-${n++}`;
  const projects = new Map<string, ProjectAccess>();

  return {
    forms,
    fields,
    submissions,
    audits,
    feedRuns,
    async getProjectForUser(projectId: string) {
      if (!projects.has(projectId)) {
        projects.set(projectId, { id: projectId, organizationId: `org-${projectId}` });
      }
      return projects.get(projectId) || null;
    },
    async findForm(projectId, referenceId) {
      return forms.find((form) => form.projectId === projectId && form.referenceId === referenceId) || null;
    },
    async insertForm(row) {
      const form: FormRow = {
        id: id(),
        name: row.name,
        referenceId: row.referenceId,
        projectId: row.projectId,
        organizationId: row.organizationId,
        pages: [],
      };
      forms.push(form);
      return form;
    },
    async updateFormPages(formId, pages) {
      const form = forms.find((item) => item.id === formId);
      if (form) form.pages = pages;
    },
    async listFields(formId) {
      return fields.filter((field) => field.formId === formId);
    },
    async insertField(row) {
      const field: FieldRow = {
        id: id(),
        formId: row.formId,
        key: row.key,
        label: row.label,
        type: row.type,
        customConfig: row.customConfig,
      };
      fields.push(field);
      return field;
    },
    async updateFieldConfig(fieldId, customConfig) {
      const field = fields.find((item) => item.id === fieldId);
      if (field) field.customConfig = customConfig;
    },
    async listSubmissions(formId) {
      return submissions.filter((row) => row.formId === formId);
    },
    async insertSubmission(row) {
      const saved: SubmissionRow = {
        id: id(),
        formId: row.formId,
        sourceKey: row.sourceKey,
        data: row.data,
        approvalStatus: row.approvalStatus,
      };
      submissions.push(saved);
      return saved;
    },
    async updateSubmission(submissionId, data, approval) {
      const row = submissions.find((item) => item.id === submissionId);
      if (!row) return;
      row.data = data;
      if (approval?.status) row.approvalStatus = approval.status;
    },
    async findPolicies(_organizationId, ids) {
      return ids.filter((value) => value.startsWith('policy-')).map((value) => ({ id: value, name: value }));
    },
    async searchPolicies() {
      return [{ id: 'policy-1', name: 'Privacy notice policy', reference: 'GDPR' }];
    },
    async insertAudit(row) {
      audits.push(row);
    },
    async insertFormAudit(row) {
      audits.push(row);
    },
    async ensureFeed(row) {
      const key = `${row.projectId}:${row.referenceName}`;
      if (!feeds.has(key)) feeds.set(key, id());
      return feeds.get(key)!;
    },
    async insertFeedRun(row) {
      feedRuns.push(row);
    },
    async ensureWorkflow(row) {
      workflows.add(row.referenceId);
      return row.referenceId;
    },
    async ensureReport(row) {
      reports.add(row.referenceId);
    },
    async ensureDashboard(row) {
      if (!dashboards.has(row.referenceId)) dashboards.set(row.referenceId, id());
      return dashboards.get(row.referenceId)!;
    },
  };
}

function asConfig(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
}

function asPages(value: unknown): FormRow['pages'] {
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(raw) ? raw : [];
}

export function createSupabaseStore(client: SupabaseClient): RegulatoryStore {
  return {
    async getProjectForUser(projectId, userId) {
      const { data: project, error } = await client
        .from('projects')
        .select('id, organization_id')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!project?.organization_id) return null;
      const { data: member, error: memberError } = await client
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (memberError) throw new Error(memberError.message);
      if (member) return { id: project.id, organizationId: project.organization_id };
      const { data: profile } = await client
        .from('user_profiles')
        .select('role, organization_id')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.role === 'admin' && profile.organization_id === project.organization_id) {
        return { id: project.id, organizationId: project.organization_id };
      }
      return null;
    },
    async findForm(projectId, referenceId) {
      const { data, error } = await client
        .from('forms')
        .select('id, name, reference_id, project_id, organization_id, pages')
        .eq('project_id', projectId)
        .eq('reference_id', referenceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        referenceId: data.reference_id || referenceId,
        projectId: data.project_id,
        organizationId: data.organization_id || '',
        pages: asPages(data.pages),
      };
    },
    async insertForm(row) {
      const { data, error } = await client
        .from('forms')
        .insert({
          name: row.name,
          description: row.description,
          organization_id: row.organizationId,
          project_id: row.projectId,
          status: 'active',
          reference_id: row.referenceId,
          created_by: row.createdBy,
          is_public: false,
          pages: [],
        })
        .select('id, name, reference_id, project_id, organization_id, pages')
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to create form');
      return {
        id: data.id,
        name: data.name,
        referenceId: data.reference_id || row.referenceId,
        projectId: data.project_id,
        organizationId: data.organization_id || row.organizationId,
        pages: [],
      };
    },
    async updateFormPages(formId, pages) {
      const { error } = await client.from('forms').update({ pages }).eq('id', formId);
      if (error) throw new Error(error.message);
    },
    async listFields(formId) {
      const { data, error } = await client
        .from('form_fields')
        .select('id, form_id, label, field_type, custom_config')
        .eq('form_id', formId);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => {
        const config = asConfig(row.custom_config);
        return {
          id: row.id,
          formId: row.form_id || formId,
          key: String(config.regulatoryKey || ''),
          label: row.label,
          type: row.field_type,
          customConfig: config,
        };
      });
    },
    async insertField(row) {
      const { data, error } = await client
        .from('form_fields')
        .insert({
          form_id: row.formId,
          field_type: row.type,
          label: row.label,
          required: row.required,
          field_order: row.order,
          is_visible: true,
          is_enabled: true,
          options: row.options,
          permissions: { read: ['*'], write: ['*'] },
          custom_config: row.customConfig,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message || `Failed to create field ${row.label}`);
      return {
        id: data.id,
        formId: row.formId,
        key: row.key,
        label: row.label,
        type: row.type,
        customConfig: row.customConfig,
      };
    },
    async updateFieldConfig(fieldId, customConfig) {
      const { error } = await client.from('form_fields').update({ custom_config: customConfig }).eq('id', fieldId);
      if (error) throw new Error(error.message);
    },
    async listSubmissions(formId) {
      const rows: SubmissionRow[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: page, error } = await client
          .from('form_submissions')
          .select('id, form_id, submission_ref_id, submission_data, approval_status')
          .eq('form_id', formId)
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        for (const row of page || []) {
          rows.push({
            id: row.id,
            formId: row.form_id || formId,
            sourceKey: row.submission_ref_id || '',
            data: (row.submission_data || {}) as Record<string, unknown>,
            approvalStatus: row.approval_status,
          });
        }
        if (!page || page.length < pageSize) break;
      }
      return rows;
    },
    async insertSubmission(row) {
      const { data, error } = await client
        .from('form_submissions')
        .insert({
          form_id: row.formId,
          submission_ref_id: row.sourceKey,
          submission_data: row.data,
          submitted_by: row.createdBy,
          approval_status: row.approvalStatus,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to create submission');
      return { id: data.id, formId: row.formId, sourceKey: row.sourceKey, data: row.data, approvalStatus: row.approvalStatus };
    },
    async updateSubmission(submissionId, data, approval) {
      const patch: Record<string, unknown> = { submission_data: data };
      if (approval?.status) {
        patch.approval_status = approval.status;
        patch.approval_notes = approval.notes || null;
        patch.approved_by = approval.userId || null;
        patch.approval_timestamp = new Date().toISOString();
      }
      const { error } = await client.from('form_submissions').update(patch).eq('id', submissionId);
      if (error) throw new Error(error.message);
    },
    async findPolicies(organizationId, ids) {
      if (!ids.length) return [];
      const { data, error } = await client
        .from('policies')
        .select('id, name, organization_id')
        .eq('organization_id', organizationId)
        .in('id', ids);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({ id: row.id, name: row.name }));
    },
    async searchPolicies(organizationId) {
      const { data, error } = await client
        .from('policies')
        .select('id, name, compliance_reference, compliance_standard')
        .eq('organization_id', organizationId)
        .limit(50);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        reference: [row.compliance_reference, row.compliance_standard].filter(Boolean).join(' '),
      }));
    },
    async insertAudit(row) {
      const { error } = await client.from('audit_logs').insert({
        user_id: row.userId,
        event_type: row.eventType,
        event_category: 'regulatory',
        description: row.description,
        metadata: row.metadata,
      });
      if (error) throw new Error(error.message);
    },
    async insertFormAudit(row) {
      const { error } = await client.from('form_audit_logs').insert({
        user_id: row.userId,
        form_id: row.formId,
        form_name: row.formName,
        event_type: row.eventType,
        description: row.description,
        metadata: row.metadata,
      });
      if (error) throw new Error(error.message);
    },
    async ensureFeed(row) {
      const { data: existing } = await client
        .from('data_feeds')
        .select('id, name')
        .eq('project_id', row.projectId)
        .eq('name', row.referenceName)
        .maybeSingle();
      if (existing?.id) return existing.id;
      const { data, error } = await client
        .from('data_feeds')
        .insert({
          name: row.referenceName,
          description: `Official source pointer for ${row.name}. The regulatory importer writes run history. The generic feed runner is left inactive because it cannot parse this legal text.`,
          project_id: row.projectId,
          organization_id: row.organizationId,
          created_by: row.createdBy,
          target_form_id: row.targetFormId,
          source_type: 'http_api',
          is_active: false,
          field_mappings: [],
          external_source_config: { url: row.sourceUrl, regulatory: true },
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to create data feed');
      return data.id;
    },
    async insertFeedRun(row) {
      const { error } = await client.from('data_feed_runs').insert({
        data_feed_id: row.feedId,
        status: row.status,
        triggered_by: row.userId,
        records_created: row.created,
        records_updated: row.updated,
        records_skipped: row.skipped,
        errors_count: row.errors,
        records_processed: row.created + row.updated + row.skipped,
        run_log: row.log as never,
        completed_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    async ensureWorkflow(row) {
      const { data: existing } = await client
        .from('workflows')
        .select('id')
        .eq('project_id', row.projectId)
        .eq('reference_id', row.referenceId)
        .maybeSingle();
      let workflowId = existing?.id as string | undefined;
      if (!workflowId) {
        const { data, error } = await client
          .from('workflows')
          .insert({
            name: row.name,
            description: row.description,
            project_id: row.projectId,
            organization_id: row.organizationId,
            created_by: row.createdBy,
            reference_id: row.referenceId,
            status: 'active',
          })
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message || 'Failed to create workflow');
        workflowId = data.id;
        const startId = crypto.randomUUID();
        const notifyId = crypto.randomUUID();
        const endId = crypto.randomUUID();
        const nodes = [
          {
            id: startId,
            workflow_id: workflowId,
            node_type: 'start',
            label: 'Record submitted',
            position_x: 80,
            position_y: 80,
            config: { triggerType: 'form_submission', triggerFormId: row.formId, triggerFormName: row.formName },
          },
          {
            id: notifyId,
            workflow_id: workflowId,
            node_type: 'action',
            label: 'Notify submitter',
            position_x: 320,
            position_y: 80,
            config: {
              actionType: 'send_notification',
              notificationConfig: {
                subject: row.name,
                message: 'This regulatory record is waiting for a person to review it. This workflow does not approve it.',
                recipientConfig: { type: 'form_submitter' },
              },
            },
          },
          {
            id: endId,
            workflow_id: workflowId,
            node_type: 'end',
            label: 'Stop',
            position_x: 560,
            position_y: 80,
            config: {},
          },
        ];
        const { error: nodeError } = await client.from('workflow_nodes').insert(nodes);
        if (nodeError) throw new Error(nodeError.message);
        const { error: linkError } = await client.from('workflow_connections').insert([
          { workflow_id: workflowId, source_node_id: startId, target_node_id: notifyId },
          { workflow_id: workflowId, source_node_id: notifyId, target_node_id: endId },
        ]);
        if (linkError) throw new Error(linkError.message);
        const { error: triggerError } = await client.from('workflow_triggers').insert({
          organization_id: row.organizationId,
          trigger_id: `${workflowId}_onFormSubmit_${row.formId}`,
          target_workflow_id: workflowId,
          trigger_type: 'onFormSubmit',
          source_form_id: row.formId,
          created_by: row.createdBy,
          is_active: true,
          metadata: { regulatory: true },
        });
        if (triggerError) throw new Error(triggerError.message);
      } else {
        const triggerId = `${workflowId}_onFormSubmit_${row.formId}`;
        const { data: existingTrigger, error: lookupError } = await client
          .from('workflow_triggers')
          .select('id')
          .eq('trigger_id', triggerId)
          .maybeSingle();
        if (lookupError) throw new Error(lookupError.message);
        if (!existingTrigger) {
          const { error: triggerError } = await client.from('workflow_triggers').insert({
            organization_id: row.organizationId,
            trigger_id: triggerId,
            target_workflow_id: workflowId,
            trigger_type: 'onFormSubmit',
            source_form_id: row.formId,
            created_by: row.createdBy,
            is_active: true,
            metadata: { regulatory: true },
          });
          if (triggerError) throw new Error(triggerError.message);
        }
      }
      return workflowId;
    },
    async ensureDashboard(row) {
      const { data: existing } = await client
        .from('dashboards')
        .select('id')
        .eq('project_id', row.projectId)
        .eq('reference_id', row.referenceId)
        .maybeSingle();
      if (existing?.id) return existing.id;
      const { data, error } = await client
        .from('dashboards')
        .insert({
          name: row.name,
          description: 'Regulatory standards, clauses, and draft requirements. A passing control is not a compliance conclusion.',
          project_id: row.projectId,
          organization_id: row.organizationId,
          created_by: row.createdBy,
          reference_id: row.referenceId,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to create dashboard');
      return data.id;
    },
    async ensureReport(row) {
      const { data: existing } = await client
        .from('reports')
        .select('id')
        .eq('project_id', row.projectId)
        .eq('reference_id', row.referenceId)
        .maybeSingle();
      if (existing?.id) return;
      const { data, error } = await client
        .from('reports')
        .insert({
          name: row.name,
          description: row.description,
          project_id: row.projectId,
          organization_id: row.organizationId,
          created_by: row.createdBy,
          reference_id: row.referenceId,
          dashboard_id: row.dashboardId,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to create report');
      const { error: componentError } = await client.from('report_components').insert({
        report_id: data.id,
        type: 'table',
        config: {
          title: row.name,
          type: 'table',
          formId: row.formId,
          selectedColumns: row.columns,
          filters: row.filter ? [row.filter] : [],
          enableSearch: true,
          enableSorting: true,
          enableFiltering: true,
        },
        layout: { x: 0, y: 0, w: 12, h: 8 },
      });
      if (componentError) throw new Error(componentError.message);
    },
  };
}
