import type { ComparisonOperator } from '@/types/conditions';
import {
  normalizeConditionOperator,
  normalizeRelativeDateCondition,
} from '@/utils/conditionOperators';
import { isUnusableFieldLabel } from '@/lib/changeFieldValueDisplay';

export interface AiWorkflowNodeConnection {
  to: string;
  condition?: string;
  conditionType?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface AiWorkflowNodeDef {
  tempId?: string;
  type: string;
  label: string;
  description?: string;
  config?: Record<string, any>;
  positionX?: number;
  positionY?: number;
  connections?: AiWorkflowNodeConnection[];
}

export interface NormalizeAiWorkflowNodesOptions {
  triggerFormId?: string;
  triggerFormName?: string;
}

/** Action types exposed in the designer Action Type dropdown. */
const DESIGNER_ACTION_TYPES = new Set([
  'send_notification',
  'change_field_value',
  'create_record',
  'create_linked_record',
  'update_linked_records',
  'create_combination_records',
]);

const CHANGE_FIELD_ALIASES = new Set([
  'change_field_value',
  'change_field',
  'set_field_value',
  'set_field',
  'set_field_values',
  'update_field_value',
  'update_field',
  'update_field_values',
  'set_value',
]);

const NOTIFICATION_ALIASES = new Set([
  'send_notification',
  'send_email',
  'send_sms',
  'notify',
  'notification',
  'email',
  'approve_form',
  'disapprove_form',
  'assign_form',
  'assign',
  'review',
  'verify',
  'approval',
  'escalate',
]);

function hasFieldUpdateShape(config: Record<string, any>): boolean {
  return (Array.isArray(config.fieldUpdates) && config.fieldUpdates.length > 0)
    || !!config.targetFieldId
    || !!config.fieldId
    || (!!config.field && (
      config.value !== undefined
      || config.staticValue !== undefined
      || config.newValue !== undefined
    ));
}

/**
 * Infer a designer-compatible actionType from config + node label/description.
 * Empty or unsupported types become send_notification so the Action Type select is never blank.
 */
export function inferDesignerActionType(
  config: Record<string, any> | undefined,
  label?: string,
  description?: string,
): string {
  const next = config || {};
  const rawAction = String(next.actionType || '').toLowerCase().replace(/[\s-]+/g, '_');
  const haystack = `${label || ''} ${description || ''} ${rawAction}`.toLowerCase();

  if (CHANGE_FIELD_ALIASES.has(rawAction) || (!rawAction && hasFieldUpdateShape(next))) {
    return 'change_field_value';
  }
  if (DESIGNER_ACTION_TYPES.has(rawAction)) {
    return rawAction;
  }
  if (NOTIFICATION_ALIASES.has(rawAction)) {
    return 'send_notification';
  }
  if (/set|change|update/.test(haystack) && /field|value|status|married|gender|dob|birth/.test(haystack)) {
    return 'change_field_value';
  }
  if (/create\s+linked|linked\s+record/.test(haystack)) {
    return 'create_linked_record';
  }
  if (/create\s+combination|combination\s+record/.test(haystack)) {
    return 'create_combination_records';
  }
  if (/create\s+record/.test(haystack)) {
    return 'create_record';
  }
  if (/review|verif|approv|reject|assign|notify|email|escalat|hr\b|manager|level\s*\d/.test(haystack)) {
    return 'send_notification';
  }
  // Default for empty/unknown — valid SelectItem (approve_form is NOT in the designer list)
  return 'send_notification';
}

function ensureNotificationConfig(config: Record<string, any>, label?: string): Record<string, any> {
  const next = { ...config, actionType: 'send_notification' };
  if (!next.notificationConfig) {
    next.notificationConfig = {
      type: next.notificationType || next.type || 'in_app',
      subject: next.subject || next.emailSubject || (label ? `${label}` : 'Workflow Notification'),
      message: next.message || next.body || next.emailBody
        || (label ? `Please complete: ${label}` : 'This is an automated notification from the workflow.'),
      recipientConfig: next.recipientConfig || {
        type: next.recipientType || 'form_submitter',
        emails: [],
        dynamicFieldPath: '',
      },
    };
  }
  return next;
}

function normalizeChangeFieldValueConfig(
  config: Record<string, any>,
  triggerFormId?: string,
  triggerFormName?: string,
): Record<string, any> {
  const next = { ...config, actionType: 'change_field_value' };

  const firstUpdate = Array.isArray(next.fieldUpdates) ? next.fieldUpdates[0] : undefined;

  // AI often emits fieldId/value/field/newValue instead of targetFieldId/staticValue
  if (!next.targetFieldId) {
    next.targetFieldId = firstUpdate?.targetFieldId
      || firstUpdate?.fieldId
      || next.fieldId
      || next.field
      || next.targetField
      || '';
  }
  {
    const candidateName = firstUpdate?.targetFieldName
      || firstUpdate?.fieldName
      || firstUpdate?.fieldLabel
      || next.targetFieldName
      || next.fieldName
      || next.fieldLabel
      || '';
    // Never persist the field UUID as the display name — leave empty for UI hydration
    next.targetFieldName = isUnusableFieldLabel(candidateName, next.targetFieldId)
      ? ''
      : String(candidateName).trim();
  }
  if (!next.targetFieldType) {
    next.targetFieldType = firstUpdate?.targetFieldType
      || firstUpdate?.fieldType
      || next.fieldType
      || undefined;
  }
  if (!next.targetFormId) {
    next.targetFormId = firstUpdate?.targetFormId || next.formId || triggerFormId || '';
  }
  if (!next.targetFormName) {
    next.targetFormName = firstUpdate?.targetFormName || next.formName || triggerFormName || '';
  }

  const rawValue = next.staticValue
    ?? firstUpdate?.staticValue
    ?? next.value
    ?? next.newValue
    ?? next.setValue
    ?? firstUpdate?.value
    ?? firstUpdate?.newValue;
  const rawDynamic = next.dynamicValuePath
    ?? firstUpdate?.dynamicValuePath
    ?? next.sourceFieldId
    ?? firstUpdate?.sourceFieldId;

  // Default is ALWAYS static unless an explicit dynamic source path is present
  const explicitType = String(next.valueType || firstUpdate?.valueType || '').toLowerCase();
  const inferredType: 'static' | 'dynamic' =
    explicitType === 'dynamic' || (Boolean(rawDynamic) && explicitType !== 'static')
      ? 'dynamic'
      : 'static';

  next.valueType = inferredType;
  if (inferredType === 'static') {
    next.staticValue = rawValue !== undefined && rawValue !== null ? rawValue : '';
    if (!rawDynamic) {
      delete next.dynamicValuePath;
    }
  } else if (rawDynamic) {
    next.dynamicValuePath = rawDynamic;
  }

  const buildUpdate = (u?: any) => {
    const valueType: 'static' | 'dynamic' = String(u?.valueType || next.valueType || 'static').toLowerCase() === 'dynamic'
      ? 'dynamic'
      : 'static';
    const staticValue = valueType === 'static'
      ? (u?.staticValue ?? u?.value ?? u?.newValue ?? next.staticValue ?? '')
      : undefined;
    const targetFieldId = u?.targetFieldId || u?.fieldId || next.targetFieldId;
    const candidateName = u?.targetFieldName || u?.fieldName || u?.fieldLabel || next.targetFieldName;
    const targetFieldName = isUnusableFieldLabel(candidateName, targetFieldId)
      ? ''
      : String(candidateName || '').trim();
    return {
      ...(u || {}),
      targetFieldId,
      targetFieldName,
      targetFieldType: u?.targetFieldType || u?.fieldType || next.targetFieldType || next.fieldType,
      targetFieldOptions: u?.targetFieldOptions || u?.fieldOptions || next.targetFieldOptions || next.fieldOptions,
      valueType,
      staticValue,
      dynamicValuePath: valueType === 'dynamic'
        ? (u?.dynamicValuePath || u?.sourceFieldId || next.dynamicValuePath)
        : undefined,
    };
  };

  if (!Array.isArray(next.fieldUpdates) || next.fieldUpdates.length === 0) {
    next.fieldUpdates = [buildUpdate()];
  } else {
    next.fieldUpdates = next.fieldUpdates.map((u: any) => buildUpdate(u));
  }

  // Mirror first update onto top-level for legacy readers / UI migration
  const first = next.fieldUpdates[0];
  if (first?.targetFieldId) next.targetFieldId = first.targetFieldId;
  if (first?.targetFieldName) next.targetFieldName = first.targetFieldName;
  if (first?.targetFieldType) next.targetFieldType = first.targetFieldType;
  if (first?.targetFieldOptions) next.targetFieldOptions = first.targetFieldOptions;
  next.valueType = first?.valueType || 'static';
  if (next.valueType === 'static') {
    next.staticValue = first?.staticValue ?? next.staticValue ?? '';
  }

  return next;
}

function normalizeConditionConfig(
  config: Record<string, any>,
  triggerFormId?: string,
): Record<string, any> {
  const next = { ...config };
  const formId = next.formId || triggerFormId || '';

  const ensureFlc = (raw: any) => {
    const flc = { ...(raw || {}) };
    flc.formId = flc.formId || formId;
    flc.fieldId = flc.fieldId || flc.field || '';
    flc.fieldLabel = flc.fieldLabel || flc.fieldName || flc.field || flc.fieldId || '';
    flc.fieldType = flc.fieldType || 'text';
    const operator = normalizeConditionOperator(flc.operator || '==');
    const dateNorm = normalizeRelativeDateCondition(
      flc.fieldType,
      operator,
      flc.value,
    );
    flc.operator = dateNorm.operator;
    flc.value = dateNorm.value ?? '';
    flc.id = flc.id || `flc_${Date.now()}`;
    return flc;
  };

  const wrapConditionItems = (items: any[], logicalOp?: string) => {
    const conditions = items.map((item: any, idx: number) => {
      const flcSource = item?.fieldLevelCondition || item;
      const flc = ensureFlc(flcSource);
      return {
        id: item?.id || `cond_${idx}`,
        systemType: 'field_level',
        fieldLevelCondition: flc,
        // Default AND when AI emits multiple conditions without an explicit combiner
        ...(idx < items.length - 1
          ? { logicalOperatorWithNext: item?.logicalOperatorWithNext || logicalOp || 'AND' }
          : {}),
      };
    });
    const first = conditions[0]?.fieldLevelCondition;
    next.enhancedCondition = {
      systemType: 'field_level',
      logicalOperator: logicalOp || next.enhancedCondition?.logicalOperator || 'AND',
      fieldLevelCondition: first,
      conditions,
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
  };

  if (next.enhancedCondition?.conditions?.length) {
    return wrapConditionItems(
      next.enhancedCondition.conditions,
      next.enhancedCondition.logicalOperator,
    );
  }

  if (next.enhancedCondition?.fieldLevelCondition) {
    return wrapConditionItems([next.enhancedCondition.fieldLevelCondition]);
  }

  // AI often emits top-level conditions/rules without enhancedCondition wrapper
  const looseArray = next.conditions || next.rules || next.filters;
  if (Array.isArray(looseArray) && looseArray.length > 0) {
    return wrapConditionItems(looseArray, next.logicalOperator || 'AND');
  }

  // Simple / flat AI condition shapes
  const simple = (typeof next.condition === 'object' && next.condition)
    || (next.fieldId || next.fieldLabel || next.field ? next : null);
  if (simple) {
    return wrapConditionItems([{
      formId: simple.formId || formId,
      fieldId: simple.fieldId || simple.field,
      fieldLabel: simple.fieldLabel || simple.field,
      fieldType: simple.fieldType || next.fieldType || 'text',
      operator: simple.operator || next.operator || '==',
      value: simple.value ?? next.value,
    }]);
  }

  return next;
}

function normalizeStartConfig(
  config: Record<string, any>,
  options?: NormalizeAiWorkflowNodesOptions,
): Record<string, any> {
  const next = { ...config };
  const triggerFormId = options?.triggerFormId || next.triggerFormId || next.formId || '';
  const triggerFormName = options?.triggerFormName || next.triggerFormName || next.formName || '';
  if (triggerFormId) {
    next.triggerFormId = triggerFormId;
    next.formId = next.formId || triggerFormId;
  }
  if (triggerFormName) {
    next.triggerFormName = triggerFormName;
  }
  const rawType = String(next.triggerType || 'form_submission').toLowerCase();
  next.triggerType = rawType === 'trigger' || rawType === 'form' || !rawType
    ? 'form_submission'
    : next.triggerType || 'form_submission';
  return next;
}

/** Normalize a single AI node config for designer + runtime compatibility. */
export function normalizeAiWorkflowNodeConfig(
  nodeType: string,
  config: Record<string, any> | undefined,
  options?: NormalizeAiWorkflowNodesOptions & { label?: string; description?: string },
): Record<string, any> {
  const type = String(nodeType || '').toLowerCase();
  let next = { ...(config || {}) };

  if (type === 'start' || type === 'trigger') {
    next = normalizeStartConfig(next, options);
  } else if (type === 'condition' || type === 'branch' || type === 'decision') {
    next = normalizeConditionConfig(next, options?.triggerFormId);
  } else if (type === 'action') {
    const actionType = inferDesignerActionType(next, options?.label, options?.description);
    next.actionType = actionType;
    if (actionType === 'change_field_value') {
      next = normalizeChangeFieldValueConfig(next, options?.triggerFormId, options?.triggerFormName);
    } else if (actionType === 'send_notification') {
      next = ensureNotificationConfig(next, options?.label);
    }
    // Stamp target form from trigger when omitted
    if (!next.targetFormId && options?.triggerFormId) {
      next.targetFormId = options.triggerFormId;
    }
    if (!next.targetFormName && options?.triggerFormName) {
      next.targetFormName = options.triggerFormName;
    }
  }

  return next;
}

function resolveConnectionTarget(
  to: string,
  labelToTempId: Map<string, string>,
  tempIds: Set<string>,
): string | undefined {
  if (!to) return undefined;
  if (tempIds.has(to)) return to;
  const byLabel = labelToTempId.get(to.toLowerCase());
  if (byLabel) return byLabel;
  // Partial label match
  for (const [label, tempId] of labelToTempId.entries()) {
    if (label.includes(to.toLowerCase()) || to.toLowerCase().includes(label)) {
      return tempId;
    }
  }
  return undefined;
}

function pickApproveEnd(ends: AiWorkflowNodeDef[]): AiWorkflowNodeDef | undefined {
  return ends.find((n) => /approv|success|complete|done|accept|pass/i.test(n.label))
    || ends[0];
}

function pickRejectEnd(ends: AiWorkflowNodeDef[], approve?: AiWorkflowNodeDef): AiWorkflowNodeDef | undefined {
  return ends.find((n) =>
    n.tempId !== approve?.tempId
    && /reject|deny|fail|need|update|revision|return|cancel/i.test(n.label),
  ) || ends.find((n) => n.tempId !== approve?.tempId);
}

function findNextNonEnd(mapped: AiWorkflowNodeDef[], fromIndex: number): AiWorkflowNodeDef | undefined {
  for (let j = fromIndex + 1; j < mapped.length; j++) {
    if (String(mapped[j].type).toLowerCase() !== 'end') return mapped[j];
  }
  return undefined;
}

/**
 * Fill missing edges per-node after remap.
 * Unlike the old "all-or-nothing" gate, this still connects nodes that have empty
 * connections even when some other nodes already have edges.
 */
function fillMissingConnections(mapped: AiWorkflowNodeDef[]): void {
  if (mapped.length <= 1) return;

  const ends = mapped.filter((n) => String(n.type).toLowerCase() === 'end');
  const approveEnd = pickApproveEnd(ends);
  const rejectEnd = pickRejectEnd(ends, approveEnd);

  for (let i = 0; i < mapped.length; i++) {
    const source = mapped[i];
    const type = String(source.type).toLowerCase();
    if (type === 'end') continue;

    const conns = [...(source.connections || [])];

    if (type === 'condition') {
      const hasTrue = conns.some((c) =>
        String(c.conditionType || c.condition || c.sourceHandle || '').toLowerCase() === 'true',
      );
      const hasFalse = conns.some((c) =>
        String(c.conditionType || c.condition || c.sourceHandle || '').toLowerCase() === 'false',
      );
      const next = findNextNonEnd(mapped, i) || mapped[i + 1];
      if (!hasTrue && next) {
        conns.push({ to: next.tempId!, conditionType: 'true', sourceHandle: 'true' });
      }
      if (!hasFalse) {
        const falseTarget = rejectEnd
          || ends.find((e) => e.tempId !== (conns.find((c) =>
            String(c.conditionType || c.sourceHandle).toLowerCase() === 'true'
          )?.to))
          || approveEnd
          || next;
        if (falseTarget) {
          conns.push({ to: falseTarget.tempId!, conditionType: 'false', sourceHandle: 'false' });
        }
      }
      source.connections = conns;
      continue;
    }

    if (conns.length > 0) {
      source.connections = conns;
      continue;
    }

    // Empty non-condition: chain to next action/wait/condition, else primary end
    const nextNonEnd = findNextNonEnd(mapped, i);
    if (nextNonEnd) {
      source.connections = [{ to: nextNonEnd.tempId! }];
    } else if (approveEnd) {
      source.connections = [{ to: approveEnd.tempId! }];
    } else if (mapped[i + 1]) {
      source.connections = [{ to: mapped[i + 1].tempId! }];
    }
  }
}

/**
 * Map AI/suggested workflow nodes into tempId-based definitions with:
 * - Start triggerFormId/Name stamped
 * - Connections remapped from labels → tempIds (+ per-node missing-edge fill)
 * - Action/condition configs normalized for the designer UI
 */
export function mapAndNormalizeAiWorkflowNodes(
  nodes: AiWorkflowNodeDef[],
  options?: NormalizeAiWorkflowNodesOptions,
): AiWorkflowNodeDef[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const labelToTempId = new Map<string, string>();
  const tempIds = new Set<string>();

  const prepared = nodes.map((node, index) => {
    const tempId = node.tempId || `node_${index}`;
    tempIds.add(tempId);
    const label = node.label || `Node ${index + 1}`;
    labelToTempId.set(label.toLowerCase(), tempId);
    const rawType = String(node.type || 'action').toLowerCase();
    const type = rawType === 'trigger' ? 'start' : rawType;
    return {
      ...node,
      tempId,
      type,
      label,
      config: normalizeAiWorkflowNodeConfig(type, node.config, {
        ...options,
        label,
        description: node.description,
      }),
      positionX: node.positionX ?? (type === 'condition' ? 350 : 250),
      positionY: node.positionY ?? (100 + index * 150),
      connections: Array.isArray(node.connections) ? node.connections : [],
    };
  });

  const mapped = prepared.map((node) => {
    const connections = (node.connections || [])
      .map((conn) => {
        const to = resolveConnectionTarget(
          conn.to || (conn as any).target || '',
          labelToTempId,
          tempIds,
        );
        if (!to) return null;
        const conditionRaw = conn.conditionType || conn.condition || conn.sourceHandle || '';
        const condition = String(conditionRaw).toLowerCase();
        const sourceHandle = condition === 'true' || condition === 'false'
          ? condition
          : (conn.sourceHandle || null);
        return {
          to,
          conditionType: condition === 'true' || condition === 'false' ? condition : (conn.conditionType || undefined),
          condition: condition === 'true' || condition === 'false' ? condition : undefined,
          sourceHandle,
          targetHandle: conn.targetHandle ?? null,
        };
      })
      .filter(Boolean) as AiWorkflowNodeConnection[];

    return { ...node, connections };
  });

  fillMissingConnections(mapped);

  return mapped;
}
