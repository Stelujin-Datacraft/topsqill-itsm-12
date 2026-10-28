export interface StoredRecord {
  id: string;
  formId: string;
  sourceKey: string;
  values: Record<string, unknown>;
  approvalStatus: string | null;
}

export type WriteDecision = 'insert' | 'update' | 'skip-verified' | 'skip-approved' | 'flag-reverify';

export function decideWrite(
  existing: { verification?: string; checksum?: string; lifecycle?: string; approvalStatus?: string | null } | null,
  incoming: { kind: 'source' | 'requirement'; checksum?: string },
): WriteDecision {
  if (!existing) return 'insert';
  if (incoming.kind === 'requirement' && (existing.lifecycle === 'Approved' || existing.approvalStatus === 'approved')) {
    return 'skip-approved';
  }
  if (incoming.kind === 'source' && existing.verification === 'Verified') {
    if (existing.checksum && incoming.checksum && existing.checksum !== incoming.checksum) return 'flag-reverify';
    return 'skip-verified';
  }
  return 'update';
}

export function crossRefLink(record: { id: string; sourceKey: string; formId: string }) {
  return {
    id: record.id,
    submission_ref_id: record.sourceKey,
    form_id: record.formId,
  };
}

export function sameStandard(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left === right);
}

export interface QualityFinding {
  code: string;
  sourceKey: string;
  message: string;
}

export function qualityFindings(input: {
  standards: StoredRecord[];
  clauses: StoredRecord[];
  requirements: StoredRecord[];
}): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const standardKeys = new Set(input.standards.map((row) => row.sourceKey));
  const clauseByKey = new Map(input.clauses.map((row) => [row.sourceKey, row]));
  const statements = new Map<string, string[]>();

  for (const clause of input.clauses) {
    const standard = String(clause.values.standard_source_key || '');
    if (!standard || !standardKeys.has(standard)) {
      findings.push({
        code: 'clause-missing-standard',
        sourceKey: clause.sourceKey,
        message: 'Clause has no resolved Regulatory Standard record.',
      });
    }
    if (clause.values.source_verification_status === 'Awaiting Verification') {
      findings.push({
        code: 'clause-awaiting-verification',
        sourceKey: clause.sourceKey,
        message: 'Clause source text is awaiting human verification.',
      });
    }
  }

  const clausesWithRequirements = new Set<string>();
  for (const requirement of input.requirements) {
    const primary = String(requirement.values.primary_clause_source_key || '');
    const standard = String(requirement.values.standard_source_key || '');
    if (!primary || !clauseByKey.has(primary)) {
      findings.push({
        code: 'requirement-missing-clause',
        sourceKey: requirement.sourceKey,
        message: 'Requirement has no resolved primary source clause.',
      });
    }
    if (!standard || !standardKeys.has(standard)) {
      findings.push({
        code: 'requirement-missing-standard',
        sourceKey: requirement.sourceKey,
        message: 'Requirement has no resolved Regulatory Standard.',
      });
    }
    const clause = clauseByKey.get(primary);
    if (clause && standard && String(clause.values.standard_source_key || '') !== standard) {
      findings.push({
        code: 'requirement-standard-conflict',
        sourceKey: requirement.sourceKey,
        message: 'Requirement Standard does not match the primary clause Standard.',
      });
    }
    if (!String(requirement.values.statement || '').trim()) {
      findings.push({
        code: 'requirement-empty-statement',
        sourceKey: requirement.sourceKey,
        message: 'Requirement statement is empty.',
      });
    }
    if (requirement.values.lifecycle_status === 'AI Suggested' || requirement.values.human_review_status === 'Awaiting review') {
      findings.push({
        code: 'requirement-awaiting-review',
        sourceKey: requirement.sourceKey,
        message: 'AI or draft requirement is still awaiting human review.',
      });
    }
    if (requirement.values.applicability_status === 'Not decided') {
      findings.push({
        code: 'requirement-applicability-open',
        sourceKey: requirement.sourceKey,
        message: 'Applicability has not been decided.',
      });
    }
    if (!String(requirement.values.expected_outcome || '').trim()) {
      findings.push({
        code: 'requirement-missing-outcome',
        sourceKey: requirement.sourceKey,
        message: 'No assessment outcome is recorded. The suggested procedure is not an outcome.',
      });
    }
    const normalized = String(requirement.values.statement || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized) {
      const bucket = statements.get(normalized) || [];
      bucket.push(requirement.sourceKey);
      statements.set(normalized, bucket);
    }
    if (primary) clausesWithRequirements.add(primary);
  }

  for (const [statement, keys] of statements) {
    if (keys.length < 2) continue;
    findings.push({
      code: 'duplicate-requirement',
      sourceKey: keys[0],
      message: `The same candidate statement is stored on ${keys.length} requirements: ${keys.join(', ')}. Statement starts: ${statement.slice(0, 80)}`,
    });
  }

  for (const clause of input.clauses) {
    if (clause.values.clause_type !== 'article' && clause.values.clause_type !== 'section') continue;
    if (!clausesWithRequirements.has(clause.sourceKey)) {
      findings.push({
        code: 'clause-without-requirement',
        sourceKey: clause.sourceKey,
        message: 'No draft requirement was derived. This is a review item, not a compliance failure.',
      });
    }
  }

  return findings;
}

export function diffSourceKeys(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return {
    added: right.filter((key) => !leftSet.has(key)),
    removed: left.filter((key) => !rightSet.has(key)),
    unchanged: right.filter((key) => leftSet.has(key)),
  };
}
