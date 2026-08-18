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

function normalizeChangeFieldValueConfig(
  config: Record<string, any>,
  triggerFormId?: string,
  triggerFormName?: string,
): Record<string, any> {
  const next = { ...config };

  const rawAction = String(next.actionType || '').toLowerCase().replace(/[\s-]+/g, '_');
  const actionAliases = new Set([
    'change_field_value',
    'change_field',
    'set_field_value',
    'set_field',
    'update_field_value',
    'update_field',
    'update_field_values',
    'set_value',
  ]);
  const hasFieldUpdateShape = (Array.isArray(next.fieldUpdates) && next.fieldUpdates.length > 0)
    || !!next.targetFieldId
    || !!next.fieldId
    || (!!next.field && (next.value !== undefined || next.staticValue !== undefined || next.newValue !== undefined));

  // Only normalize Change Field Value (aliases, explicit type, or untyped field-update shape)
  if (actionAliases.has(rawAction)) {
    next.actionType = 'change_field_value';
  } else if (!rawAction && hasFieldUpdateShape) {
    next.actionType = 'change_field_value';
  } else if (rawAction !== 'change_field_value') {
    return next;
  } else {
    next.actionType = 'change_field_value';
  }

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
  options?: NormalizeAiWorkflowNodesOptions,
): Record<string, any> {
  const type = String(nodeType || '').toLowerCase();
  let next = { ...(config || {}) };

  if (type === 'start' || type === 'trigger') {
    next = normalizeStartConfig(next, options);
  } else if (type === 'condition' || type === 'branch' || type === 'decision') {
    next = normalizeConditionConfig(next, options?.triggerFormId);
  } else if (type === 'action') {
    next = normalizeChangeFieldValueConfig(next, options?.triggerFormId, options?.triggerFormName);
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

/**
 * Map AI/suggested workflow nodes into tempId-based definitions with:
 * - Start triggerFormId/Name stamped
 * - Connections remapped from labels → tempIds (+ sequential fallback)
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
      config: normalizeAiWorkflowNodeConfig(type, node.config, options),
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
          sourceHandle,
          targetHandle: conn.targetHandle ?? null,
        };
      })
      .filter(Boolean) as AiWorkflowNodeConnection[];

    return { ...node, connections };
  });

  // Sequential auto-connect when AI omitted edges (preserves existing edges when present)
  const hasAnyConnection = mapped.some((n) => (n.connections || []).length > 0);
  if (!hasAnyConnection && mapped.length > 1) {
    for (let i = 0; i < mapped.length - 1; i++) {
      const source = mapped[i];
      const target = mapped[i + 1];
      if (String(source.type).toLowerCase() === 'end') continue;
      if (String(source.type).toLowerCase() === 'condition') {
        source.connections = [
          { to: target.tempId!, conditionType: 'true', sourceHandle: 'true' },
        ];
        // Prefer linking false branch to end if present, else same next node
        const endNode = mapped.find((n) => String(n.type).toLowerCase() === 'end' && n.tempId !== target.tempId);
        source.connections.push({
          to: (endNode?.tempId || target.tempId)!,
          conditionType: 'false',
          sourceHandle: 'false',
        });
      } else {
        source.connections = [{ to: target.tempId! }];
      }
    }
  }

  return mapped;
}
