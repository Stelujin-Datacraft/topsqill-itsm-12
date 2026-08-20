/**
 * Infer Condition + Change Field Value bindings from short natural-language
 * prompts + live form metadata so users need not spell out Field/Operator/Value.
 */
import type { ComparisonOperator } from '@/types/conditions';
import {
  coerceOperatorForFieldType,
  isDateLikeFieldType,
  isOptionBasedFieldType,
  normalizeConditionDateValue,
  normalizeConditionOperator,
  normalizeRelativeDateCondition,
} from '@/utils/conditionOperators';
import { normalizeAiWorkflowNodeConfig } from '@/lib/normalizeAiWorkflowNodes';
import { isLikelyUuid, isUnusableFieldLabel } from '@/lib/changeFieldValueDisplay';
import { bindConditionToFormFields } from '@/lib/bindConditionToFormFields';

export interface InferFormField {
  id: string;
  label: string;
  type: string;
  options?: Array<{ id?: string; value: string; label: string }>;
}

export interface InferredPredicate {
  fieldHint: string;
  operatorHint: string;
  valueHint: string;
}

export interface InferredFieldUpdate {
  fieldHint: string;
  valueHint: string;
}

function normKey(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Common short names users type instead of exact form labels */
const FIELD_SYNONYMS: Record<string, string[]> = {
  'date of birth': ['dob', 'birth date', 'birthdate', 'birthday', 'date birth'],
  gender: ['sex', 'gender identity'],
  'marital status': ['married status', 'marriage status', 'marital', 'marriage'],
  status: ['lifecycle status', 'record status'],
  email: ['e mail', 'mail'],
  phone: ['mobile', 'phone number', 'cellphone', 'cell'],
  name: ['full name'],
  age: ['years old'],
};

function expandFieldQuery(query: string): string[] {
  const key = normKey(query);
  if (!key) return [];
  const out = new Set<string>([key]);
  for (const [canonical, alts] of Object.entries(FIELD_SYNONYMS)) {
    if (key === canonical || alts.includes(key) || key.includes(canonical) || canonical.includes(key)) {
      out.add(canonical);
      alts.forEach((a) => out.add(a));
    }
    for (const alt of alts) {
      if (key === alt || key.includes(alt) || alt.includes(key)) {
        out.add(canonical);
        alts.forEach((a) => out.add(a));
      }
    }
  }
  return [...out];
}

/** Match a user/AI field hint to a real form field (synonyms + fuzzy label). */
export function matchFormFieldByHint(
  fields: InferFormField[],
  hint: string,
): InferFormField | undefined {
  if (!fields.length || !hint) return undefined;
  const queries = expandFieldQuery(hint);

  for (const q of queries) {
    const exact = fields.find((f) => normKey(f.label) === q || normKey(f.id) === q);
    if (exact) return exact;
  }
  for (const q of queries) {
    const partial = fields.find((f) => {
      const n = normKey(f.label);
      return n.includes(q) || q.includes(n);
    });
    if (partial) return partial;
  }
  return undefined;
}

const OPTION_SYNONYMS: Record<string, string[]> = {
  male: ['m', 'man', 'boy'],
  female: ['f', 'woman', 'girl'],
  married: ['marriage', 'wed', 'spouse'],
  single: ['unmarried', 'not married'],
  yes: ['y', 'true', 'on'],
  no: ['n', 'false', 'off'],
  approved: ['approve', 'accepted', 'accept', 'completed', 'complete', 'passed', 'pass', 'success', 'ok', 'done'],
  rejected: ['reject', 'denied', 'deny', 'failed', 'fail', 'cancelled', 'canceled', 'declined', 'archived'],
  pending: ['inprogress', 'in progress', 'draft', 'submitted', 'waiting', 'open'],
  completed: ['complete', 'approved', 'approve', 'done', 'success'],
};

function expandOptionQuery(raw: string): string[] {
  const key = normKey(raw);
  if (!key) return [];
  const out = new Set<string>([key, key.replace(/\s+/g, '')]);
  for (const [canonical, alts] of Object.entries(OPTION_SYNONYMS)) {
    if (key === canonical || alts.includes(key)) {
      out.add(canonical);
      alts.forEach((a) => out.add(a));
    }
  }
  return [...out];
}

/** Resolve option text to the field's real option.value (fuzzy + synonyms). */
export function matchOptionValueByHint(
  field: InferFormField | undefined,
  requested: unknown,
): string {
  if (requested === undefined || requested === null) return '';
  const raw = String(requested).trim();
  if (!raw) return '';
  if (!field || !isOptionBasedFieldType(field.type)) return raw;

  const options = Array.isArray(field.options) ? field.options : [];
  if (!options.length) return raw;

  const queries = expandOptionQuery(raw);
  for (const q of queries) {
    const exact = options.find((o) =>
      normKey(o.value) === q || normKey(o.label) === q || normKey(String(o.id || '')) === q,
    );
    if (exact) return String(exact.value);
  }
  // Unique partial match
  const partials = options.filter((o) => {
    const v = normKey(o.value);
    const l = normKey(o.label);
    return queries.some((q) => v.includes(q) || l.includes(q) || q.includes(v) || q.includes(l));
  });
  if (partials.length === 1) return String(partials[0].value);
  return raw;
}

const OPERATOR_WORDS =
  'greater\\s+than|greate\\s+than|less\\s+than|after|before|on\\s+or\\s+after|on\\s+or\\s+before|equals?|contains|starts\\s+with|ends\\s+with|is\\s+not|isn\'?t|!=|>=|<=|==|>|<|is';

/** Words that are never real form field names (command / scaffolding). */
const META_FIELD_HINTS = new Set([
  'create', 'make', 'build', 'generate', 'design', 'add', 'new', 'please',
  'workflow', 'workflows', 'form', 'forms', 'automation', 'automate',
  'set', 'change', 'update', 'a', 'an', 'the', 'my', 'our', 'this', 'that',
  'multi', 'level', 'approval', 'notification', 'action', 'condition',
  'start', 'end', 'node', 'for', 'on', 'with', 'using', 'from',
]);

/**
 * "Create a workflow…" / "Build a form…" style prompts are not condition clauses.
 * Without if/when, do not mine them for field predicates.
 */
export function isCreateEntityPrompt(prompt: string): boolean {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/\b(?:if|when)\b/i.test(text)) return false;
  // Explicit set/change field language means field intent, not bare create-entity
  if (/\b(?:set|change|update)\s+[A-Za-z].{0,40}?\s+(?:to|as|=)\b/i.test(text)) return false;
  return /^\s*(?:please\s+)?(?:create|make|build|generate|design|set\s+up)\b/i.test(text)
    && /\b(?:workflow|workflows|form|forms|automation|report|dashboard|sla)\b/i.test(text);
}

function isUsableFieldHint(hint: string): boolean {
  const key = normKey(hint);
  if (!key || key.length < 2) return false;
  if (META_FIELD_HINTS.has(key)) return false;
  // Multi-word: reject if every token is meta ("create a workflow")
  const tokens = key.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => META_FIELD_HINTS.has(t) || t.length < 2)) {
    return false;
  }
  // Leading command verb ("create employee info…") is still not a field
  if (META_FIELD_HINTS.has(tokens[0]) && /^(create|make|build|generate|design)$/.test(tokens[0])) {
    return false;
  }
  return true;
}

function mapOperatorHint(raw: string): ComparisonOperator {
  const t = String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (t === 'is' || t === 'equals' || t === 'equal' || t === '==') return '==';
  if (t === 'is_not' || t === "isn't" || t === '!=') return '!=';
  return normalizeConditionOperator(raw);
}

/**
 * Year-only values (“after 2006”) → concrete ISO bound for date pickers.
 * after 2006 → 2006-12-31; before 2006 → 2006-01-01; on_or_after → 2006-01-01.
 */
export function expandYearOnlyDateValue(
  operator: ComparisonOperator,
  value: unknown,
): string {
  const raw = String(value ?? '').trim();
  const yearOnly = raw.match(/^(19|20)\d{2}$/);
  if (!yearOnly) {
    // "2006 year" / just expand via normalizer
    const bare = raw.match(/^(?:year\s+)?((?:19|20)\d{2})$/i);
    if (!bare) return normalizeConditionDateValue(value);
    return expandYearOnlyDateValue(operator, bare[1]);
  }
  const year = yearOnly[0];
  const op = coerceOperatorForFieldType('date', operator);
  if (op === 'after') return `${year}-12-31`;
  if (op === 'before') return `${year}-01-01`;
  if (op === 'on_or_after' || op === '>=') return `${year}-01-01`;
  if (op === 'on_or_before' || op === '<=') return `${year}-12-31`;
  return `${year}-01-01`;
}

function buildValueForField(
  field: InferFormField,
  operator: ComparisonOperator,
  valueHint: string,
): { operator: ComparisonOperator; value: string } {
  let op = coerceOperatorForFieldType(field.type, operator);
  let value: unknown = valueHint;

  if (isDateLikeFieldType(field.type)) {
    // Prefer year-only expansion before relative normalize
    if (/^(19|20)\d{2}$/.test(String(valueHint).trim())) {
      value = expandYearOnlyDateValue(op, valueHint);
    }
    const dateNorm = normalizeRelativeDateCondition(field.type, op, value);
    op = dateNorm.operator;
    value = dateNorm.value;
  } else if (isOptionBasedFieldType(field.type)) {
    value = matchOptionValueByHint(field, valueHint);
  }

  return { operator: op, value: String(value ?? '') };
}

/**
 * Extract “field op value” predicates from casual prompts.
 * Examples:
 *  - if dob after 2006 and gender male
 *  - Date of Birth is after 2006-10-01 AND Gender equals Male
 *  - if gender is male
 *
 * Does NOT treat "create a workflow…" as a condition (that falsely planned a "Create" field).
 */
export function parseConditionPredicates(prompt: string): InferredPredicate[] {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  // Bare create/build workflow|form prompts have no field conditions to mine
  if (isCreateEntityPrompt(text)) return [];

  // Prefer the clause after "if"/"when" and before "then" / trailing noise
  let scope = text;
  const ifMatch = text.match(/\b(?:if|when)\b(.+?)(?:\bthen\b|$)/i);
  const hasIfWhen = Boolean(ifMatch);
  const looksLikeCondition = new RegExp(`\\b(?:${OPERATOR_WORDS})\\b`, 'i').test(text)
    || (/^[A-Za-z][A-Za-z0-9 /_-]{0,40}\s+[A-Za-z0-9][A-Za-z0-9 _/-]{0,30}$/i.test(text)
      && !/^\s*(?:create|make|build|generate|design)\b/i.test(text));

  if (ifMatch) {
    scope = ifMatch[1];
  } else {
    // Only mine the full prompt when it looks like a condition fragment
    // (operator words or short "field value" style) — not narrative create text.
    if (!looksLikeCondition) return [];
    scope = text
      .replace(/^.*?\b(?:if|when)\b/i, '')
      .replace(/\bthen\b[\s\S]*$/i, '');
  }
  // Drop trailing action clauses so
  // "Status is Closed, set Priority to High" → condition value is Closed (not the whole phrase)
  scope = scope
    .replace(/[,.]?\s+(?:and\s+)?(?:then\s+)?(?:set|change|update)\s+[A-Za-z][\w\s/-]{0,40}?\s+to\b[\s\S]*$/i, '')
    .replace(/\s+\bthen\b[\s\S]*$/i, '')
    .trim();
  if (!scope) return [];

  // Split AND/OR clauses so "gender male" works without an explicit operator word
  const parts = scope.split(/\s+(?:and|or|&)\s+/i).map((p) => p.trim()).filter(Boolean);
  const predicates: InferredPredicate[] = [];

  const withOp = new RegExp(
    `^([A-Za-z][A-Za-z0-9 /_-]{0,40}?)\\s+(${OPERATOR_WORDS})\\s+(.+)$`,
    'i',
  );

  const scrubValueHint = (raw: string): string =>
    raw
      .trim()
      .replace(/[.!]+$/, '')
      .replace(/[,.]?\s+(?:and\s+)?(?:then\s+)?(?:set|change|update)\s+[A-Za-z][\w\s/-]{0,40}?\s+to\b[\s\S]*$/i, '')
      .trim();

  for (const part of parts) {
    const cleaned = part.replace(/^[,\s]+|[.\s]+$/g, '').trim();
    if (!cleaned) continue;

    const m = cleaned.match(withOp);
    if (m) {
      const fieldHint = m[1].replace(/\b(if|when|where)\b/gi, '').trim();
      if (!isUsableFieldHint(fieldHint)) continue;
      const valueHint = scrubValueHint(m[3]);
      if (!valueHint) continue;
      predicates.push({
        fieldHint,
        operatorHint: m[2].trim(),
        valueHint,
      });
      continue;
    }

    // Loose "gender male" — only for if/when scopes or short condition-like prompts
    if (!hasIfWhen && !looksLikeCondition) continue;
    const loose = cleaned.match(/^([A-Za-z][A-Za-z0-9 /_-]{1,40}?)\s+([A-Za-z0-9][A-Za-z0-9 _/-]*)$/i);
    if (loose) {
      const fieldHint = loose[1].trim();
      if (!isUsableFieldHint(fieldHint)) continue;
      // Reject values that look like whole sentences / create-entity leftovers
      const valueHint = scrubValueHint(loose[2]);
      if (!valueHint) continue;
      if (/\b(?:workflow|form|automation|verification|approval)\b/i.test(valueHint) && valueHint.split(/\s+/).length > 3) {
        continue;
      }
      predicates.push({
        fieldHint,
        operatorHint: 'is',
        valueHint,
      });
    }
  }

  // Dedupe by field hint
  const seen = new Set<string>();
  return predicates.filter((p) => {
    const k = normKey(p.fieldHint);
    if (!k || seen.has(k) || !isUsableFieldHint(p.fieldHint)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Extract “set Field to Value” / “change Field to Value” from prompts.
 * When form fields are provided, match real labels even without the word "to".
 */
export function parseFieldUpdates(
  prompt: string,
  fields?: InferFormField[],
): InferredFieldUpdate[] {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  if (isCreateEntityPrompt(text)) return [];
  const out: InferredFieldUpdate[] = [];

  // Prefer the action side of the sentence (before if/when, or after then)
  const actionScopes: string[] = [];
  const beforeIf = text.split(/\b(?:if|when)\b/i)[0]?.trim();
  if (beforeIf && /\b(?:set|change|update)\b/i.test(beforeIf)) actionScopes.push(beforeIf);
  const afterThen = text.split(/\bthen\b/i)[1]?.trim();
  if (afterThen) actionScopes.push(afterThen);
  if (actionScopes.length === 0) actionScopes.push(text);

  const patterns = [
    /\b(?:set|change|update)\s+([A-Za-z][A-Za-z0-9 /_-]{1,40}?)\s+(?:to|as|=)\s+([A-Za-z0-9][A-Za-z0-9 _/-]*?)(?=\s+(?:if|when|then)\b|[.,]|$)/gi,
    /\b(?:change\s+field\s+values?)\s+(?:action\s+type\s*)?(?:[,:]?\s*)?(?:set\s+)?([A-Za-z][A-Za-z0-9 /_-]{1,40}?)\s+to\s+([A-Za-z0-9][A-Za-z0-9 _/-]*?)(?=\s+(?:if|when|then)\b|[.,]|$)/gi,
  ];

  for (const scope of actionScopes) {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(scope)) !== null) {
        const fieldHint = m[1].trim();
        if (!isUsableFieldHint(fieldHint)) continue;
        out.push({ fieldHint, valueHint: m[2].trim().replace(/[.!]+$/, '') });
      }
    }

    // Field-aware: known labels in the action scope after set/change/update
    if (fields?.length) {
      const lower = scope.toLowerCase();
      // Prefer longer labels first (Marital Status before Status)
      const sorted = [...fields].sort((a, b) => b.label.length - a.label.length);
      for (const field of sorted) {
        const label = normKey(field.label);
        if (!label) continue;
        const labelRe = label.replace(/\s+/g, '\\s+');
        const hit = lower.match(
          new RegExp(`\\b(?:set|change|update)\\b[\\s\\S]{0,48}?\\b(${labelRe})\\b\\s*(?:to|as|=)?\\s*([a-z0-9][a-z0-9 _/-]*)`, 'i'),
        );
        if (!hit?.[2]) continue;
        const valueHint = hit[2].trim().replace(/[.!]+$/, '');
        if (/^(if|when|then|and|or|to|as)$/i.test(valueHint)) continue;
        // Don't treat another field name as the value
        if (fields.some((f) => normKey(f.label) === normKey(valueHint))) continue;
        out.push({ fieldHint: field.label, valueHint });
        break; // one primary update is enough
      }
    }
  }

  // Prefer matches that resolve to a known field; keep longest fieldHint
  const scored = out
    .map((u) => {
      const matched = fields?.length ? matchFormFieldByHint(fields, u.fieldHint) : undefined;
      return { u, matched, score: (matched ? 100 : 0) + u.fieldHint.length };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const result: InferredFieldUpdate[] = [];
  for (const { u, matched } of scored) {
    const key = matched ? matched.id : normKey(u.fieldHint);
    if (!key || seen.has(key)) continue;
    if (/^(if|when|then|and|or)$/i.test(u.valueHint)) continue;
    seen.add(key);
    result.push(matched ? { fieldHint: matched.label, valueHint: u.valueHint } : u);
  }
  return result;
}

function flcFromPredicate(
  pred: InferredPredicate,
  fields: InferFormField[],
  formId: string,
  idx: number,
) {
  const field = matchFormFieldByHint(fields, pred.fieldHint);
  const operator = mapOperatorHint(pred.operatorHint);
  if (!field) {
    return {
      id: `flc_infer_${idx}`,
      formId,
      fieldId: '',
      fieldLabel: pred.fieldHint,
      fieldType: 'text',
      operator,
      value: pred.valueHint,
    };
  }
  const built = buildValueForField(field, operator, pred.valueHint);
  return {
    id: `flc_infer_${idx}`,
    formId,
    fieldId: field.id,
    fieldLabel: field.label,
    fieldType: field.type,
    operator: built.operator,
    value: built.value,
  };
}

function applyPredicatesToConditionConfig(
  config: Record<string, any>,
  predicates: InferredPredicate[],
  fields: InferFormField[],
  formId: string,
): Record<string, any> {
  if (!predicates.length) return config;

  const conditions = predicates.map((pred, idx) => ({
    id: `cond_infer_${idx}`,
    systemType: 'field_level' as const,
    ...(idx < predicates.length - 1 ? { logicalOperatorWithNext: 'AND' as const } : {}),
    fieldLevelCondition: flcFromPredicate(pred, fields, formId, idx),
  }));

  const first = conditions[0]?.fieldLevelCondition;
  return {
    ...config,
    enhancedCondition: {
      systemType: 'field_level',
      logicalOperator: 'AND',
      fieldLevelCondition: first,
      conditions,
    },
    formId: first?.formId || formId,
    fieldId: first?.fieldId,
    fieldLabel: first?.fieldLabel,
    fieldType: first?.fieldType,
    operator: first?.operator,
    value: first?.value,
  };
}

function looksLikeFormNameAsField(
  label: unknown,
  formName?: string,
): boolean {
  const a = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const b = String(formName || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return Boolean(a && b && a === b);
}

function applyUpdatesToActionConfig(
  config: Record<string, any>,
  updates: InferredFieldUpdate[],
  fields: InferFormField[],
  formId: string,
  formName?: string,
  /** When true, prompt field/value always replace LLM guesses (form name, Approved, etc.). */
  promptWins = false,
): Record<string, any> {
  if (!updates.length) return config;
  const actionType = String(config.actionType || '').toLowerCase();
  // Only fill when empty or change_field_value / unset
  if (actionType && actionType !== 'change_field_value') return config;

  const update = updates[0];
  const field = matchFormFieldByHint(fields, update.fieldHint);
  if (!field) return config;

  const staticValue = matchOptionValueByHint(field, update.valueHint);
  const fieldUpdate = {
    targetFieldId: field.id,
    targetFieldName: field.label,
    targetFieldType: field.type,
    targetFieldOptions: Array.isArray(field.options)
      ? field.options.map((o) => ({ label: o.label, value: o.value }))
      : undefined,
    valueType: 'static' as const,
    staticValue,
  };

  const existingNameUnusable = isUnusableFieldLabel(config.targetFieldName, config.targetFieldId)
    || looksLikeFormNameAsField(config.targetFieldName, formName || config.targetFormName);

  // Prompt wins: always use the field/value from "set Priority to High"
  const targetFieldId = promptWins
    ? field.id
    : (isLikelyUuid(config.targetFieldId) ? config.targetFieldId : field.id);
  const targetFieldName = promptWins || existingNameUnusable
    ? field.label
    : (config.targetFieldName || field.label);
  const nextStaticValue = promptWins
    ? staticValue
    : (config.staticValue !== undefined && config.staticValue !== ''
      ? matchOptionValueByHint(field, config.staticValue)
      : staticValue);

  const next = {
    ...config,
    actionType: 'change_field_value',
    targetFormId: config.targetFormId || formId,
    targetFormName: config.targetFormName || formName || '',
    targetFieldId,
    targetFieldName,
    targetFieldType: field.type,
    targetFieldOptions: fieldUpdate.targetFieldOptions,
    valueType: 'static',
    staticValue: nextStaticValue,
    fieldUpdates: [fieldUpdate],
  };
  return next;
}

function actionNeedsEnrichment(config: any): boolean {
  const actionType = String(config?.actionType || '').toLowerCase();
  if (actionType && actionType !== 'change_field_value') return false;
  const updates = Array.isArray(config?.fieldUpdates) ? config.fieldUpdates : [];
  const missingType = updates.some((u: any) => u?.targetFieldId && !u?.targetFieldType);
  return !config?.targetFieldId
    || (config?.staticValue === undefined || config?.staticValue === '')
    || missingType
    || !config?.targetFieldType;
}

/** Stamp targetFieldType/options onto change_field_value updates from live form fields. */
function hydrateChangeFieldValueTypes(
  config: Record<string, any>,
  fields: InferFormField[],
  formId?: string,
  formName?: string,
): Record<string, any> {
  const actionType = String(config.actionType || '').toLowerCase();
  if (actionType && actionType !== 'change_field_value') return config;
  if (!fields.length) return config;

  const next = { ...config };
  if (!next.targetFormId && formId) next.targetFormId = formId;
  if (!next.targetFormName && formName) next.targetFormName = formName;
  if (!next.valueType) next.valueType = 'static';

  const hydrateOne = (u: any) => {
    const matched = matchFormFieldByHint(
      fields,
      u?.targetFieldName || u?.targetFieldId || u?.fieldName || next.targetFieldName || next.targetFieldId || '',
    ) || (u?.targetFieldId
      ? fields.find((f) => f.id === u.targetFieldId)
      : undefined)
      || (next.targetFieldId ? fields.find((f) => f.id === next.targetFieldId) : undefined);

    if (!matched) return u;
    // Always persist the real form field UUID so FormFieldSelector / Selects bind
    const targetFieldId = matched.id;
    return {
      ...u,
      targetFieldId,
      // Always prefer real form label when AI stored UUID/id as the name
      targetFieldName: isUnusableFieldLabel(u.targetFieldName, targetFieldId)
        ? matched.label
        : (u.targetFieldName || matched.label),
      targetFieldType: u.targetFieldType || matched.type,
      targetFieldOptions: u.targetFieldOptions || (Array.isArray(matched.options)
        ? matched.options.map((o) => ({ label: o.label, value: o.value }))
        : undefined),
      valueType: u.valueType || next.valueType || 'static',
      staticValue: matchOptionValueByHint(matched, u.staticValue ?? u.value ?? next.staticValue),
    };
  };

  if (Array.isArray(next.fieldUpdates) && next.fieldUpdates.length > 0) {
    next.fieldUpdates = next.fieldUpdates.map(hydrateOne);
    const first = next.fieldUpdates[0];
    next.targetFieldId = first.targetFieldId;
    next.targetFieldName = isUnusableFieldLabel(next.targetFieldName, next.targetFieldId)
      ? first.targetFieldName
      : (next.targetFieldName || first.targetFieldName);
    next.targetFieldType = next.targetFieldType || first.targetFieldType;
    next.targetFieldOptions = next.targetFieldOptions || first.targetFieldOptions;
    next.staticValue = first.staticValue ?? next.staticValue;
  } else if (next.targetFieldId || next.targetFieldName) {
    const hydrated = hydrateOne({
      targetFieldId: next.targetFieldId,
      targetFieldName: next.targetFieldName,
      targetFieldType: next.targetFieldType,
      valueType: next.valueType || 'static',
      staticValue: next.staticValue,
    });
    next.fieldUpdates = [hydrated];
    next.targetFieldType = hydrated.targetFieldType;
    next.targetFieldOptions = hydrated.targetFieldOptions;
    next.targetFieldName = hydrated.targetFieldName;
    next.targetFieldId = hydrated.targetFieldId;
    next.staticValue = hydrated.staticValue ?? next.staticValue;
  }

  return next;
}

/**
 * Rebind an already-materialized condition config so Field/Operator/Value use live UUIDs.
 * Does not require prompt predicates — works from AI labels alone.
 */
function rebindConditionConfigToFields(
  config: Record<string, any>,
  fields: InferFormField[],
  formId: string,
): Record<string, any> {
  if (!fields.length) return config;

  const next = { ...config };
  const enhanced = next.enhancedCondition;
  const items: any[] = Array.isArray(enhanced?.conditions) && enhanced.conditions.length
    ? enhanced.conditions
    : enhanced?.fieldLevelCondition
      ? [{ fieldLevelCondition: enhanced.fieldLevelCondition }]
      : (next.fieldId || next.fieldLabel || next.field)
        ? [{ fieldLevelCondition: next }]
        : [];

  if (!items.length) return next;

  const conditions = items.map((item: any, idx: number) => {
    const flc = { ...(item.fieldLevelCondition || item) };
    const bound = bindConditionToFormFields(
      {
        formId: flc.formId || formId,
        fieldId: flc.fieldId,
        fieldLabel: flc.fieldLabel || flc.fieldName || flc.field,
        fieldType: flc.fieldType,
        operator: flc.operator,
        value: flc.value,
      },
      fields,
      formId,
    );
    const resolvedFlc = {
      ...flc,
      formId: bound.formId || formId || flc.formId,
      fieldId: bound.matched ? bound.fieldId : (isLikelyUuid(flc.fieldId) ? flc.fieldId : ''),
      fieldLabel: bound.matched ? bound.fieldLabel : (flc.fieldLabel || flc.fieldName || ''),
      fieldType: bound.matched ? bound.fieldType : (flc.fieldType || 'text'),
      operator: bound.operator,
      value: bound.value,
    };
    return {
      ...item,
      id: item.id || `cond_bind_${idx}`,
      systemType: 'field_level',
      fieldLevelCondition: resolvedFlc,
      ...(idx < items.length - 1
        ? { logicalOperatorWithNext: item.logicalOperatorWithNext || 'AND' }
        : {}),
    };
  });

  const first = conditions[0]?.fieldLevelCondition;
  next.enhancedCondition = {
    ...enhanced,
    systemType: 'field_level',
    logicalOperator: enhanced?.logicalOperator || 'AND',
    conditions,
    fieldLevelCondition: first,
  };
  if (first) {
    next.formId = first.formId;
    next.fieldId = first.fieldId;
    next.fieldLabel = first.fieldLabel;
    next.fieldType = first.fieldType;
    next.operator = first.operator;
    next.value = first.value;
  }
  return next;
}

/**
 * Enrich AI workflow nodes from a short user prompt + form field metadata.
 * Fills Condition Field/Operator/Value and Change Field Value targets when missing/incomplete.
 */
export function enrichWorkflowNodesFromPrompt(
  nodes: any[],
  prompt: string,
  fields: InferFormField[],
  options?: { formId?: string; formName?: string },
): any[] {
  if (!Array.isArray(nodes) || nodes.length === 0 || !fields.length) return nodes;

  const formId = options?.formId || '';
  const formName = options?.formName;
  const predicates = parseConditionPredicates(prompt);
  const updates = parseFieldUpdates(prompt, fields);

  return nodes.map((node) => {
    const type = String(node?.type || '').toLowerCase();
    let config = { ...(node.config || {}) };
    let label = node.label;

    if (type === 'condition' || type === 'branch' || type === 'decision') {
      // Materialize enhancedCondition from flat/nested AI shapes first
      config = normalizeAiWorkflowNodeConfig('condition', config, {
        triggerFormId: formId,
        triggerFormName: formName,
      });

      // Prompt wins: LLM often labels "Check if Status is Closed" but stores Approved
      // because Closed is missing from Status options. Always apply parsed predicates.
      if (predicates.length) {
        config = applyPredicatesToConditionConfig(config, predicates, fields, formId);
      }

      // Always rebind labels → UUIDs / option values (even when prompt has no predicates)
      config = rebindConditionConfigToFields(config, fields, formId);
      config = normalizeAiWorkflowNodeConfig('condition', config, {
        triggerFormId: formId,
        triggerFormName: formName,
      });

      if (config.fieldLabel && (config.value !== undefined && config.value !== '')) {
        const op = config.operator || '==';
        label = `${config.fieldLabel} ${op} ${config.value}`;
      }
    }

    if (type === 'action') {
      if (updates.length) {
        // Prompt wins for "set Priority to High" even when LLM filled form name / wrong value
        config = applyUpdatesToActionConfig(config, updates, fields, formId, formName, true);
      } else if (actionNeedsEnrichment(config)) {
        config = applyUpdatesToActionConfig(config, updates, fields, formId, formName, false);
      }
      // Always stamp targetFieldType/options so the Action Node value input is visible
      if (String(config.actionType || '').toLowerCase() === 'change_field_value'
        || config.targetFieldId
        || config.targetFieldName
        || (Array.isArray(config.fieldUpdates) && config.fieldUpdates.length > 0)) {
        config = hydrateChangeFieldValueTypes(config, fields, formId, formName);
        config = normalizeAiWorkflowNodeConfig('action', config, {
          triggerFormId: formId,
          triggerFormName: formName,
        });
      }

      if (
        String(config.actionType || '').toLowerCase() === 'change_field_value'
        && config.targetFieldName
        && config.staticValue !== undefined
        && String(config.staticValue).trim() !== ''
      ) {
        label = `Set ${config.targetFieldName} to ${config.staticValue}`;
      }
    }

    return { ...node, label, config };
  });
}
