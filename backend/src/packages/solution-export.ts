import { sanitizeEnvSpecific } from '../promotion/engines/env-values';
import { objectKey, type PackageObject } from './spec';

type Row = Record<string, any> & { id: string };

export interface SolutionExportRows {
  solution: Row;
  formIds: string[];
  forms: Row[];
  fields: Row[];
  workflows: Row[];
  nodes: Row[];
  connections: Row[];
  triggers: Row[];
  reports: Row[];
  components: Row[];
}

/** Owner, tenant and audit columns mean nothing in another organisation, and role/user ids do not exist there. */
const LOCAL_COLUMNS = [
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'organization_id',
  'project_id',
  'permissions',
  'share_settings',
  'dashboard_id',
  'current_value',
  'last_executed_at',
  'execution_count',
];

export function portableRow(row: Row, objectType: string): Row {
  const copy: Row = { ...row };
  for (const column of LOCAL_COLUMNS) delete copy[column];
  const { portable } = sanitizeEnvSpecific(objectType, copy);
  return portable as Row;
}

const mentionsAny = (value: unknown, ids: Set<string>) => {
  if (!ids.size || value === null || value === undefined) return false;
  const text = (typeof value === 'string' ? value : JSON.stringify(value)).toLowerCase();
  for (const id of ids) if (text.includes(id)) return true;
  return false;
};

export interface SolutionExportSummary {
  forms: number;
  fields: number;
  workflows: number;
  reports: number;
  stripped: number;
}

/**
 * A solution package holds the solution, its forms with fields, every workflow that reads or is
 * triggered by those forms, and every report built on them. Records and run history are never included.
 */
export function buildSolutionObjects(rows: SolutionExportRows): { objects: PackageObject[]; summary: SolutionExportSummary } {
  const formIds = new Set(rows.formIds.map((id) => id.toLowerCase()));
  const forms = rows.forms.filter((form) => formIds.has(form.id.toLowerCase()));

  const triggers = rows.triggers.filter((t) => t.source_form_id && formIds.has(String(t.source_form_id).toLowerCase()));
  const triggeredWorkflowIds = new Set(triggers.map((t) => String(t.target_workflow_id).toLowerCase()));
  const nodesByWorkflow = new Map<string, Row[]>();
  for (const node of rows.nodes) {
    const list = nodesByWorkflow.get(node.workflow_id) || [];
    list.push(node);
    nodesByWorkflow.set(node.workflow_id, list);
  }
  const workflows = rows.workflows.filter(
    (workflow) =>
      triggeredWorkflowIds.has(workflow.id.toLowerCase())
      || (nodesByWorkflow.get(workflow.id) || []).some((node) => mentionsAny(node.config, formIds)),
  );

  const componentsByReport = new Map<string, Row[]>();
  for (const component of rows.components) {
    const list = componentsByReport.get(component.report_id) || [];
    list.push(component);
    componentsByReport.set(component.report_id, list);
  }
  const reports = rows.reports.filter(
    (report) =>
      mentionsAny(portableRow(report, 'report'), formIds)
      || (componentsByReport.get(report.id) || []).some((c) => mentionsAny(c.config, formIds) || mentionsAny(c.layout, formIds)),
  );

  let stripped = 0;
  const clean = (row: Row, type: string) => {
    const before = Object.keys(row).length;
    const out = portableRow(row, type);
    stripped += Math.max(0, before - Object.keys(out).length);
    return out;
  };

  const objects: PackageObject[] = [
    {
      type: 'solution',
      key: objectKey('solution', rows.solution.id),
      name: rows.solution.name,
      data: {
        solution: { id: rows.solution.id, name: rows.solution.name, color: rows.solution.color ?? null, description: rows.solution.description ?? null },
        formIds: forms.map((form) => form.id),
      },
    },
    ...forms.map((form) => ({
      type: 'form' as const,
      key: objectKey('form', form.id),
      name: String(form.name),
      data: {
        form: clean(form, 'form'),
        fields: rows.fields
          .filter((field) => field.form_id === form.id)
          .sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0))
          .map((field) => clean(field, 'form_field')),
      },
    })),
    ...workflows.map((workflow) => ({
      type: 'workflow' as const,
      key: objectKey('workflow', workflow.id),
      name: String(workflow.name),
      data: {
        workflow: clean(workflow, 'workflow'),
        nodes: (nodesByWorkflow.get(workflow.id) || []).map((node) => clean(node, 'workflow')),
        connections: rows.connections.filter((c) => c.workflow_id === workflow.id).map((c) => clean(c, 'workflow')),
        triggers: triggers.filter((t) => t.target_workflow_id === workflow.id).map((t) => clean(t, 'workflow')),
      },
    })),
    ...reports.map((report) => ({
      type: 'report' as const,
      key: objectKey('report', report.id),
      name: String(report.name),
      data: {
        report: clean(report, 'report'),
        components: (componentsByReport.get(report.id) || []).map((c) => clean(c, 'report')),
      },
    })),
  ];

  return {
    objects,
    summary: {
      forms: forms.length,
      fields: objects.filter((o) => o.type === 'form').reduce((n, o) => n + ((o.data as any).fields?.length || 0), 0),
      workflows: workflows.length,
      reports: reports.length,
      stripped,
    },
  };
}
