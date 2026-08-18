/**
 * Backend-side normalization for AI workflow node graphs.
 * Mirrors frontend src/lib/normalizeAiWorkflowNodes.ts (keep behavior aligned).
 */

export interface NormalizeAiWorkflowNodesOptions {
  triggerFormId?: string;
  triggerFormName?: string;
}

const DESIGNER_ACTION_TYPES = new Set([
  'send_notification',
  'change_field_value',
  'create_record',
  'create_linked_record',
  'update_linked_records',
  'create_combination_records',
]);

const CHANGE_FIELD_ALIASES = new Set([
  'change_field_value', 'change_field', 'set_field_value', 'set_field', 'set_field_values',
  'update_field_value', 'update_field', 'update_field_values', 'set_value',
]);

const NOTIFICATION_ALIASES = new Set([
  'send_notification', 'send_email', 'send_sms', 'notify', 'notification', 'email',
  'approve_form', 'disapprove_form', 'assign_form', 'assign', 'review', 'verify', 'approval', 'escalate',
]);

function hasFieldUpdateShape(config: Record<string, any>): boolean {
  return (Array.isArray(config.fieldUpdates) && config.fieldUpdates.length > 0)
    || !!config.targetFieldId
    || !!config.fieldId
    || (!!config.field && (config.value !== undefined || config.staticValue !== undefined || config.newValue !== undefined));
}

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
  if (DESIGNER_ACTION_TYPES.has(rawAction)) return rawAction;
  if (NOTIFICATION_ALIASES.has(rawAction)) return 'send_notification';
  if (/set|change|update/.test(haystack) && /field|value|status|married|gender|dob|birth/.test(haystack)) {
    return 'change_field_value';
  }
  if (/create\s+linked|linked\s+record/.test(haystack)) return 'create_linked_record';
  if (/create\s+combination|combination\s+record/.test(haystack)) return 'create_combination_records';
  if (/create\s+record/.test(haystack)) return 'create_record';
  if (/review|verif|approv|reject|assign|notify|email|escalat|hr\b|manager|level\s*\d/.test(haystack)) {
    return 'send_notification';
  }
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
  options?: NormalizeAiWorkflowNodesOptions & { label?: string; description?: string },
): Record<string, any> {
  const type = String(nodeType || '').toLowerCase();
  let next = { ...(config || {}) };
  if (type === 'start' || type === 'trigger') next = normalizeStartConfig(next, options);
  else if (type === 'condition' || type === 'branch' || type === 'decision') {
    next = normalizeConditionConfig(next, options?.triggerFormId);
  } else if (type === 'action') {
    const actionType = inferDesignerActionType(next, options?.label, options?.description);
    next.actionType = actionType;
    if (actionType === 'change_field_value') {
      next = normalizeChangeFieldValueConfig(next, options?.triggerFormId, options?.triggerFormName);
    } else if (actionType === 'send_notification') {
      next = ensureNotificationConfig(next, options?.label);
    }
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

function pickApproveEnd(ends: any[]): any | undefined {
  return ends.find((n) => /approv|success|complete|done|accept|pass/i.test(n.label)) || ends[0];
}

function pickRejectEnd(ends: any[], approve?: any): any | undefined {
  return ends.find((n) =>
    n.tempId !== approve?.tempId
    && /reject|deny|fail|need|update|revision|return|cancel/i.test(n.label),
  ) || ends.find((n) => n.tempId !== approve?.tempId);
}

function findNextNonEnd(mapped: any[], fromIndex: number): any | undefined {
  for (let j = fromIndex + 1; j < mapped.length; j++) {
    if (String(mapped[j].type).toLowerCase() !== 'end') return mapped[j];
  }
  return undefined;
}

function fillMissingConnections(mapped: any[]): void {
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
      const hasTrue = conns.some((c: any) =>
        String(c.conditionType || c.condition || c.sourceHandle || '').toLowerCase() === 'true',
      );
      const hasFalse = conns.some((c: any) =>
        String(c.conditionType || c.condition || c.sourceHandle || '').toLowerCase() === 'false',
      );
      const next = findNextNonEnd(mapped, i) || mapped[i + 1];
      if (!hasTrue && next) {
        conns.push({ to: next.tempId, conditionType: 'true', sourceHandle: 'true' });
      }
      if (!hasFalse) {
        const falseTarget = rejectEnd
          || ends.find((e: any) => e.tempId !== (conns.find((c: any) =>
            String(c.conditionType || c.sourceHandle).toLowerCase() === 'true'
          )?.to))
          || approveEnd
          || next;
        if (falseTarget) {
          conns.push({ to: falseTarget.tempId, conditionType: 'false', sourceHandle: 'false' });
        }
      }
      source.connections = conns;
      continue;
    }

    if (conns.length > 0) {
      source.connections = conns;
      continue;
    }

    const nextNonEnd = findNextNonEnd(mapped, i);
    if (nextNonEnd) {
      source.connections = [{ to: nextNonEnd.tempId }];
    } else if (approveEnd) {
      source.connections = [{ to: approveEnd.tempId }];
    } else if (mapped[i + 1]) {
      source.connections = [{ to: mapped[i + 1].tempId }];
    }
  }
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
          condition: condition === 'true' || condition === 'false' ? condition : undefined,
          sourceHandle,
          targetHandle: conn.targetHandle ?? null,
        };
      })
      .filter(Boolean);

    return { ...node, connections };
  });

  fillMissingConnections(mapped);

  return mapped;
}
