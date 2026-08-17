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
 */
export function parseConditionPredicates(prompt: string): InferredPredicate[] {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  // Prefer the clause after "if"/"when" and before "then" / trailing noise
  let scope = text;
  const ifMatch = text.match(/\b(?:if|when)\b(.+?)(?:\bthen\b|$)/i);
  if (ifMatch) {
    scope = ifMatch[1];
  } else {
    // "set X to Y if ..." → take after if already handled; else strip leading set-action
    scope = text
      .replace(/^.*?\b(?:if|when)\b/i, '')
      .replace(/\bthen\b[\s\S]*$/i, '');
  }
  scope = scope.trim();

  // Split AND/OR clauses so "gender male" works without an explicit operator word
  const parts = scope.split(/\s+(?:and|or|&)\s+/i).map((p) => p.trim()).filter(Boolean);
  const predicates: InferredPredicate[] = [];

  const withOp = new RegExp(
    `^([A-Za-z][A-Za-z0-9 /_-]{0,40}?)\\s+(${OPERATOR_WORDS})\\s+(.+)$`,
    'i',
  );

  for (const part of parts) {
    const cleaned = part.replace(/^[,\s]+|[.\s]+$/g, '').trim();
    if (!cleaned) continue;

    const m = cleaned.match(withOp);
    if (m) {
      predicates.push({
        fieldHint: m[1].replace(/\b(if|when|where)\b/gi, '').trim(),
        operatorHint: m[2].trim(),
        valueHint: m[3].trim().replace(/[.!]+$/, '').trim(),
      });
      continue;
    }

    // "gender male" / "status married" — last token is the value
    const loose = cleaned.match(/^([A-Za-z][A-Za-z0-9 /_-]{1,40}?)\s+([A-Za-z0-9][A-Za-z0-9 _/-]*)$/i);
    if (loose) {
      predicates.push({
        fieldHint: loose[1].trim(),
        operatorHint: 'is',
        valueHint: loose[2].trim(),
      });
    }
  }

  // Dedupe by field hint
  const seen = new Set<string>();
  return predicates.filter((p) => {
    const k = normKey(p.fieldHint);
    if (!k || seen.has(k)) return false;
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
        out.push({ fieldHint: m[1].trim(), valueHint: m[2].trim().replace(/[.!]+$/, '') });
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

function applyUpdatesToActionConfig(
  config: Record<string, any>,
  updates: InferredFieldUpdate[],
  fields: InferFormField[],
  formId: string,
  formName?: string,
): Record<string, any> {
  if (!updates.length) return config;
  const actionType = String(config.actionType || '').toLowerCase();
  // Only fill when empty or change_field_value / unset
  if (actionType && actionType !== 'change_field_value') return config;

  const update = updates[0];
  const field = matchFormFieldByHint(fields, update.fieldHint);
  if (!field) return config;

  const staticValue = matchOptionValueByHint(field, update.valueHint);
  const next = {
    ...config,
    actionType: 'change_field_value',
    targetFormId: config.targetFormId || formId,
    targetFormName: config.targetFormName || formName || '',
    targetFieldId: config.targetFieldId || field.id,
    targetFieldName: config.targetFieldName || field.label,
    valueType: 'static',
    staticValue: config.staticValue || staticValue,
    fieldUpdates: Array.isArray(config.fieldUpdates) && config.fieldUpdates.length
      ? config.fieldUpdates
      : [{
          targetFieldId: field.id,
          targetFieldName: field.label,
          valueType: 'static',
          staticValue,
        }],
  };
  return next;
}

function conditionNeedsEnrichment(config: any): boolean {
  const enhanced = config?.enhancedCondition;
  const items = enhanced?.conditions;
  if (!Array.isArray(items) || items.length === 0) {
    return !(config?.fieldId || config?.fieldLabel);
  }
  return items.some((item: any) => {
    const flc = item?.fieldLevelCondition || item;
    const hasId = flc?.fieldId && /^[0-9a-f-]{36}$/i.test(String(flc.fieldId));
    const hasValue = flc?.value !== undefined && flc?.value !== null && String(flc.value).trim() !== '';
    const noValueOp = ['exists', 'not_exists', 'is_today', 'is_yesterday', 'is_tomorrow'].includes(String(flc?.operator || ''));
    return !hasId || (!hasValue && !noValueOp);
  });
}

function actionNeedsEnrichment(config: any): boolean {
  const actionType = String(config?.actionType || '').toLowerCase();
  if (actionType && actionType !== 'change_field_value') return false;
  return !config?.targetFieldId || (config?.staticValue === undefined || config?.staticValue === '');
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

    if ((type === 'condition' || type === 'branch' || type === 'decision') && predicates.length) {
      if (conditionNeedsEnrichment(config) || predicates.length > (config.enhancedCondition?.conditions?.length || 0)) {
        config = applyPredicatesToConditionConfig(config, predicates, fields, formId);
      } else {
        // Still re-bind option/date values against real metadata
        const conditions = (config.enhancedCondition?.conditions || []).map((item: any, idx: number) => {
          const flc = { ...(item.fieldLevelCondition || item) };
          const field = matchFormFieldByHint(fields, flc.fieldLabel || flc.fieldId || predicates[idx]?.fieldHint || '');
          if (field) {
            const built = buildValueForField(
              field,
              normalizeConditionOperator(flc.operator || predicates[idx]?.operatorHint || '=='),
              String(flc.value ?? predicates[idx]?.valueHint ?? ''),
            );
            flc.formId = formId || flc.formId;
            flc.fieldId = field.id;
            flc.fieldLabel = field.label;
            flc.fieldType = field.type;
            flc.operator = built.operator;
            flc.value = built.value;
          }
          return { ...item, systemType: 'field_level', fieldLevelCondition: flc };
        });
        config.enhancedCondition = {
          ...config.enhancedCondition,
          systemType: 'field_level',
          logicalOperator: 'AND',
          conditions,
          fieldLevelCondition: conditions[0]?.fieldLevelCondition,
        };
      }
      config = normalizeAiWorkflowNodeConfig('condition', config, {
        triggerFormId: formId,
        triggerFormName: formName,
      });
    }

    if (type === 'action' && updates.length && actionNeedsEnrichment(config)) {
      config = applyUpdatesToActionConfig(config, updates, fields, formId, formName);
      config = normalizeAiWorkflowNodeConfig('action', config, {
        triggerFormId: formId,
        triggerFormName: formName,
      });
    }

    return { ...node, config };
  });
}
