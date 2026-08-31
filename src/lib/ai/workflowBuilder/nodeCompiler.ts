/**
 * Compile AIWorkflowDefinition → designer-compatible workflow nodes.
 * Uses existing runtime node types (start/action/condition/wait/end).
 * Approval steps are modeled as: notify approver → wait → condition on decision field.
 * Generic action workflows: Start → Condition → Action → End.
 */
import {
  isApprovalStyleDefinition,
  type AIWorkflowDefinition,
  type WorkflowActionSpec,
} from './types';
import {
  resolveDecisionOptionValue,
  resolvePreferredOptionValue,
  type DecisionFieldMeta,
} from './decisionOptionResolver';
import { describeActionType } from './actionTypeInferrer';
import {
  SUBMISSION_ACCESS_FIELD_LABEL,
  SUBMISSION_ACCESS_FIELD_TYPE,
  mainStatusSyncLabelsForLevel,
} from './metadataDiscovery';

export interface CompiledWorkflowGraph {
  name: string;
  description: string;
  triggerFormId?: string;
  nodes: Array<{
    tempId: string;
    type: string;
    label: string;
    description?: string;
    config: Record<string, any>;
    connections: Array<{ to: string; conditionType?: string; sourceHandle?: string | null }>;
  }>;
}

export interface CompileWorkflowOptions {
  /** Live trigger-form fields — used to bind condition values to real option.value strings */
  formFields?: DecisionFieldMeta[];
  /**
   * Target-form fields for create_record / create_linked_record.
   * When set, create field values resolve against this list instead of the trigger form.
   */
  targetFormFields?: DecisionFieldMeta[];
}

function findField(
  fields: DecisionFieldMeta[] | undefined,
  fieldId?: string,
  fieldLabel?: string,
): DecisionFieldMeta | undefined {
  if (!fields?.length) return undefined;
  if (fieldId) {
    const byId = fields.find((f) => f.id === fieldId);
    if (byId) return byId;
  }
  if (fieldLabel) {
    const key = fieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return fields.find((f) =>
      f.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === key,
    );
  }
  return undefined;
}

function resolveExactOptionValue(
  field: DecisionFieldMeta | undefined,
  label: string,
): string {
  if (!field?.options?.length) return label;
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hit = field.options.find((o) => {
    const v = String(o.value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const l = String(o.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return (v && v === key) || (l && l === key);
  });
  return hit ? String(hit.value) : label;
}

function buildChangeFieldValueNode(params: {
  tempId: string;
  label: string;
  description: string;
  formId: string;
  formName: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  fieldOptions?: DecisionFieldMeta['options'];
  staticValue: unknown;
  nextTo: string;
}): CompiledWorkflowGraph['nodes'][number] {
  return {
    tempId: params.tempId,
    type: 'action',
    label: params.label,
    description: params.description,
    config: {
      actionType: 'change_field_value',
      targetFormId: params.formId,
      targetFormName: params.formName,
      valueType: 'static',
      targetFieldId: params.fieldId,
      targetFieldName: params.fieldLabel,
      targetFieldType: params.fieldType,
      targetFieldOptions: params.fieldOptions,
      staticValue: params.staticValue,
      fieldUpdates: [{
        targetFieldId: params.fieldId,
        targetFieldName: params.fieldLabel,
        targetFieldType: params.fieldType,
        targetFieldOptions: params.fieldOptions,
        valueType: 'static',
        staticValue: params.staticValue,
      }],
    },
    connections: [{ to: params.nextTo }],
  };
}

function resolveCreateFieldValue(
  f: NonNullable<WorkflowActionSpec['createFieldValues']>[number],
  lookupFields?: DecisionFieldMeta[],
): {
  fieldId: string;
  fieldName: string;
  fieldType: string;
  fieldOptions?: DecisionFieldMeta['options'];
  valueType: 'static';
  staticValue: unknown;
} {
  // Prefer the planner's exact field id when present — never remap a target-form
  // UUID onto a different form by label.
  const byId = f.fieldId && lookupFields?.length
    ? lookupFields.find((field) => field.id === f.fieldId)
    : undefined;
  const createField = byId || findField(lookupFields, f.fieldId, f.fieldLabel);
  const fieldId = f.fieldId || createField?.id || '';
  const fieldName = createField?.label || f.fieldLabel || '';
  const fieldType = createField?.type || f.fieldType || 'text';
  const fieldOptions = Array.isArray(createField?.options) ? createField!.options : undefined;
  const staticValue = createField
    ? resolvePreferredOptionValue(createField, f.staticValue)
    : f.staticValue;
  return {
    fieldId,
    fieldName,
    fieldType,
    fieldOptions,
    valueType: 'static',
    staticValue,
  };
}

function buildActionNodeConfig(
  action: WorkflowActionSpec,
  formId: string,
  formName: string,
  formFields?: DecisionFieldMeta[],
  targetFormFields?: DecisionFieldMeta[],
): Record<string, any> {
  const targetField = findField(formFields, action.targetFieldId, action.targetFieldLabel);
  const fieldId = targetField?.id || action.targetFieldId || '';
  const fieldLabel = targetField?.label || action.targetFieldLabel || '';
  const fieldType = targetField?.type || action.targetFieldType || 'text';
  const fieldOptions = Array.isArray(targetField?.options) ? targetField!.options : undefined;
  const staticValue = action.staticValue;

  const base: Record<string, any> = {
    actionType: action.actionType,
    targetFormId: action.targetFormId || formId,
    targetFormName: action.targetFormName || formName,
  };

  const createLookupFields = targetFormFields?.length
    ? targetFormFields
    : (action.targetFormId && action.targetFormId !== formId ? undefined : formFields);

  switch (action.actionType) {
    case 'change_field_value':
      return {
        ...base,
        targetFormId: formId,
        targetFormName: formName,
        valueType: action.valueType || 'static',
        targetFieldId: fieldId,
        targetFieldName: fieldLabel,
        targetFieldType: fieldType,
        targetFieldOptions: fieldOptions,
        staticValue,
        fieldUpdates: [{
          targetFieldId: fieldId,
          targetFieldName: fieldLabel,
          targetFieldType: fieldType,
          targetFieldOptions: fieldOptions,
          valueType: 'static',
          staticValue,
        }],
      };
    case 'create_record': {
      const values = (!action.skipCreateFieldValues ? (action.createFieldValues || []) : [])
        .filter((f) => f.fieldId || f.fieldLabel)
        .map((f) => resolveCreateFieldValue(f, createLookupFields))
        .filter((f) => f.fieldId && f.staticValue !== undefined && String(f.staticValue) !== '');
      const mappings = (!action.skipCreateFieldValues ? (action.createFieldMappings || []) : [])
        .filter((m) => (m.targetFieldId || m.targetFieldLabel) && (m.sourceFieldId || m.sourceFieldLabel))
        .map((m) => {
          const target = findField(createLookupFields, m.targetFieldId, m.targetFieldLabel);
          // Prefer exact source id from trigger form; never remap by label onto target form
          const source = findField(formFields, m.sourceFieldId, m.sourceFieldLabel);
          return {
            sourceFieldId: m.sourceFieldId || source?.id || '',
            sourceFieldName: source?.label || m.sourceFieldLabel || '',
            sourceFieldType: source?.type || m.sourceFieldType || '',
            targetFieldId: m.targetFieldId || target?.id || '',
            targetFieldName: target?.label || m.targetFieldLabel || '',
            targetFieldType: target?.type || m.targetFieldType || '',
          };
        })
        .filter((m) => m.sourceFieldId && m.targetFieldId);
      const hasValues = values.length > 0;
      const hasMaps = mappings.length > 0;
      let fieldConfigMode: 'field_values' | 'field_mapping' | 'none' = 'none';
      if (hasMaps) fieldConfigMode = 'field_mapping';
      else if (hasValues) fieldConfigMode = 'field_values';
      return {
        ...base,
        targetFormId: action.targetFormId || formId,
        targetFormName: action.targetFormName || formName,
        recordCount: action.recordCount || 1,
        fieldValues: values,
        fieldMappings: mappings,
        fieldConfigMode,
        setSubmittedBy: 'trigger_submitter',
        initialStatus: 'pending',
      };
    }
    case 'create_linked_record': {
      const values = (!action.skipCreateFieldValues ? (action.createFieldValues || []) : [])
        .filter((f) => f.fieldId || f.fieldLabel)
        .map((f) => resolveCreateFieldValue(f, createLookupFields))
        .filter((f) => f.fieldId && f.staticValue !== undefined && String(f.staticValue) !== '');
      const mappings = (!action.skipCreateFieldValues ? (action.createFieldMappings || []) : [])
        .filter((m) => (m.targetFieldId || m.targetFieldLabel) && (m.sourceFieldId || m.sourceFieldLabel))
        .map((m) => {
          const target = findField(createLookupFields, m.targetFieldId, m.targetFieldLabel);
          const source = findField(formFields, m.sourceFieldId, m.sourceFieldLabel);
          return {
            sourceFieldId: m.sourceFieldId || source?.id || '',
            sourceFieldName: source?.label || m.sourceFieldLabel || '',
            sourceFieldType: source?.type || m.sourceFieldType || '',
            targetFieldId: m.targetFieldId || target?.id || '',
            targetFieldName: target?.label || m.targetFieldLabel || '',
            targetFieldType: target?.type || m.targetFieldType || '',
          };
        })
        .filter((m) => m.sourceFieldId && m.targetFieldId);
      const hasValues = values.length > 0;
      const hasMaps = mappings.length > 0;
      let fieldConfigMode: 'field_values' | 'field_mapping' | 'none' = 'none';
      // Prefer field_mapping when maps exist; runtime still applies fieldValues after maps
      if (hasMaps && hasValues) fieldConfigMode = 'field_mapping';
      else if (hasMaps) fieldConfigMode = 'field_mapping';
      else if (hasValues) fieldConfigMode = 'field_values';
      return {
        ...base,
        targetFormId: action.targetFormId || formId,
        targetFormName: action.targetFormName || formName,
        crossReferenceFieldId: action.crossReferenceFieldId,
        crossReferenceFieldName: action.crossReferenceFieldLabel,
        recordCount: action.recordCount || 1,
        fieldValues: values,
        fieldMappings: mappings,
        fieldConfigMode,
        setSubmittedBy: 'trigger_submitter',
        autoLinkBack: true,
      };
    }
    case 'update_linked_records': {
      const values = (!action.skipCreateFieldValues ? (action.createFieldValues || []) : [])
        .filter((f) => f.fieldId || f.fieldLabel)
        .map((f) => resolveCreateFieldValue(f, createLookupFields))
        .filter((f) => f.fieldId && f.staticValue !== undefined && String(f.staticValue) !== '');
      // Legacy single-field fallback when older sessions only set targetField*/staticValue
      if (
        !values.length
        && (action.targetFieldId || action.targetFieldLabel)
        && action.staticValue !== undefined
        && action.staticValue !== null
        && String(action.staticValue) !== ''
      ) {
        const legacy = resolveCreateFieldValue({
          fieldId: action.targetFieldId,
          fieldLabel: action.targetFieldLabel,
          fieldType: action.targetFieldType,
          staticValue: action.staticValue,
        }, createLookupFields);
        if (legacy.fieldId) values.push(legacy);
      }
      const mappings = (!action.skipCreateFieldValues ? (action.createFieldMappings || []) : [])
        .filter((m) => (m.targetFieldId || m.targetFieldLabel) && (m.sourceFieldId || m.sourceFieldLabel))
        .map((m) => {
          const target = findField(createLookupFields, m.targetFieldId, m.targetFieldLabel);
          const source = findField(formFields, m.sourceFieldId, m.sourceFieldLabel);
          return {
            sourceFieldId: m.sourceFieldId || source?.id || '',
            sourceFieldName: source?.label || m.sourceFieldLabel || '',
            sourceFieldType: source?.type || m.sourceFieldType || '',
            targetFieldId: m.targetFieldId || target?.id || '',
            targetFieldName: target?.label || m.targetFieldLabel || '',
            targetFieldType: target?.type || m.targetFieldType || '',
          };
        })
        .filter((m) => m.sourceFieldId && m.targetFieldId);
      const hasValues = values.length > 0;
      const hasMaps = mappings.length > 0;
      let fieldConfigMode: 'field_values' | 'field_mapping' | 'both' = 'field_values';
      if (hasMaps && hasValues) fieldConfigMode = 'both';
      else if (hasMaps) fieldConfigMode = 'field_mapping';
      else fieldConfigMode = 'field_values';
      return {
        ...base,
        targetFormId: action.targetFormId || formId,
        targetFormName: action.targetFormName || formName,
        crossReferenceFieldId: action.crossReferenceFieldId,
        crossReferenceFieldName: action.crossReferenceFieldLabel,
        updateScope: action.updateScope || 'all',
        fieldConfigMode,
        fieldMappings: mappings,
        fieldValues: values,
      };
    }
    case 'create_combination_records': {
      const sourceXrId = action.sourceCrossRefFieldId || action.crossReferenceFieldId || '';
      const sourceXrName = action.sourceCrossRefFieldLabel || action.crossReferenceFieldLabel || '';
      const sourceLinkedId = action.sourceLinkedFormId || '';
      const sourceLinkedName = action.sourceLinkedFormName || '';
      const targetId = action.targetFormId || '';
      const targetName = action.targetFormName || '';
      const mode = action.combinationMode || 'single';

      // Auto-link: XR fields on the destination form that point at the source linked form
      // or the trigger form.
      const targetLinkFields: Array<{
        targetFieldId: string;
        targetFieldName?: string;
        linkTo: 'first_source' | 'second_source';
        linkedFormId?: string;
        linkedFormName?: string;
      }> = [];
      const linkFields = createLookupFields || [];
      for (const f of linkFields) {
        const t = String(f.type || '').toLowerCase();
        if (t !== 'cross-reference' && t !== 'child-cross-reference') continue;
        let cfg: Record<string, any> = {};
        const raw = (f as any).custom_config;
        if (typeof raw === 'string') {
          try { cfg = JSON.parse(raw) || {}; } catch { cfg = {}; }
        } else if (raw && typeof raw === 'object') {
          cfg = raw;
        }
        const nested = cfg.crossRefConfig || cfg.cross_ref_config || cfg;
        const pointsTo = String(
          nested?.targetFormId || nested?.target_form_id || cfg.targetFormId || cfg.target_form_id || '',
        ).trim();
        if (sourceLinkedId && pointsTo === sourceLinkedId) {
          targetLinkFields.push({
            targetFieldId: f.id,
            targetFieldName: f.label,
            linkTo: 'first_source',
            linkedFormId: sourceLinkedId,
            linkedFormName: sourceLinkedName,
          });
        } else if (formId && pointsTo === formId) {
          // Prefer linking back to trigger when XR points at trigger form
          targetLinkFields.push({
            targetFieldId: f.id,
            targetFieldName: f.label,
            linkTo: 'first_source',
            linkedFormId: formId,
            linkedFormName: formName,
          });
        } else if (
          mode === 'dual'
          && action.secondSourceLinkedFormId
          && pointsTo === action.secondSourceLinkedFormId
        ) {
          targetLinkFields.push({
            targetFieldId: f.id,
            targetFieldName: f.label,
            linkTo: 'second_source',
            linkedFormId: action.secondSourceLinkedFormId,
            linkedFormName: action.secondSourceLinkedFormName,
          });
        }
      }

      const mapEntry = (m: {
        targetFieldId?: string;
        targetFieldLabel?: string;
        targetFieldType?: string;
        sourceFieldId?: string;
        sourceFieldLabel?: string;
        sourceFieldType?: string;
      }, sourceFields?: DecisionFieldMeta[]) => {
        const target = findField(createLookupFields, m.targetFieldId, m.targetFieldLabel);
        const source = findField(sourceFields || formFields, m.sourceFieldId, m.sourceFieldLabel);
        return {
          sourceFieldId: m.sourceFieldId || source?.id || '',
          sourceFieldName: source?.label || m.sourceFieldLabel || '',
          sourceFieldType: source?.type || m.sourceFieldType || '',
          targetFieldId: m.targetFieldId || target?.id || '',
          targetFieldName: target?.label || m.targetFieldLabel || '',
          targetFieldType: target?.type || m.targetFieldType || '',
        };
      };

      const mappings = (action.createFieldMappings || [])
        .filter((m) => (m.targetFieldId || m.targetFieldLabel) && (m.sourceFieldId || m.sourceFieldLabel))
        .map((m) => mapEntry(m, formFields))
        .filter((m) => m.sourceFieldId && m.targetFieldId);

      const linkedMappings = (action.linkedFormFieldMappings || [])
        .filter((m) => (m.targetFieldId || m.targetFieldLabel) && (m.sourceFieldId || m.sourceFieldLabel))
        .map((m) => mapEntry(m))
        .filter((m) => m.sourceFieldId && m.targetFieldId);

      const secondLinkedMappings = (action.secondLinkedFormFieldMappings || [])
        .filter((m) => (m.targetFieldId || m.targetFieldLabel) && (m.sourceFieldId || m.sourceFieldLabel))
        .map((m) => mapEntry(m))
        .filter((m) => m.sourceFieldId && m.targetFieldId);

      return {
        ...base,
        combinationMode: mode,
        sourceCrossRefFieldId: sourceXrId,
        sourceCrossRefFieldName: sourceXrName,
        sourceLinkedFormId: sourceLinkedId,
        sourceLinkedFormName: sourceLinkedName,
        secondSourceCrossRefFieldId: action.secondSourceCrossRefFieldId,
        secondSourceCrossRefFieldName: action.secondSourceCrossRefFieldLabel,
        secondSourceLinkedFormId: action.secondSourceLinkedFormId,
        secondSourceLinkedFormName: action.secondSourceLinkedFormName,
        targetFormId: targetId,
        targetFormName: targetName,
        targetLinkFields,
        setSubmittedBy: 'trigger_submitter',
        initialStatus: 'pending',
        preventDuplicates: true,
        fieldMappings: mode === 'single' ? mappings : [],
        linkedFormFieldMappings: linkedMappings,
        secondLinkedFormFieldMappings: mode === 'dual' ? secondLinkedMappings : [],
        ...(action.updateTriggerCrossRefFieldId
          ? {
            updateTriggerCrossRefFieldId: action.updateTriggerCrossRefFieldId,
            updateTriggerCrossRefFieldName: action.updateTriggerCrossRefFieldName
              || findField(formFields, action.updateTriggerCrossRefFieldId)?.label
              || '',
          }
          : {}),
      };
    }
    case 'send_notification':
      return {
        ...base,
        notificationConfig: {
          type: 'in_app',
          subject: 'Workflow notification',
          message: 'A workflow condition was met.',
          recipientConfig: {
            type: 'form_submitter',
            emails: [],
          },
        },
      };
    default:
      return base;
  }
}

function compileGenericActionGraph(
  definition: AIWorkflowDefinition,
  options?: CompileWorkflowOptions,
): CompiledWorkflowGraph {
  const formId = definition.trigger.formId || definition.objectId || '';
  const formName = definition.trigger.formName || definition.objectName || '';
  const formFields = options?.formFields || [];
  const nodes: CompiledWorkflowGraph['nodes'] = [];

  const startId = 'node_start';
  const conditionId = 'node_condition';
  const actionId = 'node_action';
  const endTrueId = 'node_end';
  const endFalseId = 'node_end_skip';

  nodes.push({
    tempId: startId,
    type: 'start',
    label: 'Start',
    description: formName ? `${formName} submission` : 'Form submission',
    config: {
      triggerType: definition.trigger.kind || 'form_submission',
      triggerFormId: formId,
      triggerFormName: formName,
    },
    connections: [{ to: conditionId }],
  });

  const cond = definition.conditions[0];
  const condField = findField(formFields, cond?.fieldId, cond?.fieldLabel);
  const fieldId = condField?.id || cond?.fieldId || '';
  const fieldLabel = condField?.label || cond?.fieldLabel || '';
  const fieldType = condField?.type || cond?.fieldType || 'text';
  const operator = cond?.operator || '==';
  // Bind label/synonym → real option.value so runtime == matches submission_data
  const value = resolvePreferredOptionValue(condField, cond?.value ?? '');
  const conditionDeferred = definition.action?.actionType === 'create_combination_records'
    && !fieldId
    && !fieldLabel;

  // Deferred combo conditions must evaluate true at runtime (no field bound yet).
  // Use an empty conditions list so enhanced evaluation short-circuits to true.
  const enhancedCondition = conditionDeferred
    ? {
        systemType: 'field_level',
        logicalOperator: 'AND',
        conditions: [] as Array<Record<string, unknown>>,
      }
    : {
        systemType: 'field_level',
        logicalOperator: 'AND',
        conditions: [{
          id: 'cond_main',
          systemType: 'field_level',
          fieldLevelCondition: {
            formId,
            fieldId,
            fieldLabel,
            fieldType,
            operator,
            value,
          },
        }],
      };

  nodes.push({
    tempId: conditionId,
    type: 'condition',
    label: conditionDeferred
      ? 'Condition (set in designer)'
      : (fieldLabel ? `${fieldLabel} ${operator} ${value}` : 'Condition'),
    description: conditionDeferred
      ? 'Configure this condition node in the workflow designer'
      : `${fieldLabel} ${operator} ${value}`,
    config: {
      formId,
      fieldId: conditionDeferred ? '' : fieldId,
      fieldLabel: conditionDeferred ? '' : fieldLabel,
      fieldType: conditionDeferred ? 'text' : fieldType,
      operator: conditionDeferred ? '==' : operator,
      value: conditionDeferred ? '' : value,
      enhancedCondition,
    },
    connections: [
      { to: actionId, conditionType: 'true', sourceHandle: 'true' },
      { to: endFalseId, conditionType: 'false', sourceHandle: 'false' },
    ],
  });

  const action = definition.action!;
  nodes.push({
    tempId: actionId,
    type: 'action',
    label: describeActionType(action.actionType).split(' (')[0],
    description: describeActionType(action.actionType),
    config: buildActionNodeConfig(
      action,
      formId,
      formName,
      formFields,
      options?.targetFormFields,
    ),
    connections: [{ to: endTrueId }],
  });

  nodes.push({
    tempId: endTrueId,
    type: 'end',
    label: 'Complete',
    description: 'Action completed',
    config: {},
    connections: [],
  });

  nodes.push({
    tempId: endFalseId,
    type: 'end',
    label: 'Skipped',
    description: 'Condition not met',
    config: {},
    connections: [],
  });

  return {
    name: definition.name,
    description: definition.description || definition.name,
    triggerFormId: formId || undefined,
    nodes,
  };
}

/**
 * Build a complete Start → Levels → End graph from the conversational spec.
 */
export function compileWorkflowDefinition(
  definition: AIWorkflowDefinition,
  options?: CompileWorkflowOptions,
): CompiledWorkflowGraph {
  if (!isApprovalStyleDefinition(definition) && definition.action) {
    return compileGenericActionGraph(definition, options);
  }

  const formId = definition.trigger.formId || definition.objectId || '';
  const formName = definition.trigger.formName || definition.objectName || '';
  const formFields = options?.formFields || [];
  const nodes: CompiledWorkflowGraph['nodes'] = [];

  const startId = 'node_start';
  const approvedEndId = 'node_end_approved';
  const rejectedEndId = 'node_end_rejected';

  nodes.push({
    tempId: startId,
    type: 'start',
    label: 'Start',
    description: formName ? `${formName} submission` : 'Form submission',
    config: {
      triggerType: definition.trigger.kind || 'form_submission',
      triggerFormId: formId,
      triggerFormName: formName,
    },
    connections: [],
  });

  const levelNodeIds: Record<number, {
    setAccess: string;
    setPendingStatus?: string;
    notify: string;
    wait: string;
    condition: string;
    setApprovedStatus?: string;
    setRejectedStatus?: string;
  }> = {};

  const accessMeta = findField(
    formFields,
    definition.accessFieldId,
    definition.accessFieldLabel || SUBMISSION_ACCESS_FIELD_LABEL,
  );
  const accessFieldId = accessMeta?.id || definition.accessFieldId || '';
  const accessFieldLabel = accessMeta?.label
    || definition.accessFieldLabel
    || SUBMISSION_ACCESS_FIELD_LABEL;
  const accessFieldType = accessMeta?.type || SUBMISSION_ACCESS_FIELD_TYPE;

  const syncMainStatus = definition.syncMainStatus === true;
  const mainStatusMeta = syncMainStatus
    ? findField(
      formFields,
      definition.mainStatusFieldId,
      definition.mainStatusFieldLabel || 'Status',
    )
    : undefined;
  const mainStatusFieldId = mainStatusMeta?.id || definition.mainStatusFieldId || '';
  const mainStatusFieldLabel = mainStatusMeta?.label
    || definition.mainStatusFieldLabel
    || 'Status';
  const mainStatusFieldType = mainStatusMeta?.type || 'status';

  for (const level of definition.levels) {
    const setAccessId = `node_l${level.level}_set_access`;
    const setPendingStatusId = syncMainStatus
      ? `node_l${level.level}_set_pending_status`
      : undefined;
    const notifyId = `node_l${level.level}_notify`;
    const waitId = `node_l${level.level}_wait`;
    const conditionId = `node_l${level.level}_decision`;
    const setApprovedStatusId = syncMainStatus
      ? `node_l${level.level}_set_approved_status`
      : undefined;
    const setRejectedStatusId = syncMainStatus
      ? `node_l${level.level}_set_rejected_status`
      : undefined;
    levelNodeIds[level.level] = {
      setAccess: setAccessId,
      setPendingStatus: setPendingStatusId,
      notify: notifyId,
      wait: waitId,
      condition: conditionId,
      setApprovedStatus: setApprovedStatusId,
      setRejectedStatus: setRejectedStatusId,
    };

    const decisionField = findField(
      formFields,
      level.approvalFieldId,
      level.approvalFieldLabel,
    );
    const approvedVal = resolveDecisionOptionValue(
      decisionField || (level.approvalFieldLabel
        ? { id: level.approvalFieldId || '', label: level.approvalFieldLabel, type: 'select' }
        : undefined),
      'approved',
      level.level,
    );
    const fieldType = decisionField?.type || 'select';
    const fieldId = decisionField?.id || level.approvalFieldId || '';
    const fieldLabel = decisionField?.label || level.approvalFieldLabel || '';

    const approverLabel = level.approver.entityLabel
      || level.approver.fieldLabel
      || level.approver.rawHint
      || `Level ${level.level} Approver`;
    const userId = level.approver.type === 'user' ? (level.approver.entityId || '') : '';
    const sacValue = {
      users: userId ? [userId] : [],
      groups: [] as string[],
    };

    const syncLabels = mainStatusSyncLabelsForLevel(level.level);
    const afterAccess = setPendingStatusId || notifyId;

    // 1) Set Submission Access Control to this level's approver user
    nodes.push({
      tempId: setAccessId,
      type: 'action',
      label: `Set Level ${level.level} Approver`,
      description: `Set ${accessFieldLabel} to ${approverLabel}`,
      config: {
        actionType: 'change_field_value',
        targetFormId: formId,
        targetFormName: formName,
        valueType: 'static',
        targetFieldId: accessFieldId,
        targetFieldName: accessFieldLabel,
        targetFieldType: accessFieldType,
        staticValue: sacValue,
        fieldUpdates: [{
          targetFieldId: accessFieldId,
          targetFieldName: accessFieldLabel,
          targetFieldType: accessFieldType,
          valueType: 'static',
          staticValue: sacValue,
        }],
      },
      connections: [{ to: afterAccess }],
    });

    // 1b) Waiting on this level → main Status = Pending with Level N
    if (syncMainStatus && setPendingStatusId) {
      nodes.push(buildChangeFieldValueNode({
        tempId: setPendingStatusId,
        label: `Set Status: ${syncLabels.pending}`,
        description: `Set ${mainStatusFieldLabel} to ${syncLabels.pending}`,
        formId,
        formName,
        fieldId: mainStatusFieldId,
        fieldLabel: mainStatusFieldLabel,
        fieldType: mainStatusFieldType,
        fieldOptions: mainStatusMeta?.options,
        staticValue: resolveExactOptionValue(mainStatusMeta, syncLabels.pending),
        nextTo: notifyId,
      }));
    }

    // 2) Notify via dynamic recipients from Submission Access Control
    nodes.push({
      tempId: notifyId,
      type: 'action',
      label: `Notify Level ${level.level}: ${approverLabel}`,
      description: `Send approval request to ${approverLabel}`,
      config: {
        actionType: 'send_notification',
        notificationConfig: {
          type: 'in_app',
          subject: `Level ${level.level} approval required`,
          message: `Please review and set ${fieldLabel || 'approval decision'} for this submission.`,
          recipientConfig: accessFieldId
            ? {
                type: 'dynamic',
                dynamicFieldPath: accessFieldId,
                emails: [],
              }
            : {
                type: 'form_submitter',
                emails: [],
              },
        },
        targetFormId: formId,
        targetFormName: formName,
      },
      connections: [{ to: waitId }],
    });

    nodes.push({
      tempId: waitId,
      type: 'wait',
      label: `Wait for Level ${level.level} Decision`,
      description: 'Wait for approver action',
      config: {
        waitType: 'duration',
        duration: 24,
        durationUnit: 'hours',
      },
      connections: [{ to: conditionId }],
    });

    nodes.push({
      tempId: conditionId,
      type: 'condition',
      label: `Level ${level.level} Decision`,
      description: `${fieldLabel || 'Decision'} == ${approvedVal}`,
      config: {
        formId,
        fieldId,
        fieldLabel,
        fieldType,
        operator: '==',
        value: approvedVal,
        enhancedCondition: {
          systemType: 'field_level',
          logicalOperator: 'AND',
          conditions: [{
            id: `cond_l${level.level}`,
            systemType: 'field_level',
            fieldLevelCondition: {
              formId,
              fieldId,
              fieldLabel,
              fieldType,
              operator: '==',
              value: approvedVal,
            },
          }],
        },
      },
      connections: [], // filled below
    });
  }

  nodes.push({
    tempId: approvedEndId,
    type: 'end',
    label: 'Approved',
    description: 'Workflow complete — approved',
    config: {},
    connections: [],
  });

  const needsReturnToRequester = definition.levels.some(
    (l) => l.onRejection?.action === 'RETURN_TO_REQUESTER',
  );
  const needsRejectedEnd = definition.levels.some(
    (l) => l.onRejection?.action === 'END_WORKFLOW',
  );
  const notifyRequesterId = 'node_notify_requester';
  const returnedEndId = 'node_end_returned';

  // Only create return-to-requester / rejected ends when a level actually uses them
  // (avoids orphan End nodes on the canvas).
  if (needsReturnToRequester) {
    nodes.push({
      tempId: notifyRequesterId,
      type: 'action',
      label: 'Notify Requester: Returned',
      description: 'Tell the submitter the request was returned for changes',
      config: {
        actionType: 'send_notification',
        notificationConfig: {
          type: 'in_app',
          subject: 'Your submission was returned',
          message: 'An approver returned this submission. Please review and update it.',
          recipientConfig: {
            type: 'form_submitter',
            emails: [],
          },
        },
        targetFormId: formId,
        targetFormName: formName,
      },
      connections: [{ to: returnedEndId }],
    });
    nodes.push({
      tempId: returnedEndId,
      type: 'end',
      label: 'Returned to Requester',
      description: 'Approval stopped — returned to submitter',
      config: {},
      connections: [],
    });
  }

  if (needsRejectedEnd) {
    nodes.push({
      tempId: rejectedEndId,
      type: 'end',
      label: 'Rejected',
      description: 'Workflow ended — rejected',
      config: {},
      connections: [],
    });
  }

  // Wire start → first level set-access
  const first = definition.levels[0];
  if (first) {
    const start = nodes.find((n) => n.tempId === startId)!;
    start.connections = [{ to: levelNodeIds[first.level].setAccess }];
  } else {
    const start = nodes.find((n) => n.tempId === startId)!;
    start.connections = [{ to: approvedEndId }];
  }

  // Wire each level condition true/false
  for (let i = 0; i < definition.levels.length; i++) {
    const level = definition.levels[i];
    const ids = levelNodeIds[level.level];
    const conditionNode = nodes.find((n) => n.tempId === ids.condition)!;
    const nextLevel = definition.levels[i + 1];
    const syncLabels = mainStatusSyncLabelsForLevel(level.level);

    let trueTarget = approvedEndId;
    if (level.onApprovalNext === 'complete' || !nextLevel) {
      trueTarget = approvedEndId;
    } else if (nextLevel) {
      trueTarget = levelNodeIds[nextLevel.level].setAccess;
    }

    // Default: retry this level (never point at a missing orphan End)
    let falseTarget = ids.setAccess;
    const rej = level.onRejection;
    if (rej?.action === 'RETURN_TO_LEVEL' && rej.targetLevel && levelNodeIds[rej.targetLevel]) {
      falseTarget = levelNodeIds[rej.targetLevel].setAccess;
    } else if (rej?.action === 'RETURN_TO_REQUESTER' && needsReturnToRequester) {
      falseTarget = notifyRequesterId;
    } else if (rej?.action === 'START_OVER' && first) {
      falseTarget = levelNodeIds[first.level].setAccess;
    } else if (rej?.action === 'END_WORKFLOW' && needsRejectedEnd) {
      falseTarget = rejectedEndId;
    }

    if (
      syncMainStatus
      && ids.setApprovedStatus
      && ids.setRejectedStatus
      && mainStatusFieldId
    ) {
      nodes.push(buildChangeFieldValueNode({
        tempId: ids.setApprovedStatus,
        label: `Set Status: ${syncLabels.approved}`,
        description: `Set ${mainStatusFieldLabel} to ${syncLabels.approved}`,
        formId,
        formName,
        fieldId: mainStatusFieldId,
        fieldLabel: mainStatusFieldLabel,
        fieldType: mainStatusFieldType,
        fieldOptions: mainStatusMeta?.options,
        staticValue: resolveExactOptionValue(mainStatusMeta, syncLabels.approved),
        nextTo: trueTarget,
      }));
      nodes.push(buildChangeFieldValueNode({
        tempId: ids.setRejectedStatus,
        label: `Set Status: ${syncLabels.rejected}`,
        description: `Set ${mainStatusFieldLabel} to ${syncLabels.rejected}`,
        formId,
        formName,
        fieldId: mainStatusFieldId,
        fieldLabel: mainStatusFieldLabel,
        fieldType: mainStatusFieldType,
        fieldOptions: mainStatusMeta?.options,
        staticValue: resolveExactOptionValue(mainStatusMeta, syncLabels.rejected),
        nextTo: falseTarget,
      }));
      conditionNode.connections = [
        { to: ids.setApprovedStatus, conditionType: 'true', sourceHandle: 'true' },
        { to: ids.setRejectedStatus, conditionType: 'false', sourceHandle: 'false' },
      ];
    } else {
      conditionNode.connections = [
        { to: trueTarget, conditionType: 'true', sourceHandle: 'true' },
        { to: falseTarget, conditionType: 'false', sourceHandle: 'false' },
      ];
    }
  }

  return {
    name: definition.name,
    description: definition.description || definition.name,
    triggerFormId: formId || undefined,
    nodes,
  };
}
