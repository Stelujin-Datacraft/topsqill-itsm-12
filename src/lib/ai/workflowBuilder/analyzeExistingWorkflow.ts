/**
 * Analyze an open designer workflow graph so AI Suggest can continue it
 * (edit / append) or REPLACE it intentionally.
 */
export type WorkflowApplyMode = 'edit' | 'append' | 'extend' | 'replace';

export interface ExistingWorkflowNodeSummary {
  id: string;
  type: string;
  label: string;
  actionType?: string;
  triggerFormId?: string;
  triggerFormName?: string;
  conditionFieldLabel?: string;
  conditionOperator?: string;
  conditionValue?: string;
}

export interface ExistingWorkflowGraphSummary {
  nodeCount: number;
  connectionCount: number;
  hasMeaningfulNodes: boolean;
  startNodeId?: string;
  triggerFormId?: string;
  triggerFormName?: string;
  triggerType?: string;
  endNodeIds: string[];
  /** Nodes with no outgoing edges (graft candidates, excluding ends when they exist) */
  tailNodeIds: string[];
  actionTypes: string[];
  hasCondition: boolean;
  hasApprovalPattern: boolean;
  nodes: ExistingWorkflowNodeSummary[];
  /** Nodes the user can edit in-place (excludes End) */
  editableNodes: ExistingWorkflowNodeSummary[];
  lines: string[];
}

type LooseNode = {
  id: string;
  type: string;
  label: string;
  position?: { x: number; y: number };
  data?: { config?: Record<string, any>; description?: string };
};

type LooseConnection = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string;
};

function cfg(node: LooseNode): Record<string, any> {
  return (node.data?.config && typeof node.data.config === 'object')
    ? node.data.config
    : {};
}

function conditionSummary(node: LooseNode): Pick<
  ExistingWorkflowNodeSummary,
  'conditionFieldLabel' | 'conditionOperator' | 'conditionValue'
> {
  const c = cfg(node);
  const enhanced = c.enhancedCondition?.conditions?.[0]?.fieldLevelCondition;
  return {
    conditionFieldLabel: enhanced?.fieldLabel || c.fieldLabel || c.fieldId,
    conditionOperator: enhanced?.operator || c.operator,
    conditionValue: enhanced?.value !== undefined && enhanced?.value !== null
      ? String(enhanced.value)
      : (c.value !== undefined && c.value !== null ? String(c.value) : undefined),
  };
}

/** True when the canvas has more than an empty/default Start. */
export function graphHasMeaningfulNodes(
  nodes: LooseNode[] = [],
  connections: LooseConnection[] = [],
): boolean {
  if (!nodes.length) return false;
  if (nodes.length === 1 && String(nodes[0].type).toLowerCase() === 'start') {
    return false;
  }
  if (nodes.some((n) => String(n.type).toLowerCase() !== 'start')) return true;
  return connections.length > 0;
}

export function analyzeExistingWorkflowGraph(
  nodes: LooseNode[] = [],
  connections: LooseConnection[] = [],
): ExistingWorkflowGraphSummary {
  const outgoing = new Map<string, number>();
  for (const c of connections) {
    outgoing.set(c.source, (outgoing.get(c.source) || 0) + 1);
  }

  const summaries: ExistingWorkflowNodeSummary[] = nodes.map((n) => {
    const c = cfg(n);
    const type = String(n.type || '').toLowerCase();
    const base: ExistingWorkflowNodeSummary = {
      id: n.id,
      type,
      label: n.label || type,
    };
    if (type === 'start') {
      return {
        ...base,
        triggerFormId: c.triggerFormId || c.formId || c.sourceFormId,
        triggerFormName: c.triggerFormName || c.formName || c.sourceFormName,
      };
    }
    if (type === 'action' || type === 'notification' || type === 'approval') {
      return {
        ...base,
        actionType: c.actionType || type,
      };
    }
    if (type === 'condition') {
      return { ...base, ...conditionSummary(n) };
    }
    return base;
  });

  const start = summaries.find((n) => n.type === 'start');
  const endNodeIds = summaries.filter((n) => n.type === 'end').map((n) => n.id);
  const actionTypes = summaries
    .map((n) => n.actionType)
    .filter((t): t is string => Boolean(t));
  const hasCondition = summaries.some((n) => n.type === 'condition');
  const hasApprovalPattern = summaries.some((n) =>
    /approv|set.?access|wait.?for.?approv/i.test(`${n.label} ${n.actionType || ''}`),
  ) || actionTypes.some((t) => /approv/i.test(t));

  const tailNodeIds = summaries
    .filter((n) => n.type !== 'start' && !(outgoing.get(n.id) > 0))
    .map((n) => n.id);

  const lines: string[] = [];
  if (start) {
    lines.push(
      `Start: **${start.label}**`
      + (start.triggerFormName || start.triggerFormId
        ? ` (form: ${start.triggerFormName || start.triggerFormId})`
        : ''),
    );
  }
  for (const n of summaries) {
    if (n.type === 'start') continue;
    if (n.type === 'condition') {
      lines.push(
        `Condition **${n.label}**: `
        + `${n.conditionFieldLabel || '(field)'} ${n.conditionOperator || '=='} ${n.conditionValue ?? '(value)'}`,
      );
    } else if (n.actionType) {
      lines.push(`Action **${n.label}**: ${n.actionType}`);
    } else {
      lines.push(`${n.type}: **${n.label}**`);
    }
  }
  if (!lines.length) {
    lines.push('(empty workflow)');
  }

  const editableNodes = summaries.filter((n) => n.type !== 'end');

  return {
    nodeCount: nodes.length,
    connectionCount: connections.length,
    hasMeaningfulNodes: graphHasMeaningfulNodes(nodes, connections),
    startNodeId: start?.id,
    triggerFormId: start?.triggerFormId,
    triggerFormName: start?.triggerFormName,
    triggerType: start ? cfg(nodes.find((n) => n.id === start.id)!).triggerType : undefined,
    endNodeIds,
    tailNodeIds,
    actionTypes: [...new Set(actionTypes)],
    hasCondition,
    hasApprovalPattern,
    nodes: summaries,
    editableNodes,
    lines,
  };
}

export function formatExistingGraphForIntro(summary: ExistingWorkflowGraphSummary): string {
  if (!summary.hasMeaningfulNodes) return '';
  return [
    `This open workflow already has **${summary.nodeCount} node${summary.nodeCount === 1 ? '' : 's'}**:`,
    ...summary.lines.map((l) => `- ${l}`),
  ].join('\n');
}
