import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { importInstrument, loadStoredRecords, provisionRegulatoryModule, runQuality, saveRegulatoryValues } from './catalog-engine';
import { loadDpdpCatalog } from './parse-dpdp';
import { loadGdprCatalog } from './parse-gdpr';
import { getRegulatoryAccessState } from './regulatory-access';
import { createSupabaseStore } from './store';
import { runRegulatoryAiAction } from './ai-actions';

@Injectable()
export class RegulatoryService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  availability() {
    const state = getRegulatoryAccessState();
    return { ...state, instruments: ['gdpr', 'dpdp'] };
  }

  private store(authHeader: string) {
    return createSupabaseStore(this.supabase.getClientForUser(authHeader));
  }

  provision(authHeader: string, projectId: string, userId: string) {
    return provisionRegulatoryModule(this.store(authHeader), { projectId, userId });
  }

  async importInstrument(authHeader: string, projectId: string, userId: string, instrument: string) {
    const catalog = instrument === 'gdpr' ? loadGdprCatalog() : instrument === 'dpdp' ? loadDpdpCatalog() : null;
    if (!catalog) throw new Error('Instrument must be gdpr or dpdp.');
    return importInstrument(this.store(authHeader), { projectId, userId, catalog });
  }

  quality(authHeader: string, projectId: string, userId: string) {
    return runQuality(this.store(authHeader), projectId, userId);
  }

  async verifySource(authHeader: string, input: { projectId: string; userId: string; submissionId: string; decision: 'Verified' | 'Rejected'; notes: string }) {
    const store = this.store(authHeader);
    const { records } = await loadStoredRecords(store, input.projectId, input.userId);
    const record = [...records.standard, ...records.clause].find((row) => row.id === input.submissionId);
    if (!record) throw new Error('Source record was not found in this project.');
    const values = {
      ...record.values,
      source_verification_status: input.decision === 'Verified' ? 'Verified' : 'Rejected',
      human_verification_status: 'Reviewed',
      last_verified_date: new Date().toISOString().slice(0, 10),
      reviewer_comments: input.notes || record.values.reviewer_comments || '',
      lifecycle_status: input.decision === 'Verified' ? 'Verified' : 'Under Review',
    };
    await saveRegulatoryValues(store, record.formId, record.id, values);
    await store.insertAudit({
      userId: input.userId,
      eventType: 'regulatory_source_verification',
      description: `Source verification set to ${input.decision}`,
      metadata: { submissionId: record.id, sourceKey: record.sourceKey },
    });
    return { id: record.id, sourceKey: record.sourceKey, decision: input.decision };
  }

  async approveRequirement(authHeader: string, input: { projectId: string; userId: string; submissionId: string; notes: string }) {
    const store = this.store(authHeader);
    const { records } = await loadStoredRecords(store, input.projectId, input.userId);
    const record = records.requirement.find((row) => row.id === input.submissionId);
    if (!record) throw new Error('Requirement was not found in this project.');
    if (!record.values.primary_clause_source_key || !record.values.standard_source_key) {
      throw new Error('A requirement cannot be approved without a source clause and a standard.');
    }
    const values = {
      ...record.values,
      lifecycle_status: 'Approved',
      human_review_status: 'Reviewed',
      requirement_validation_status: 'Validated',
      record_approval_status: 'Approved',
    };
    await saveRegulatoryValues(store, record.formId, record.id, values, {
      status: 'approved',
      notes: input.notes || 'Approved by an authorized reviewer. This is not a compliance conclusion.',
      userId: input.userId,
    });
    await store.insertAudit({
      userId: input.userId,
      eventType: 'regulatory_requirement_approval',
      description: 'Requirement approved by a reviewer',
      metadata: { submissionId: record.id, sourceKey: record.sourceKey },
    });
    return { id: record.id, sourceKey: record.sourceKey, lifecycle: 'Approved' };
  }

  async linkPolicies(authHeader: string, input: { projectId: string; userId: string; submissionId: string; policyIds: string[] }) {
    const store = this.store(authHeader);
    const { project, records } = await loadStoredRecords(store, input.projectId, input.userId);
    const record = records.requirement.find((row) => row.id === input.submissionId);
    if (!record) throw new Error('Requirement was not found in this project.');
    const policies = await store.findPolicies(project.organizationId, input.policyIds);
    const found = new Set(policies.map((policy) => policy.id));
    const missing = input.policyIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new Error(`These policy ids are not in this organization and were not linked: ${missing.join(', ')}`);
    }
    const values = { ...record.values, related_policies: JSON.stringify(policies) };
    await saveRegulatoryValues(store, record.formId, record.id, values);
    return { linked: policies, note: 'Policies are validated against the Policy Register. Cross-reference fields cannot target the policies table.' };
  }

  async ai(authHeader: string, input: { projectId: string; userId: string; action: string; submissionId?: string; text?: string; organizationContext?: string }) {
    const store = this.store(authHeader);
    let record: Record<string, unknown> | undefined;
    if (input.submissionId) {
      const { records, project } = await loadStoredRecords(store, input.projectId, input.userId);
      const found = [...records.standard, ...records.clause, ...records.requirement].find((row) => row.id === input.submissionId);
      if (!found) throw new Error('Record was not found in this project.');
      record = found.values;
      if (input.action === 'regulatory-evidence-suggestions') {
        const policies = await store.searchPolicies(project.organizationId);
        return runRegulatoryAiAction(input.action, { record, statement: found.values.requirement_statement, policies }, (key) => this.config.get<string>(key));
      }
    }
    if (input.action === 'regulatory-quality-check') {
      const findings = await runQuality(store, input.projectId, input.userId);
      return runRegulatoryAiAction(input.action, { findings }, (key) => this.config.get<string>(key));
    }
    return runRegulatoryAiAction(input.action, {
      record,
      text: input.text,
      organizationContext: input.organizationContext,
    }, (key) => this.config.get<string>(key));
  }
}
