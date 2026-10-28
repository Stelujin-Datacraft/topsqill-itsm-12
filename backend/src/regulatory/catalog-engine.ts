import {
  CLAUSE_FIELDS,
  REGULATORY_DASHBOARD_REF,
  REGULATORY_FORM_REFS,
  REGULATORY_REPORT_REFS,
  REGULATORY_WORKFLOW_REFS,
  REQUIREMENT_FIELDS,
  STANDARD_FIELDS,
  SYSTEM_STATUS_OPTIONS,
  type FieldDef,
} from './form-definitions';
import { crossRefLink, decideWrite, qualityFindings, type StoredRecord } from './record-rules';
import type { FieldRow, FormRow, RegulatoryStore, SubmissionRow } from './store';
import { textChecksum } from './store';
import type { InstrumentCatalog } from './types';

export interface ProvisionResult {
  forms: Record<'standard' | 'clause' | 'requirement', { id: string; name: string; referenceId: string }>;
  fieldCounts: Record<string, number>;
  dashboardId: string;
  workflows: string[];
}

const FORM_SPECS = [
  {
    key: 'standard' as const,
    referenceId: REGULATORY_FORM_REFS.standard,
    name: 'Regulatory Standard Register',
    description: 'One record for each Act, regulation, or edition. Legal status, applicability, source verification, and lifecycle stay separate.',
    fields: STANDARD_FIELDS,
  },
  {
    key: 'clause' as const,
    referenceId: REGULATORY_FORM_REFS.clause,
    name: 'Regulatory Clause Register',
    description: 'One record for each chapter, article, section, paragraph, recital, or schedule unit retrieved from an official source.',
    fields: CLAUSE_FIELDS,
  },
  {
    key: 'requirement' as const,
    referenceId: REGULATORY_FORM_REFS.requirement,
    name: 'Regulatory Requirement Register',
    description: 'Draft assessable obligations derived from source clauses. A requirement is not a compliance conclusion.',
    fields: REQUIREMENT_FIELDS,
  },
];

export async function provisionRegulatoryModule(
  store: RegulatoryStore,
  input: { projectId: string; userId: string },
): Promise<ProvisionResult> {
  const project = await store.getProjectForUser(input.projectId, input.userId);
  if (!project) throw new Error('Project not found or you do not have access to it.');

  const forms: Record<string, FormRow> = {};
  for (const spec of FORM_SPECS) {
    forms[spec.key] = await store.findForm(input.projectId, spec.referenceId) || await store.insertForm({
      name: spec.name,
      description: spec.description,
      referenceId: spec.referenceId,
      projectId: project.id,
      organizationId: project.organizationId,
      createdBy: input.userId,
    });
    await ensureFields(store, forms[spec.key], spec.fields);
  }

  await wireCrossReferences(store, forms);
  const fieldCounts: Record<string, number> = {};
  for (const spec of FORM_SPECS) {
    fieldCounts[spec.key] = (await store.listFields(forms[spec.key].id)).length;
  }

  const dashboardId = await store.ensureDashboard({
    projectId: project.id,
    organizationId: project.organizationId,
    createdBy: input.userId,
    name: 'Regulatory compliance',
    referenceId: REGULATORY_DASHBOARD_REF,
  });

  const standardFields = await store.listFields(forms.standard.id);
  const clauseFields = await store.listFields(forms.clause.id);
  const requirementFields = await store.listFields(forms.requirement.id);
  const idOf = (rows: FieldRow[], key: string) => rows.find((row) => row.key === key)?.id || '';

  const reports: Array<{ referenceId: string; name: string; description: string; formId: string; columns: string[]; filter?: { field: string; operator: string; value: string } }> = [
    {
      referenceId: REGULATORY_REPORT_REFS.standards,
      name: 'Regulatory standards',
      description: 'Standards by jurisdiction and lifecycle. This is an inventory, not a compliance score.',
      formId: forms.standard.id,
      columns: ['standard_name', 'jurisdiction', 'lifecycle_status', 'legal_status', 'source_verification_status'].map((key) => idOf(standardFields, key)).filter(Boolean),
    },
    {
      referenceId: REGULATORY_REPORT_REFS.standardsAwaiting,
      name: 'Standards awaiting source verification',
      description: 'Standards whose source verification status is Awaiting Verification.',
      formId: forms.standard.id,
      columns: ['standard_name', 'source_verification_status', 'official_source_url'].map((key) => idOf(standardFields, key)).filter(Boolean),
      filter: { field: idOf(standardFields, 'source_verification_status'), operator: 'equals', value: 'Awaiting Verification' },
    },
    {
      referenceId: REGULATORY_REPORT_REFS.clauses,
      name: 'Clause inventory',
      description: 'Clauses by official identifier, type, and edition.',
      formId: forms.clause.id,
      columns: ['official_identifier', 'clause_title', 'clause_type', 'standard_edition'].map((key) => idOf(clauseFields, key)).filter(Boolean),
    },
    {
      referenceId: REGULATORY_REPORT_REFS.clausesAwaiting,
      name: 'Clauses awaiting source verification',
      description: 'Clauses not yet verified by a person.',
      formId: forms.clause.id,
      columns: ['official_identifier', 'clause_title', 'source_verification_status'].map((key) => idOf(clauseFields, key)).filter(Boolean),
      filter: { field: idOf(clauseFields, 'source_verification_status'), operator: 'equals', value: 'Awaiting Verification' },
    },
    {
      referenceId: REGULATORY_REPORT_REFS.requirements,
      name: 'Regulatory requirements',
      description: 'Draft and reviewed requirements. Assessment status is separate from legal status.',
      formId: forms.requirement.id,
      columns: ['requirement_title', 'lifecycle_status', 'human_review_status', 'applicability_status', 'source_pinpoint'].map((key) => idOf(requirementFields, key)).filter(Boolean),
    },
    {
      referenceId: REGULATORY_REPORT_REFS.aiSuggested,
      name: 'AI-suggested requirements awaiting approval',
      description: 'Requirements whose lifecycle is AI Suggested. They are not approved obligations.',
      formId: forms.requirement.id,
      columns: ['requirement_title', 'lifecycle_status', 'source_pinpoint'].map((key) => idOf(requirementFields, key)).filter(Boolean),
      filter: { field: idOf(requirementFields, 'lifecycle_status'), operator: 'equals', value: 'AI Suggested' },
    },
    {
      referenceId: REGULATORY_REPORT_REFS.humanReview,
      name: 'Requirements awaiting human review',
      description: 'Requirements whose human review status is Awaiting review.',
      formId: forms.requirement.id,
      columns: ['requirement_title', 'human_review_status', 'source_pinpoint'].map((key) => idOf(requirementFields, key)).filter(Boolean),
      filter: { field: idOf(requirementFields, 'human_review_status'), operator: 'equals', value: 'Awaiting review' },
    },
    {
      referenceId: REGULATORY_REPORT_REFS.applicability,
      name: 'Requirements with open applicability',
      description: 'Applicability status is Not decided. Presence in the catalog does not mean the requirement applies.',
      formId: forms.requirement.id,
      columns: ['requirement_title', 'applicability_status', 'jurisdiction'].map((key) => idOf(requirementFields, key)).filter(Boolean),
      filter: { field: idOf(requirementFields, 'applicability_status'), operator: 'equals', value: 'Not decided' },
    },
  ];

  for (const report of reports) {
    const filter = report.filter?.field ? report.filter : undefined;
    await store.ensureReport({
      ...report,
      filter,
      projectId: project.id,
      organizationId: project.organizationId,
      createdBy: input.userId,
      dashboardId,
    });
  }

  const workflows = [
    await store.ensureWorkflow({
      projectId: project.id,
      organizationId: project.organizationId,
      createdBy: input.userId,
      name: 'Regulatory standard review',
      referenceId: REGULATORY_WORKFLOW_REFS.standardReview,
      description: 'Notifies the submitter that a standard is waiting for source verification. It does not mark the source verified.',
      formId: forms.standard.id,
      formName: forms.standard.name,
    }),
    await store.ensureWorkflow({
      projectId: project.id,
      organizationId: project.organizationId,
      createdBy: input.userId,
      name: 'Regulatory clause review',
      referenceId: REGULATORY_WORKFLOW_REFS.sourceReview,
      description: 'Notifies the submitter that a clause is waiting for source verification. It does not mark the source verified.',
      formId: forms.clause.id,
      formName: forms.clause.name,
    }),
    await store.ensureWorkflow({
      projectId: project.id,
      organizationId: project.organizationId,
      createdBy: input.userId,
      name: 'Regulatory requirement review',
      referenceId: REGULATORY_WORKFLOW_REFS.requirementReview,
      description: 'Notifies the submitter that a requirement is waiting for human review. The stock approval action auto-approves, so it is not used.',
      formId: forms.requirement.id,
      formName: forms.requirement.name,
    }),
  ];

  await store.insertAudit({
    userId: input.userId,
    eventType: 'regulatory_provision',
    description: 'Provisioned regulatory standard, clause, and requirement forms.',
    metadata: { projectId: project.id, forms: Object.fromEntries(Object.entries(forms).map(([key, form]) => [key, form.id])) },
  });

  return {
    forms: {
      standard: { id: forms.standard.id, name: forms.standard.name, referenceId: forms.standard.referenceId },
      clause: { id: forms.clause.id, name: forms.clause.name, referenceId: forms.clause.referenceId },
      requirement: { id: forms.requirement.id, name: forms.requirement.name, referenceId: forms.requirement.referenceId },
    },
    fieldCounts,
    dashboardId,
    workflows,
  };
}

async function ensureFields(store: RegulatoryStore, form: FormRow, defs: FieldDef[]) {
  const existing = await store.listFields(form.id);
  const have = new Set(existing.map((field) => field.key));
  let order = existing.length;
  const pages = new Map<string, string[]>();
  for (const page of form.pages) pages.set(page.name, [...page.fields]);
  if (!have.has('system_status')) {
    const created = await store.insertField({
      formId: form.id,
      key: 'system_status',
      label: 'Status',
      type: 'select',
      required: true,
      order: order++,
      options: SYSTEM_STATUS_OPTIONS,
      customConfig: {
        regulatoryKey: 'system_status',
        isSystemField: true,
        displayAsLifecycle: true,
        showWithoutCondition: true,
      },
    });
    const bucket = pages.get('Identity') || [];
    bucket.push(created.id);
    pages.set('Identity', bucket);
  }
  for (const def of defs) {
    if (have.has(def.key)) continue;
    const created = await store.insertField({
      formId: form.id,
      key: def.key,
      label: def.label,
      type: def.type,
      required: Boolean(def.required),
      order: order++,
      options: def.options?.map((option, index) => ({ id: `${def.key}-${index}`, ...option })) || null,
      customConfig: {
        regulatoryKey: def.key,
        ...(def.type === 'cross-reference'
          ? { regulatoryTarget: def.target, filters: [], enableSorting: true, enableSearch: true, pageSize: 10 }
          : {}),
      },
    });
    const bucket = pages.get(def.page) || [];
    bucket.push(created.id);
    pages.set(def.page, bucket);
  }
  const pageRows = [...pages.entries()].map(([name, fieldIds], index) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    order: index,
    fields: fieldIds,
  }));
  await store.updateFormPages(form.id, pageRows);
}

async function wireCrossReferences(store: RegulatoryStore, forms: Record<string, FormRow>) {
  const fields: Record<string, FieldRow[]> = {};
  for (const key of Object.keys(forms)) fields[key] = await store.listFields(forms[key].id);

  const display = (formKey: string, keys: string[]) =>
    keys.map((key) => fields[formKey].find((field) => field.key === key)?.id).filter(Boolean) as string[];

  for (const formKey of Object.keys(fields)) {
    for (const field of fields[formKey]) {
      const targetKey = String(field.customConfig.regulatoryTarget || '');
      if (field.type !== 'cross-reference' || !targetKey || !forms[targetKey]) continue;
      const target = forms[targetKey];
      const config = {
        ...field.customConfig,
        targetFormId: target.id,
        targetFormName: target.name,
        displayColumns: display(targetKey, targetKey === 'standard'
          ? ['standard_name', 'standard_id']
          : ['official_identifier', 'clause_title']),
        filters: [],
        enableSorting: true,
        enableSearch: true,
        pageSize: 10,
        isParentReference: false,
      };
      await store.updateFieldConfig(field.id, config);
      field.customConfig = config;
      await ensureChild(store, forms[formKey], field, target, fields[targetKey], fields[formKey]);
    }
  }
}

async function ensureChild(
  store: RegulatoryStore,
  parentForm: FormRow,
  parentField: FieldRow,
  targetForm: FormRow,
  targetFields: FieldRow[],
  parentFields: FieldRow[],
) {
  const childKey = `child:${parentForm.referenceId}:${parentField.key}`;
  if (targetFields.some((field) => field.key === childKey)) return;
  const created = await store.insertField({
    formId: targetForm.id,
    key: childKey,
    label: parentField.key === 'parent_clause' ? 'Child clauses' : `References from ${parentForm.name}`,
    type: 'child-cross-reference',
    required: false,
    order: targetFields.length + 1,
    options: null,
    customConfig: {
      regulatoryKey: childKey,
      isChildField: true,
      parentFormId: parentForm.id,
      parentFieldId: parentField.id,
      parentFormName: parentForm.name,
      targetFormId: parentForm.id,
      targetFormName: parentForm.name,
      displayColumns: parentFields
        .filter((field) => field.type !== 'cross-reference' && field.type !== 'child-cross-reference')
        .map((field) => field.id)
        .slice(0, 6),
      filters: [],
      enableSorting: true,
      enableSearch: true,
      pageSize: 10,
      isParentReference: false,
    },
  });
  targetFields.push(created);
  const pages = targetForm.pages.length
    ? targetForm.pages
    : [{ id: 'identity', name: 'Identity', order: 0, fields: [] as string[] }];
  pages[0] = { ...pages[0], fields: [...pages[0].fields, created.id] };
  targetForm.pages = pages;
  await store.updateFormPages(targetForm.id, pages);
}

export interface ImportStats {
  standards: { created: number; updated: number; skipped: number; flagged: number };
  clauses: { created: number; updated: number; skipped: number; flagged: number };
  requirements: { created: number; updated: number; skipped: number; flagged: number; rejected: number };
  warnings: string[];
  coverage: InstrumentCatalog['coverage'];
}

export async function importInstrument(
  store: RegulatoryStore,
  input: { projectId: string; userId: string; catalog: InstrumentCatalog },
): Promise<ImportStats> {
  const provision = await provisionRegulatoryModule(store, input);
  const project = await store.getProjectForUser(input.projectId, input.userId);
  if (!project) throw new Error('Project not found or you do not have access to it.');
  const forms = {
    standard: await mustForm(store, input.projectId, REGULATORY_FORM_REFS.standard),
    clause: await mustForm(store, input.projectId, REGULATORY_FORM_REFS.clause),
    requirement: await mustForm(store, input.projectId, REGULATORY_FORM_REFS.requirement),
  };
  const fields = {
    standard: await store.listFields(forms.standard.id),
    clause: await store.listFields(forms.clause.id),
    requirement: await store.listFields(forms.requirement.id),
  };
  const warnings: string[] = [...input.catalog.coverage.notes];
  const standardStats = emptyStats();
  const clauseStats = emptyStats();
  const requirementStats = { ...emptyStats(), rejected: 0 };
  const caches = {
    standard: await store.listSubmissions(forms.standard.id),
    clause: await store.listSubmissions(forms.clause.id),
    requirement: await store.listSubmissions(forms.requirement.id),
  };

  const standardValues = standardValuesFromCatalog(input.catalog);
  const standardRow = await upsertRecord(store, caches.standard, {
    form: forms.standard,
    fields: fields.standard,
    sourceKey: input.catalog.standard.sourceKey,
    values: standardValues,
    kind: 'source',
    userId: input.userId,
    stats: standardStats,
  });

  const clauseIds = new Map<string, { id: string; sourceKey: string; formId: string; standardKey: string }>();
  for (const clause of input.catalog.clauses) {
    const values = clauseValues(clause);
    const saved = await upsertRecord(store, caches.clause, {
      form: forms.clause,
      fields: fields.clause,
      sourceKey: clause.sourceKey,
      values,
      kind: 'source',
      userId: input.userId,
      stats: clauseStats,
    });
    if (saved) {
      clauseIds.set(clause.sourceKey, {
        id: saved.id,
        sourceKey: clause.sourceKey,
        formId: forms.clause.id,
        standardKey: clause.standardSourceKey,
      });
    }
  }

  for (const clause of input.catalog.clauses) {
    const row = clauseIds.get(clause.sourceKey);
    const parent = clause.parentSourceKey ? clauseIds.get(clause.parentSourceKey) : undefined;
    const standard = standardRow;
    if (!row || !standard) continue;
    if (clause.parentSourceKey && !parent) {
      warnings.push(`Parent ${clause.parentSourceKey} was not imported for ${clause.officialIdentifier}.`);
    }
    if (clause.standardSourceKey !== input.catalog.standard.sourceKey) {
      warnings.push(`Clause ${clause.officialIdentifier} names a different standard and was not linked.`);
      continue;
    }
    await patchLinks(store, caches.clause, fields.clause, row.id, {
      regulatory_standard: [crossRefLink(standard)],
      parent_clause: parent ? [crossRefLink(parent)] : [],
    });
  }

  for (const requirement of input.catalog.requirements) {
    const primary = clauseIds.get(requirement.primaryClauseSourceKey);
    if (!primary || primary.standardKey !== requirement.standardSourceKey || requirement.standardSourceKey !== input.catalog.standard.sourceKey) {
      requirementStats.rejected += 1;
      warnings.push(`Rejected ${requirement.sourceKey}: source clause and standard are inconsistent or missing.`);
      continue;
    }
    const additional = requirement.additionalClauseSourceKeys.map((key) => clauseIds.get(key)).filter(Boolean) as Array<{ id: string; sourceKey: string; formId: string; standardKey: string }>;
    if (additional.some((clause) => clause.standardKey !== requirement.standardSourceKey)) {
      requirementStats.rejected += 1;
      warnings.push(`Rejected ${requirement.sourceKey}: an additional clause belongs to another standard.`);
      continue;
    }
    const saved = await upsertRecord(store, caches.requirement, {
      form: forms.requirement,
      fields: fields.requirement,
      sourceKey: requirement.sourceKey,
      values: requirementValues(requirement),
      kind: 'requirement',
      userId: input.userId,
      stats: requirementStats,
    });
    if (!saved || !standardRow) continue;
    await patchLinks(store, caches.requirement, fields.requirement, saved.id, {
      regulatory_standard: [crossRefLink(standardRow)],
      primary_source_clause: [crossRefLink(primary)],
      additional_source_clauses: additional.map(crossRefLink),
    });
  }

  const feedId = await store.ensureFeed({
    projectId: project.id,
    organizationId: project.organizationId,
    createdBy: input.userId,
    name: input.catalog.standard.name,
    referenceName: `Regulatory import ${input.catalog.standard.standardId}`,
    targetFormId: forms.standard.id,
    sourceUrl: input.catalog.standard.sourceUrl,
  });
  await store.insertFeedRun({
    feedId,
    userId: input.userId,
    status: 'completed',
    created: standardStats.created + clauseStats.created + requirementStats.created,
    updated: standardStats.updated + clauseStats.updated + requirementStats.updated,
    skipped: standardStats.skipped + clauseStats.skipped + requirementStats.skipped + standardStats.flagged + clauseStats.flagged,
    errors: requirementStats.rejected,
    log: { warnings: warnings.slice(0, 50), coverage: input.catalog.coverage, standard: input.catalog.standard.sourceKey },
  });
  await store.insertAudit({
    userId: input.userId,
    eventType: 'regulatory_import',
    description: `Imported ${input.catalog.standard.name}`,
    metadata: { sourceKey: input.catalog.standard.sourceKey, standardStats, clauseStats, requirementStats },
  });

  return {
    standards: standardStats,
    clauses: clauseStats,
    requirements: requirementStats,
    warnings: warnings.slice(0, 100),
    coverage: input.catalog.coverage,
    forms: provision.forms,
  } as ImportStats & { forms: ProvisionResult['forms'] };
}

function emptyStats() {
  return { created: 0, updated: 0, skipped: 0, flagged: 0 };
}

async function mustForm(store: RegulatoryStore, projectId: string, referenceId: string) {
  const form = await store.findForm(projectId, referenceId);
  if (!form) throw new Error(`Form ${referenceId} was not provisioned.`);
  return form;
}

function pack(fields: FieldRow[], values: Record<string, unknown>, previous?: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...(previous || {}) };
  for (const field of fields) {
    if (!field.key || values[field.key] === undefined) continue;
    data[field.id] = values[field.key];
  }
  data._regulatory = { ...((previous?._regulatory as Record<string, unknown>) || {}), ...values };
  return data;
}

async function upsertRecord(
  store: RegulatoryStore,
  cache: SubmissionRow[],
  input: {
    form: FormRow;
    fields: FieldRow[];
    sourceKey: string;
    values: Record<string, unknown>;
    kind: 'source' | 'requirement';
    userId: string;
    stats: { created: number; updated: number; skipped: number; flagged: number };
  },
): Promise<{ id: string; sourceKey: string; formId: string } | null> {
  const existing = cache.find((row) => row.sourceKey === input.sourceKey);
  const regulatory = (existing?.data._regulatory || {}) as Record<string, unknown>;
  const decision = decideWrite(existing ? {
    verification: String(regulatory.source_verification_status || ''),
    checksum: String(regulatory.source_checksum || ''),
    lifecycle: String(regulatory.lifecycle_status || ''),
    approvalStatus: existing.approvalStatus,
  } : null, { kind: input.kind, checksum: String(input.values.source_checksum || '') });

  if (decision === 'skip-approved' || decision === 'skip-verified') {
    input.stats.skipped += 1;
    return existing ? { id: existing.id, sourceKey: input.sourceKey, formId: input.form.id } : null;
  }
  if (decision === 'flag-reverify' && existing) {
    input.stats.flagged += 1;
    const values = { ...regulatory, reverification_required: 'Yes' };
    existing.data = pack(input.fields, values, existing.data);
    await store.updateSubmission(existing.id, existing.data);
    return { id: existing.id, sourceKey: input.sourceKey, formId: input.form.id };
  }
  if (existing) {
    input.stats.updated += 1;
    existing.data = pack(input.fields, input.values, existing.data);
    await store.updateSubmission(existing.id, existing.data);
    return { id: existing.id, sourceKey: input.sourceKey, formId: input.form.id };
  }
  input.stats.created += 1;
  const created = await store.insertSubmission({
    formId: input.form.id,
    sourceKey: input.sourceKey,
    data: pack(input.fields, input.values),
    approvalStatus: null,
    createdBy: input.userId,
  });
  cache.push(created);
  return { id: created.id, sourceKey: input.sourceKey, formId: input.form.id };
}

async function patchLinks(
  store: RegulatoryStore,
  cache: SubmissionRow[],
  fields: FieldRow[],
  submissionId: string,
  links: Record<string, unknown>,
) {
  const row = cache.find((item) => item.id === submissionId);
  if (!row) return;
  const regulatory = { ...((row.data._regulatory || {}) as Record<string, unknown>), ...linkSourceKeys(links) };
  const data = pack(fields, { ...regulatory, ...links }, row.data);
  await store.updateSubmission(submissionId, data);
}

function linkSourceKeys(links: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(links)) {
    if (!Array.isArray(value)) continue;
    out[`${key}_source_keys`] = value.map((item) => (item as { submission_ref_id?: string }).submission_ref_id).filter(Boolean);
  }
  return out;
}

function standardValuesFromCatalog(catalog: InstrumentCatalog): Record<string, unknown> {
  const standard = catalog.standard;
  return {
    standard_id: standard.standardId,
    standard_name: standard.name,
    standard_type: standard.standardType,
    issuing_authority: standard.issuingAuthority,
    jurisdiction: standard.jurisdiction,
    industry: standard.industry,
    publication_reference: standard.publicationReference,
    official_source_url: standard.sourceUrl,
    citation_url: standard.citationUrl,
    source_language: standard.language,
    edition: standard.edition,
    adoption_date: standard.adoptionDate || '',
    publication_date: standard.publicationDate || '',
    effective_date: standard.effectiveDate || '',
    repeal_date: standard.repealDate || '',
    legal_status: standard.legalStatus,
    commencement_status: standard.commencementStatus,
    source_verification_status: 'Awaiting Verification',
    source_retrieval_date: standard.retrievalDate,
    source_checksum: standard.checksum,
    licensing_notes: standard.licensingNotes,
    commencement_notification_reference: standard.commencementNotificationReference,
    commencement_notification_url: standard.commencementNotificationUrl,
    commencement_notification_date: standard.commencementNotificationDate || '',
    applicability_status: 'Not decided',
    record_approval_status: 'Not reviewed',
    lifecycle_status: 'Imported',
    reverification_required: 'No',
    source_key: standard.sourceKey,
    system_status: 'Pending',
    standard_source_key: standard.sourceKey,
  };
}

function clauseValues(clause: InstrumentCatalog['clauses'][number]): Record<string, unknown> {
  return {
    clause_id: clause.sourceKey,
    clause_title: clause.title,
    clause_type: clause.clauseType,
    official_identifier: clause.officialIdentifier,
    standard_edition: clause.edition,
    official_source_url: clause.sourceUrl,
    source_document_identifier: clause.standardSourceKey,
    source_location: clause.sourceLocation,
    authoritative_text: clause.text,
    source_provenance: clause.provenance,
    source_language: 'EN',
    publication_date: clause.publicationDate || '',
    effective_date: clause.effectiveDate || '',
    repeal_status: clause.repealStatus,
    legal_status: clause.legalStatus,
    commencement_status: clause.commencementStatus,
    source_verification_status: 'Awaiting Verification',
    source_checksum: textChecksum(clause.text),
    human_verification_status: 'Awaiting review',
    lifecycle_status: 'Imported',
    reverification_required: 'No',
    source_key: clause.sourceKey,
    system_status: 'Pending',
    standard_source_key: clause.standardSourceKey,
    parent_source_key: clause.parentSourceKey || '',
  };
}

function requirementValues(requirement: InstrumentCatalog['requirements'][number]): Record<string, unknown> {
  return {
    requirement_id: requirement.sourceKey,
    requirement_title: requirement.title,
    requirement_type: requirement.requirementType,
    requirement_statement: requirement.statement,
    requirement_rationale: requirement.rationale,
    requirement_classification: requirement.classification,
    source_edition: requirement.edition,
    official_source_url: requirement.sourceUrl,
    source_pinpoint: requirement.pinpoint,
    source_verification_status: 'Awaiting Verification',
    requirement_validation_status: 'Unverified candidate',
    applicability_status: 'Not decided',
    jurisdiction: requirement.jurisdiction,
    effective_date: requirement.effectiveDate || '',
    legal_status: requirement.legalStatus,
    expected_outcome: '',
    suggested_procedure: requirement.suggestedProcedure,
    suggested_evidence: requirement.suggestedEvidence,
    assessment_frequency_basis: 'Not determined',
    assessment_status: 'Not assessed',
    gap_status: 'Not assessed',
    ai_analysis_status: 'Deterministic shall-scan. No model confidence score.',
    human_review_status: 'Awaiting review',
    lifecycle_status: 'AI Suggested',
    source_key: requirement.sourceKey,
    system_status: 'Pending',
    standard_source_key: requirement.standardSourceKey,
    primary_clause_source_key: requirement.primaryClauseSourceKey,
    statement: requirement.statement,
  };
}

export async function loadStoredRecords(store: RegulatoryStore, projectId: string, userId: string) {
  const project = await store.getProjectForUser(projectId, userId);
  if (!project) throw new Error('Project not found or you do not have access to it.');
  const loaded: Record<'standard' | 'clause' | 'requirement', StoredRecord[]> = {
    standard: [],
    clause: [],
    requirement: [],
  };
  for (const key of ['standard', 'clause', 'requirement'] as const) {
    const form = await store.findForm(projectId, REGULATORY_FORM_REFS[key]);
    if (!form) continue;
    const rows = await store.listSubmissions(form.id);
    loaded[key] = rows.map(toStored);
  }
  return { project, records: loaded };
}

function toStored(row: SubmissionRow): StoredRecord {
  const regulatory = (row.data._regulatory || {}) as Record<string, unknown>;
  return {
    id: row.id,
    formId: row.formId,
    sourceKey: row.sourceKey,
    values: regulatory,
    approvalStatus: row.approvalStatus,
  };
}

export async function saveRegulatoryValues(
  store: RegulatoryStore,
  formId: string,
  submissionId: string,
  values: Record<string, unknown>,
  approval?: { status?: string; notes?: string; userId?: string },
) {
  const fields = await store.listFields(formId);
  const rows = await store.listSubmissions(formId);
  const row = rows.find((item) => item.id === submissionId);
  if (!row) throw new Error('Record was not found.');
  const data = pack(fields, values, row.data);
  await store.updateSubmission(submissionId, data, approval);
}

export async function runQuality(store: RegulatoryStore, projectId: string, userId: string) {
  const { records } = await loadStoredRecords(store, projectId, userId);
  return qualityFindings({
    standards: records.standard,
    clauses: records.clause,
    requirements: records.requirement,
  });
}
