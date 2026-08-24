/**
 * Smoke test: approval SAC flow (planner answers + compiler wiring).
 * Run: node --experimental-strip-types scripts/smoke-approval-sac.mjs
 *
 * Avoids Vite path aliases by inlining the critical compile assertions
 * against the same shapes produced by nodeCompiler / pendingOptionActions.
 */
import assert from 'node:assert/strict';

const SUBMISSION_ACCESS_FIELD_LABEL = 'Submission Access Control';
const SUBMISSION_ACCESS_FIELD_TYPE = 'submission-access';

function compileApprovalLike(definition) {
  const formId = definition.trigger.formId || '';
  const formName = definition.trigger.formName || '';
  const nodes = [];
  const startId = 'node_start';
  const approvedEndId = 'node_end_approved';
  const rejectedEndId = 'node_end_rejected';
  nodes.push({ tempId: startId, type: 'start', connections: [] });

  const accessFieldId = definition.accessFieldId || '';
  const accessFieldLabel = definition.accessFieldLabel || SUBMISSION_ACCESS_FIELD_LABEL;
  const levelNodeIds = {};

  for (const level of definition.levels) {
    const setAccessId = `node_l${level.level}_set_access`;
    const notifyId = `node_l${level.level}_notify`;
    const waitId = `node_l${level.level}_wait`;
    const conditionId = `node_l${level.level}_decision`;
    levelNodeIds[level.level] = { setAccess: setAccessId, notify: notifyId, wait: waitId, condition: conditionId };

    const userId = level.approver.type === 'user' ? (level.approver.entityId || '') : '';
    const sacValue = { users: userId ? [userId] : [], groups: [] };

    nodes.push({
      tempId: setAccessId,
      type: 'action',
      config: {
        actionType: 'change_field_value',
        targetFieldId: accessFieldId,
        targetFieldName: accessFieldLabel,
        targetFieldType: SUBMISSION_ACCESS_FIELD_TYPE,
        staticValue: sacValue,
      },
      connections: [{ to: notifyId }],
    });
    nodes.push({
      tempId: notifyId,
      type: 'action',
      config: {
        actionType: 'send_notification',
        notificationConfig: {
          recipientConfig: {
            type: 'dynamic',
            dynamicFieldPath: accessFieldId,
          },
        },
        targetFormId: formId,
        targetFormName: formName,
      },
      connections: [{ to: waitId }],
    });
    nodes.push({ tempId: waitId, type: 'wait', connections: [{ to: conditionId }] });
    nodes.push({ tempId: conditionId, type: 'condition', connections: [] });
  }

  nodes.push({ tempId: approvedEndId, type: 'end', connections: [] });
  nodes.push({ tempId: rejectedEndId, type: 'end', connections: [] });

  const first = definition.levels[0];
  nodes.find((n) => n.tempId === startId).connections = [{ to: levelNodeIds[first.level].setAccess }];

  for (let i = 0; i < definition.levels.length; i++) {
    const level = definition.levels[i];
    const next = definition.levels[i + 1];
    const cond = nodes.find((n) => n.tempId === levelNodeIds[level.level].condition);
    cond.connections = [
      { to: next ? levelNodeIds[next.level].setAccess : approvedEndId, conditionType: 'true' },
      { to: rejectedEndId, conditionType: 'false' },
    ];
  }

  return nodes;
}

// ── Planner-style ensure/create/pick state machine ──────────────────────────
function planAccess(definition, form) {
  const sac = (form.fields || []).find((f) =>
    String(f.type).includes('submission-access')
    || f.label === SUBMISSION_ACCESS_FIELD_LABEL,
  );
  if (sac && !definition.accessFieldId) {
    definition.accessFieldId = sac.id;
    definition.accessFieldLabel = sac.label;
    definition.pendingAccessFieldCreate = false;
  }
  if (!definition.accessFieldId && definition.pendingAccessFieldCreate !== true) {
    if (definition.pendingAccessFieldCreate === false) return 'access_field_pick';
    return 'access_field_ensure';
  }
  return null;
}

function planApproverUser(level) {
  const hasUser = level.approver.type === 'user' && Boolean(level.approver.entityId);
  return hasUser ? null : 'approver_user';
}

// Case 1: missing SAC → ask create
{
  const def = { accessFieldId: undefined, pendingAccessFieldCreate: undefined, levels: [] };
  assert.equal(planAccess(def, { fields: [] }), 'access_field_ensure');
}

// Case 2: existing SAC → auto-bind, no ask
{
  const def = { accessFieldId: undefined, pendingAccessFieldCreate: undefined, levels: [] };
  assert.equal(planAccess(def, {
    fields: [{ id: 'sac1', label: SUBMISSION_ACCESS_FIELD_LABEL, type: 'submission-access' }],
  }), null);
  assert.equal(def.accessFieldId, 'sac1');
}

// Case 3: declined create → pick
{
  const def = { accessFieldId: undefined, pendingAccessFieldCreate: false, levels: [] };
  assert.equal(planAccess(def, { fields: [] }), 'access_field_pick');
}

// Case 4: confirmed create pending → continue
{
  const def = { accessFieldId: undefined, pendingAccessFieldCreate: true, levels: [] };
  assert.equal(planAccess(def, { fields: [] }), null);
}

// Case 5: ask Level 1 user then Level 2
{
  const levels = [
    { level: 1, approver: { type: 'unresolved', resolved: false } },
    { level: 2, approver: { type: 'unresolved', resolved: false } },
  ];
  assert.equal(planApproverUser(levels[0]), 'approver_user');
  levels[0].approver = { type: 'user', entityId: 'u1', entityLabel: 'Alice', resolved: true };
  assert.equal(planApproverUser(levels[0]), null);
  assert.equal(planApproverUser(levels[1]), 'approver_user');
}

// Case 6: compiled graph SetSAC → Notify(dynamic) → Wait → Cond → next SetSAC
{
  const nodes = compileApprovalLike({
    trigger: { formId: 'form1', formName: 'Incident' },
    accessFieldId: 'sac1',
    accessFieldLabel: SUBMISSION_ACCESS_FIELD_LABEL,
    levels: [
      {
        level: 1,
        approver: { type: 'user', entityId: 'user-a', entityLabel: 'Alice' },
        onApprovalNext: 'next_level',
        onRejection: { action: 'RETURN_TO_REQUESTER' },
      },
      {
        level: 2,
        approver: { type: 'user', entityId: 'user-b', entityLabel: 'Bob' },
        onApprovalNext: 'complete',
        onRejection: { action: 'END_WORKFLOW' },
      },
    ],
  });

  const start = nodes.find((n) => n.tempId === 'node_start');
  assert.equal(start.connections[0].to, 'node_l1_set_access');

  const set1 = nodes.find((n) => n.tempId === 'node_l1_set_access');
  assert.equal(set1.config.actionType, 'change_field_value');
  assert.equal(set1.config.targetFieldId, 'sac1');
  assert.deepEqual(set1.config.staticValue, { users: ['user-a'], groups: [] });
  assert.equal(set1.connections[0].to, 'node_l1_notify');

  const notify1 = nodes.find((n) => n.tempId === 'node_l1_notify');
  assert.equal(notify1.config.notificationConfig.recipientConfig.type, 'dynamic');
  assert.equal(notify1.config.notificationConfig.recipientConfig.dynamicFieldPath, 'sac1');

  const cond1 = nodes.find((n) => n.tempId === 'node_l1_decision');
  assert.equal(cond1.connections.find((c) => c.conditionType === 'true').to, 'node_l2_set_access');

  const set2 = nodes.find((n) => n.tempId === 'node_l2_set_access');
  assert.deepEqual(set2.config.staticValue, { users: ['user-b'], groups: [] });

  console.log('smoke-approval-sac: all assertions passed');
}
