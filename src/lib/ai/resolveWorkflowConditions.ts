import type { ComparisonOperator, FieldLevelCondition } from '@/types/conditions';
import {
  coerceOperatorForFieldType,
  getOperatorsForFieldType,
  isOptionBasedFieldType,
  normalizeConditionOperator,
  normalizeRelativeDateCondition,
} from '@/utils/conditionOperators';
import { sanitizeAiFieldType } from '@/lib/createFormFromAiGeneration';

export interface ConditionFormFieldMeta {
  id: string;
  label: string;
  type: string;
  options?: Array<{ id?: string; value: string; label: string }>;
}

export interface ConditionFieldIssue {
  kind: 'missing_field';
  issueId: string;
  nodeIndex: number;
  conditionIndex: number;
  formId: string;
  requestedLabel: string;
  requestedType: string;
  operator: ComparisonOperator;
  value: unknown;
  /** Existing fields the user can choose from */
  availableFields: ConditionFormFieldMeta[];
}

export interface ConditionValueIssue {
  kind: 'missing_value';
  issueId: string;
  nodeIndex: number;
  conditionIndex: number;
  formId: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  operator: ComparisonOperator;
  requestedValue: string;
  availableOptions: Array<{ id?: string; value: string; label: string }>;
}

export type ConditionResolutionIssue = ConditionFieldIssue | ConditionValueIssue;

export interface ResolveWorkflowConditionsResult {
  nodes: any[];
  issues: ConditionResolutionIssue[];
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findFieldByIdOrLabel(
  fields: ConditionFormFieldMeta[],
  fieldId?: string,
  fieldLabel?: string,
): ConditionFormFieldMeta | undefined {
  if (fieldId) {
    const byId = fields.find((f) => f.id === fieldId);
    if (byId) return byId;
  }
  if (fieldLabel) {
    const target = normalizeLabel(fieldLabel);
    const exact = fields.find((f) => normalizeLabel(f.label) === target);
    if (exact) return exact;
    return fields.find((f) => {
      const n = normalizeLabel(f.label);
      return n.includes(target) || target.includes(n);
    });
  }
  return undefined;
}

function findOptionMatch(
  options: Array<{ id?: string; value: string; label: string }>,
  requested: unknown,
): { id?: string; value: string; label: string } | undefined {
  if (requested === undefined || requested === null || requested === '') return undefined;
  const raw = String(requested).trim();
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]+/g, '');
  const synonyms: Record<string, string[]> = {
    male: ['m', 'man', 'boy'],
    female: ['f', 'woman', 'girl'],
    married: ['marriage', 'wed'],
    single: ['unmarried'],
    yes: ['y', 'true', 'on'],
    no: ['n', 'false', 'off'],
    approved: ['approve', 'accepted', 'accept', 'completed', 'complete', 'passed', 'pass', 'success', 'ok', 'done'],
    rejected: ['reject', 'denied', 'deny', 'failed', 'fail', 'cancelled', 'canceled', 'declined', 'archived'],
    pending: ['inprogress', 'in progress', 'draft', 'submitted', 'waiting', 'open'],
    completed: ['complete', 'approved', 'approve', 'done', 'success'],
  };
  const queries = new Set<string>([lower, compact]);
  for (const [canonical, alts] of Object.entries(synonyms)) {
    if (
      lower === canonical
      || alts.includes(lower)
      || alts.includes(compact)
      || compact === canonical.replace(/[^a-z0-9]+/g, '')
    ) {
      queries.add(canonical);
      alts.forEach((a) => queries.add(a));
    }
  }

  for (const q of queries) {
    const exact = options.find((o) =>
      String(o.value).toLowerCase() === q
      || String(o.label).toLowerCase() === q
      || String(o.id || '').toLowerCase() === q
      || String(o.value).toLowerCase().replace(/[^a-z0-9]+/g, '') === q
      || String(o.label).toLowerCase().replace(/[^a-z0-9]+/g, '') === q,
    );
    if (exact) return exact;
  }

  const partials = options.filter((o) => {
    const v = String(o.value).toLowerCase();
    const l = String(o.label).toLowerCase();
    return [...queries].some((q) => q.length >= 2 && (v.includes(q) || l.includes(q)));
  });
  if (partials.length === 1) return partials[0];
  return undefined;
}

function ensureFieldLevelShape(flc: any, formId: string): FieldLevelCondition & { fieldLabel?: string } {
  return {
    id: flc?.id || `flc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    formId: flc?.formId || formId,
    fieldId: flc?.fieldId || '',
    fieldType: flc?.fieldType || 'text',
    operator: normalizeConditionOperator(flc?.operator),
    value: flc?.value,
    source: flc?.source,
    crossRefFieldId: flc?.crossRefFieldId,
    crossRefFieldLabel: flc?.crossRefFieldLabel,
    linkedFormId: flc?.linkedFormId,
    linkedFormName: flc?.linkedFormName,
    quantifier: flc?.quantifier,
    quantifierCount: flc?.quantifierCount,
    ...(flc?.fieldLabel ? { fieldLabel: flc.fieldLabel } : {}),
  } as FieldLevelCondition & { fieldLabel?: string };
}

function extractFieldLevelConditions(nodeConfig: any): Array<{ path: 'conditions' | 'root'; index: number; flc: any }> {
  const out: Array<{ path: 'conditions' | 'root'; index: number; flc: any }> = [];
  const enhanced = nodeConfig?.enhancedCondition;
  if (!enhanced) {
    if (nodeConfig?.fieldId || nodeConfig?.fieldLabel || nodeConfig?.field) {
      out.push({
        path: 'root',
        index: 0,
        flc: {
          formId: nodeConfig.formId,
          fieldId: nodeConfig.fieldId || nodeConfig.field,
          fieldLabel: nodeConfig.fieldLabel || nodeConfig.field,
          fieldType: nodeConfig.fieldType || 'text',
          operator: nodeConfig.operator || '==',
          value: nodeConfig.value,
        },
      });
      return out;
    }
    // AI Suggest often emits nested config.condition before normalize
    const nested = typeof nodeConfig?.condition === 'object' && nodeConfig.condition
      ? nodeConfig.condition
      : null;
    if (nested && (nested.fieldId || nested.fieldLabel || nested.field || nested.fieldName)) {
      out.push({
        path: 'root',
        index: 0,
        flc: {
          formId: nested.formId || nodeConfig.formId,
          fieldId: nested.fieldId || nested.field,
          fieldLabel: nested.fieldLabel || nested.fieldName || nested.field,
          fieldType: nested.fieldType || 'text',
          operator: nested.operator || '==',
          value: nested.value,
        },
      });
    }
    return out;
  }

  if (Array.isArray(enhanced.conditions) && enhanced.conditions.length > 0) {
    enhanced.conditions.forEach((item: any, index: number) => {
      if (item?.fieldLevelCondition) {
        out.push({ path: 'conditions', index, flc: item.fieldLevelCondition });
      } else if (item?.fieldId || item?.fieldLabel || item?.field) {
        out.push({ path: 'conditions', index, flc: item });
      }
    });
  } else if (enhanced.fieldLevelCondition) {
    out.push({ path: 'root', index: 0, flc: enhanced.fieldLevelCondition });
  }

  return out;
}

function writeResolvedFlc(
  nodeConfig: any,
  path: 'conditions' | 'root',
  index: number,
  flc: FieldLevelCondition & { fieldLabel?: string },
  formId: string,
) {
  if (!nodeConfig.enhancedCondition) {
    nodeConfig.enhancedCondition = {
      systemType: 'field_level',
      conditions: [],
    };
  }

  if (path === 'conditions' && Array.isArray(nodeConfig.enhancedCondition.conditions)) {
    const item = nodeConfig.enhancedCondition.conditions[index] || {
      id: `cond_${index}_${Date.now()}`,
      systemType: 'field_level',
    };
    item.systemType = 'field_level';
    item.fieldLevelCondition = flc;
    nodeConfig.enhancedCondition.conditions[index] = item;
  } else {
    nodeConfig.enhancedCondition.systemType = 'field_level';
    nodeConfig.enhancedCondition.fieldLevelCondition = flc;
    if (!Array.isArray(nodeConfig.enhancedCondition.conditions) || nodeConfig.enhancedCondition.conditions.length === 0) {
      nodeConfig.enhancedCondition.conditions = [{
        id: `cond_0_${Date.now()}`,
        systemType: 'field_level',
        fieldLevelCondition: flc,
      }];
    } else {
      nodeConfig.enhancedCondition.conditions[0] = {
        ...(nodeConfig.enhancedCondition.conditions[0] || {}),
        id: nodeConfig.enhancedCondition.conditions[0]?.id || `cond_0_${Date.now()}`,
        systemType: 'field_level',
        fieldLevelCondition: flc,
      };
    }
  }

  // Keep flat keys for older readers
  nodeConfig.formId = formId;
  nodeConfig.fieldId = flc.fieldId;
  nodeConfig.fieldLabel = (flc as any).fieldLabel;
  nodeConfig.fieldType = flc.fieldType;
  nodeConfig.operator = flc.operator;
  nodeConfig.value = flc.value;
}

/**
 * Resolve AI-generated condition nodes against live form field metadata.
 * Does NOT create fields/values — returns pending issues for user confirmation.
 */
export function resolveWorkflowConditions(
  nodes: any[],
  formFieldsByFormId: Record<string, ConditionFormFieldMeta[]>,
  defaultFormId?: string,
): ResolveWorkflowConditionsResult {
  const issues: ConditionResolutionIssue[] = [];
  const resolvedNodes = (Array.isArray(nodes) ? nodes : []).map((node, nodeIndex) => {
    const type = String(node?.type || '').toLowerCase();
    if (type !== 'condition') return node;

    const next = {
      ...node,
      config: { ...(node.config || {}) },
    };

    const entries = extractFieldLevelConditions(next.config);
    if (entries.length === 0) return next;

    entries.forEach(({ path, index, flc: rawFlc }) => {
      const formId = rawFlc?.formId || defaultFormId || '';
      const fields = formFieldsByFormId[formId]
        || (defaultFormId ? formFieldsByFormId[defaultFormId] : undefined)
        || Object.values(formFieldsByFormId)[0]
        || [];
      const effectiveFormId = formId || defaultFormId || '';
      const flc = ensureFieldLevelShape(rawFlc, effectiveFormId);
      const requestedLabel = String(rawFlc?.fieldLabel || rawFlc?.fieldName || rawFlc?.field || flc.fieldId || '').trim();

      const matched = findFieldByIdOrLabel(fields, flc.fieldId, requestedLabel || undefined);

      if (!matched) {
        const issueId = `field-${nodeIndex}-${index}-${Date.now()}`;
        issues.push({
          kind: 'missing_field',
          issueId,
          nodeIndex,
          conditionIndex: index,
          formId: effectiveFormId,
          requestedLabel: requestedLabel || 'Unknown field',
          requestedType: sanitizeAiFieldType(rawFlc?.fieldType || 'text'),
          operator: flc.operator,
          value: flc.value,
          availableFields: fields,
        });
        // Keep draft for resume after create/choose
        writeResolvedFlc(next.config, path, index, {
          ...flc,
          fieldId: '',
          fieldType: sanitizeAiFieldType(rawFlc?.fieldType || 'text'),
          fieldLabel: requestedLabel,
        } as any, effectiveFormId);
        return;
      }

      const operators = getOperatorsForFieldType(matched.type);
      let operator = coerceOperatorForFieldType(matched.type, flc.operator);
      let value = flc.value;

      // Date fields: map Equals+"today" → is_today; ">" → after; DD/MM/YYYY → ISO
      const dateNormalized = normalizeRelativeDateCondition(matched.type, operator, value);
      operator = dateNormalized.operator;
      value = dateNormalized.value;
      if (!operators.some((o) => o.value === operator)) {
        // Keep mapped relative ops even if list ordering differs; fall back only if unknown
        const stillValid = getOperatorsForFieldType(matched.type).some((o) => o.value === operator);
        if (!stillValid) operator = operators[0]?.value || '==';
      }

      if (isOptionBasedFieldType(matched.type) && value !== undefined && value !== null && value !== '') {
        const options = Array.isArray(matched.options) ? matched.options : [];
        // Empty options → keep the requested value (can't validate yet; don't wipe the Select)
        if (options.length === 0) {
          writeResolvedFlc(next.config, path, index, {
            ...flc,
            formId: effectiveFormId,
            fieldId: matched.id,
            fieldType: matched.type,
            operator,
            value,
            fieldLabel: matched.label,
          } as any, effectiveFormId);
          return;
        }
        const optionMatch = findOptionMatch(options, value);
        if (!optionMatch) {
          issues.push({
            kind: 'missing_value',
            issueId: `value-${nodeIndex}-${index}-${Date.now()}`,
            nodeIndex,
            conditionIndex: index,
            formId: matched.id ? effectiveFormId : effectiveFormId,
            fieldId: matched.id,
            fieldLabel: matched.label,
            fieldType: matched.type,
            operator,
            requestedValue: String(value),
            availableOptions: options,
          });
          // Keep the requested value in the draft so the designer still shows intent;
          // create/choose flow can replace it. Clearing to '' made Field selected but Value blank.
          writeResolvedFlc(next.config, path, index, {
            ...flc,
            formId: effectiveFormId,
            fieldId: matched.id,
            fieldType: matched.type,
            operator,
            value: String(value),
            fieldLabel: matched.label,
          } as any, effectiveFormId);
          return;
        }
        value = optionMatch.value;
      }

      writeResolvedFlc(next.config, path, index, {
        ...flc,
        formId: effectiveFormId,
        fieldId: matched.id,
        fieldType: matched.type,
        operator,
        value,
        fieldLabel: matched.label,
      } as any, effectiveFormId);
    });

    return next;
  });

  return { nodes: resolvedNodes, issues };
}

/** Apply a resolved field/value choice back onto workflow nodes. */
export function applyConditionResolutionToNodes(
  nodes: any[],
  issue: ConditionResolutionIssue,
  patch: { fieldId?: string; fieldLabel?: string; fieldType?: string; value?: unknown },
): any[] {
  return nodes.map((node, nodeIndex) => {
    if (nodeIndex !== issue.nodeIndex) return node;
    const next = { ...node, config: { ...(node.config || {}) } };
    const enhanced = next.config.enhancedCondition;
    if (!enhanced) return next;

    const applyToFlc = (flc: any) => ({
      ...flc,
      ...(patch.fieldId ? { fieldId: patch.fieldId } : {}),
      ...(patch.fieldLabel ? { fieldLabel: patch.fieldLabel } : {}),
      ...(patch.fieldType ? { fieldType: patch.fieldType } : {}),
      ...(patch.value !== undefined ? { value: patch.value } : {}),
      formId: issue.formId || flc.formId,
      operator: issue.operator || flc.operator,
    });

    if (Array.isArray(enhanced.conditions) && enhanced.conditions[issue.conditionIndex]) {
      const item = { ...enhanced.conditions[issue.conditionIndex] };
      item.fieldLevelCondition = applyToFlc(item.fieldLevelCondition || {});
      const conditions = [...enhanced.conditions];
      conditions[issue.conditionIndex] = item;
      next.config.enhancedCondition = { ...enhanced, conditions };
      next.config.fieldId = item.fieldLevelCondition.fieldId;
      next.config.fieldLabel = item.fieldLevelCondition.fieldLabel;
      next.config.fieldType = item.fieldLevelCondition.fieldType;
      next.config.value = item.fieldLevelCondition.value;
      next.config.operator = item.fieldLevelCondition.operator;
    } else if (enhanced.fieldLevelCondition) {
      const flc = applyToFlc(enhanced.fieldLevelCondition);
      next.config.enhancedCondition = { ...enhanced, fieldLevelCondition: flc };
      next.config.fieldId = flc.fieldId;
      next.config.fieldLabel = flc.fieldLabel;
      next.config.fieldType = flc.fieldType;
      next.config.value = flc.value;
      next.config.operator = flc.operator;
    }

    return next;
  });
}
