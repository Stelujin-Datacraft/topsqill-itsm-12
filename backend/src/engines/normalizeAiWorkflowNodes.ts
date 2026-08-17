/**
 * Backend-side normalization for AI workflow node graphs.
 * Mirrors frontend src/lib/normalizeAiWorkflowNodes.ts (keep behavior aligned).
 */

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
  if (String(next.actionType || '').toLowerCase() !== 'change_field_value') return next;

  const firstUpdate = Array.isArray(next.fieldUpdates) ? next.fieldUpdates[0] : undefined;
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
  const inferredType = next.valueType || firstUpdate?.valueType || (rawDynamic ? 'dynamic' : 'static');
  next.valueType = inferredType;
  if (inferredType === 'static') next.staticValue = rawValue ?? '';
  else if (rawDynamic) next.dynamicValuePath = rawDynamic;

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

function normalizeConditionConfig(config: Record<string, any>, triggerFormId?: string): Record<string, any> {
  const next = { ...config };
  const formId = next.formId || triggerFormId || '';

  const ensureFlc = (raw: any) => {
    const flc = { ...(raw || {}) };
    flc.formId = flc.formId || formId;
    flc.fieldId = flc.fieldId || flc.field || '';
    flc.fieldLabel = flc.fieldLabel || flc.fieldName || flc.field || '';
    flc.fieldType = flc.fieldType || 'text';
    // Normalize operator aliases (equals → ==) then relative dates
    const aliases: Record<string, string> = {
      equals: '==', equal: '==', is: '==', not_equals: '!=', not_equal: '!=',
      today: 'is_today', yesterday: 'is_yesterday', tomorrow: 'is_tomorrow',
    };
    const opRaw = String(flc.operator ?? '==').trim();
    const opNorm = aliases[opRaw.toLowerCase().replace(/[\s-]+/g, '_')] || opRaw;
    flc.operator = opNorm;
    const rawVal = String(flc.value ?? '').trim().toLowerCase();
    if (['date', 'datetime', 'date-time', 'datetime-local'].includes(String(flc.fieldType).toLowerCase())) {
      if ((opNorm === '==' || opNorm === 'equals') && /^(today|todays date|today'?s date|current date|now)$/.test(rawVal)) {
        flc.operator = 'is_today';
        flc.value = '';
      }
    }
    flc.id = flc.id || `flc_${Date.now()}`;
    return flc;
  };

  if (next.enhancedCondition?.conditions?.length) {
    next.enhancedCondition = {
      ...next.enhancedCondition,
      systemType: next.enhancedCondition.systemType || 'field_level',
      conditions: next.enhancedCondition.conditions.map((item: any, idx: number) => ({
        ...item,
        id: item?.id || `cond_${idx}`,
        systemType: 'field_level',
        fieldLevelCondition: ensureFlc(item?.fieldLevelCondition || item),
      })),
    };
    const first = next.enhancedCondition.conditions[0]?.fieldLevelCondition;
    if (first) {
      Object.assign(next, {
        formId: first.formId,
        fieldId: first.fieldId,
        fieldLabel: first.fieldLabel,
        fieldType: first.fieldType,
        operator: first.operator,
        value: first.value,
      });
    }
    return next;
  }

  if (next.enhancedCondition?.fieldLevelCondition) {
    const flc = ensureFlc(next.enhancedCondition.fieldLevelCondition);
    next.enhancedCondition = {
      systemType: 'field_level',
      fieldLevelCondition: flc,
      conditions: [{ id: `cond_0_${Date.now()}`, systemType: 'field_level', fieldLevelCondition: flc }],
    };
    Object.assign(next, {
      formId: flc.formId, fieldId: flc.fieldId, fieldLabel: flc.fieldLabel,
      fieldType: flc.fieldType, operator: flc.operator, value: flc.value,
    });
    return next;
  }

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
      conditions: [{ id: `cond_0_${Date.now()}`, systemType: 'field_level', fieldLevelCondition: flc }],
    };
    Object.assign(next, {
      formId: flc.formId, fieldId: flc.fieldId, fieldLabel: flc.fieldLabel,
      fieldType: flc.fieldType, operator: flc.operator, value: flc.value,
    });
  }
  return next;
}

function normalizeStartConfig(config: Record<string, any>, options?: NormalizeAiWorkflowNodesOptions) {
  const next = { ...config };
  const triggerFormId = options?.triggerFormId || next.triggerFormId || next.formId || '';
  const triggerFormName = options?.triggerFormName || next.triggerFormName || next.formName || '';
  if (triggerFormId) {
    next.triggerFormId = triggerFormId;
    next.formId = next.formId || triggerFormId;
  }
  if (triggerFormName) next.triggerFormName = triggerFormName;
  const rawType = String(next.triggerType || 'form_submission').toLowerCase();
  next.triggerType = (rawType === 'trigger' || rawType === 'form' || !rawType)
    ? 'form_submission'
    : (next.triggerType || 'form_submission');
  return next;
}

export function normalizeAiWorkflowNodeConfig(
  nodeType: string,
  config: Record<string, any> | undefined,
  options?: NormalizeAiWorkflowNodesOptions,
): Record<string, any> {
  const type = String(nodeType || '').toLowerCase();
  let next = { ...(config || {}) };
  if (type === 'start' || type === 'trigger') next = normalizeStartConfig(next, options);
  else if (type === 'condition' || type === 'branch' || type === 'decision') {
    next = normalizeConditionConfig(next, options?.triggerFormId);
  } else if (type === 'action') {
    next = normalizeChangeFieldValueConfig(next, options?.triggerFormId, options?.triggerFormName);
    if (!next.targetFormId && options?.triggerFormId) next.targetFormId = options.triggerFormId;
    if (!next.targetFormName && options?.triggerFormName) next.targetFormName = options.triggerFormName;
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
  for (const [label, tempId] of labelToTempId.entries()) {
    if (label.includes(to.toLowerCase()) || to.toLowerCase().includes(label)) return tempId;
  }
  return undefined;
}

/** Normalize AI node list before DB insert (tempIds, start form, edges, action/condition values). */
export function mapAndNormalizeAiWorkflowNodes(
  nodes: any[],
  options?: NormalizeAiWorkflowNodesOptions,
): any[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const labelToTempId = new Map<string, string>();
  const tempIds = new Set<string>();

  const prepared = nodes.map((node, index) => {
    const tempId = node.tempId || `node_${index}`;
    tempIds.add(tempId);
    const label = node.label || `Node ${index + 1}`;
    labelToTempId.set(String(label).toLowerCase(), tempId);
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
      .map((conn: any) => {
        const to = resolveConnectionTarget(conn.to || conn.target || '', labelToTempId, tempIds);
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
      .filter(Boolean);

    return { ...node, connections };
  });

  const hasAnyConnection = mapped.some((n) => (n.connections || []).length > 0);
  if (!hasAnyConnection && mapped.length > 1) {
    for (let i = 0; i < mapped.length - 1; i++) {
      const source = mapped[i];
      const target = mapped[i + 1];
      if (String(source.type).toLowerCase() === 'end') continue;
      if (String(source.type).toLowerCase() === 'condition') {
        const endNode = mapped.find((n) => String(n.type).toLowerCase() === 'end' && n.tempId !== target.tempId);
        source.connections = [
          { to: target.tempId, conditionType: 'true', sourceHandle: 'true' },
          { to: endNode?.tempId || target.tempId, conditionType: 'false', sourceHandle: 'false' },
        ];
      } else {
        source.connections = [{ to: target.tempId }];
      }
    }
  }

  return mapped;
}
