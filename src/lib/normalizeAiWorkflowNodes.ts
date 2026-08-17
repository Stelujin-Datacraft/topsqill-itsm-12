import type { ComparisonOperator } from '@/types/conditions';
import { normalizeRelativeDateCondition } from '@/utils/conditionOperators';

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
  if ((next.actionType || '').toLowerCase() !== 'change_field_value') return next;

  const firstUpdate = Array.isArray(next.fieldUpdates) ? next.fieldUpdates[0] : undefined;

  // AI often emits fieldId/value instead of targetFieldId/staticValue
  if (!next.targetFieldId) {
    next.targetFieldId = firstUpdate?.targetFieldId || firstUpdate?.fieldId || next.fieldId || '';
  }
  if (!next.targetFieldName) {
    next.targetFieldName = firstUpdate?.targetFieldName || firstUpdate?.fieldName || next.fieldName || next.fieldLabel || next.targetFieldId || '';
  }
  if (!next.targetFormId) {
    next.targetFormId = firstUpdate?.targetFormId || next.formId || triggerFormId || '';
  }
  if (!next.targetFormName) {
    next.targetFormName = firstUpdate?.targetFormName || next.formName || triggerFormName || '';
  }

  const rawValue = next.staticValue ?? firstUpdate?.staticValue ?? next.value ?? firstUpdate?.value;
  const rawDynamic = next.dynamicValuePath ?? firstUpdate?.dynamicValuePath;
  const inferredType = next.valueType || firstUpdate?.valueType
    || (rawDynamic ? 'dynamic' : 'static');

  next.valueType = inferredType;
  if (inferredType === 'static') {
    next.staticValue = rawValue ?? '';
  } else if (rawDynamic) {
    next.dynamicValuePath = rawDynamic;
  }

  if (!Array.isArray(next.fieldUpdates) || next.fieldUpdates.length === 0) {
    next.fieldUpdates = [{
      targetFieldId: next.targetFieldId,
      targetFieldName: next.targetFieldName,
      valueType: next.valueType,
      staticValue: next.valueType === 'static' ? next.staticValue : undefined,
      dynamicValuePath: next.valueType === 'dynamic' ? next.dynamicValuePath : undefined,
    }];
  } else {
    next.fieldUpdates = next.fieldUpdates.map((u: any) => ({
      ...u,
      targetFieldId: u.targetFieldId || u.fieldId || next.targetFieldId,
      targetFieldName: u.targetFieldName || u.fieldName || next.targetFieldName,
      valueType: u.valueType || next.valueType || 'static',
      staticValue: u.staticValue ?? u.value ?? (u.valueType === 'dynamic' ? undefined : next.staticValue),
      dynamicValuePath: u.dynamicValuePath ?? next.dynamicValuePath,
    }));
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
    const dateNorm = normalizeRelativeDateCondition(
      flc.fieldType,
      (flc.operator || '==') as ComparisonOperator,
      flc.value,
    );
    flc.operator = dateNorm.operator;
    flc.value = dateNorm.value ?? '';
    flc.id = flc.id || `flc_${Date.now()}`;
    return flc;
  };

  if (next.enhancedCondition?.conditions?.length) {
    next.enhancedCondition = {
      ...next.enhancedCondition,
      systemType: next.enhancedCondition.systemType || 'field_level',
      conditions: next.enhancedCondition.conditions.map((item: any, idx: number) => {
        if (item?.fieldLevelCondition) {
          return {
            ...item,
            id: item.id || `cond_${idx}`,
            systemType: 'field_level',
            fieldLevelCondition: ensureFlc(item.fieldLevelCondition),
          };
        }
        // Flat condition item
        return {
          id: item?.id || `cond_${idx}`,
          systemType: 'field_level',
          fieldLevelCondition: ensureFlc(item),
        };
      }),
    };
    const first = next.enhancedCondition.conditions[0]?.fieldLevelCondition;
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

  if (next.enhancedCondition?.fieldLevelCondition) {
    const flc = ensureFlc(next.enhancedCondition.fieldLevelCondition);
    next.enhancedCondition = {
      systemType: 'field_level',
      fieldLevelCondition: flc,
      conditions: [{
        id: `cond_0_${Date.now()}`,
        systemType: 'field_level',
        fieldLevelCondition: flc,
      }],
    };
    next.formId = flc.formId;
    next.fieldId = flc.fieldId;
    next.fieldLabel = flc.fieldLabel;
    next.fieldType = flc.fieldType;
    next.operator = flc.operator;
    next.value = flc.value;
    return next;
  }

  // Simple / flat AI condition shapes
  const simple = next.condition || (next.fieldId || next.fieldLabel || next.field ? next : null);
  if (simple) {
    const flc = ensureFlc({
      formId: simple.formId || formId,
      fieldId: simple.fieldId || simple.field,
      fieldLabel: simple.fieldLabel || simple.field,
      fieldType: simple.fieldType || next.fieldType || 'text',
      operator: simple.operator || next.operator || '==',
      value: simple.value ?? next.value,
    });
    next.enhancedCondition = {
      systemType: 'field_level',
      fieldLevelCondition: flc,
      conditions: [{
        id: `cond_0_${Date.now()}`,
        systemType: 'field_level',
        fieldLevelCondition: flc,
      }],
    };
    next.formId = flc.formId;
    next.fieldId = flc.fieldId;
    next.fieldLabel = flc.fieldLabel;
    next.fieldType = flc.fieldType;
    next.operator = flc.operator;
    next.value = flc.value;
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
