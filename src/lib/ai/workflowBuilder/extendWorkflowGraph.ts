/**
 * Merge a compiled AI Suggest fragment into an existing designer workflow graph.
 * EXTEND: keep existing nodes; strip duplicate Start; graft before End(s).
 * REPLACE: return the new graph only (caller assigns UUIDs as today).
 */
import type { WorkflowConnection, WorkflowNode } from '@/types/workflow';
import {
  analyzeExistingWorkflowGraph,
  type ExistingWorkflowGraphSummary,
  type WorkflowApplyMode,
} from './analyzeExistingWorkflow';

export interface SuggestedWorkflowNode {
  type: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  connections?: Array<{ to: string; condition?: string; conditionType?: string; sourceHandle?: string }>;
  tempId?: string;
}

export interface MappedSuggestionNode extends WorkflowNode {
  /** Original suggestion tempId / index key used for edge remapping */
  _suggestKey?: string;
}

export interface ExtendWorkflowResult {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  applyMode: WorkflowApplyMode;
  addedNodeCount: number;
  summary: ExistingWorkflowGraphSummary;
}

function mapNodeType(type: string): WorkflowNode['type'] {
  const t = String(type || '').toLowerCase();
  if (t === 'start' || t === 'trigger') return 'start';
  if (t === 'end') return 'end';
  if (t === 'condition') return 'condition';
  if (t === 'wait') return 'wait';
  if (t === 'action' || t === 'notification' || t === 'approval' || t === 'form-assignment' || t === 'form-approval') {
    return 'action';
  }
  return 'action';
}

function maxY(nodes: WorkflowNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, n.position?.y || 0), 0);
}

/**
 * Strip leading Start from a compiled fragment when extending an existing graph
 * that already has a Start (avoid duplicate triggers).
 */
export function stripDuplicateStartFromSuggestion(
  suggestionNodes: SuggestedWorkflowNode[],
  summary: ExistingWorkflowGraphSummary,
): SuggestedWorkflowNode[] {
  if (!summary.startNodeId || !suggestionNodes.length) return suggestionNodes;
  const startIdx = suggestionNodes.findIndex((n) => {
    const t = String(n.type || '').toLowerCase();
    return t === 'start' || t === 'trigger';
  });
  if (startIdx < 0) return suggestionNodes;

  const startTemp = suggestionNodes[startIdx].tempId || `node_${startIdx}`;
  const startLabel = String(suggestionNodes[startIdx].label || '').toLowerCase();

  // Nodes that pointed at Start should instead become entry points (no inbound from Start)
  const next = suggestionNodes
    .filter((_, i) => i !== startIdx)
    .map((n, i) => {
      const connections = (n.connections || []).filter((c) => {
        const to = String(c.to || '').toLowerCase();
        return to !== startTemp.toLowerCase()
          && to !== startLabel
          && to !== 'node_start'
          && to !== 'start';
      });
      return {
        ...n,
        tempId: n.tempId || `node_${i}`,
        connections,
      };
    });

  // Remap edges that targeted the first non-start child of Start — already kept on those nodes.
  // Edges FROM Start to first node are dropped (graft will attach existing tails → first new node).
  return next;
}

function resolveSuggestionTargetIndex(
  suggestionNodes: SuggestedWorkflowNode[],
  to: string,
): number {
  const needle = String(to || '').toLowerCase();
  return suggestionNodes.findIndex((n, idx) => {
    return n.label.toLowerCase() === needle
      || `node_${idx}` === needle
      || String(n.tempId || '').toLowerCase() === needle;
  });
}

function buildSuggestionNodesAsWorkflowNodes(
  suggestionNodes: SuggestedWorkflowNode[],
  normalizeConfig: (type: WorkflowNode['type'], config: Record<string, any>) => Record<string, any>,
  yBase: number,
): MappedSuggestionNode[] {
  return suggestionNodes.map((node, index) => {
    const nodeType = mapNodeType(node.type);
    const yOffset = yBase + 120 + index * 150;
    const xOffset = nodeType === 'condition' ? 350 : 250;
    return {
      id: crypto.randomUUID(),
      type: nodeType,
      label: node.label,
      position: { x: xOffset, y: yOffset },
      data: {
        config: normalizeConfig(nodeType, node.config || {}),
        description: node.description || '',
      },
      _suggestKey: node.tempId || `node_${index}`,
    };
  });
}

function buildSuggestionConnections(
  suggestionNodes: SuggestedWorkflowNode[],
  mapped: MappedSuggestionNode[],
): WorkflowConnection[] {
  const connections: WorkflowConnection[] = [];
  suggestionNodes.forEach((node, sourceIndex) => {
    const sourceNode = mapped[sourceIndex];
    if (!sourceNode) return;
    if (node.connections && node.connections.length > 0) {
      let resolvedAny = false;
      node.connections.forEach((conn) => {
        const targetIndex = resolveSuggestionTargetIndex(suggestionNodes, conn.to);
        if (targetIndex === -1) return;
        resolvedAny = true;
        const targetNode = mapped[targetIndex];
        const conditionRaw = String(
          conn.conditionType || conn.condition || conn.sourceHandle || '',
        ).toLowerCase();
        let sourceHandle: string | undefined;
        if (sourceNode.type === 'condition' && (conditionRaw === 'true' || conditionRaw === 'false')) {
          sourceHandle = conditionRaw;
        }
        connections.push({
          id: crypto.randomUUID(),
          source: sourceNode.id,
          target: targetNode.id,
          sourceHandle,
          label: sourceNode.type === 'condition' ? conditionRaw || undefined : undefined,
        });
      });
      if (!resolvedAny && sourceNode.type !== 'end' && sourceIndex < suggestionNodes.length - 1) {
        connections.push({
          id: crypto.randomUUID(),
          source: sourceNode.id,
          target: mapped[sourceIndex + 1].id,
        });
      }
    } else if (sourceNode.type !== 'end' && sourceIndex < suggestionNodes.length - 1) {
      connections.push({
        id: crypto.randomUUID(),
        source: sourceNode.id,
        target: mapped[sourceIndex + 1].id,
      });
    }
  });
  return connections;
}

/**
 * Merge suggestion into existing graph (EDIT / APPEND / REPLACE).
 */
export function mergeAiSuggestionIntoWorkflow(params: {
  applyMode: WorkflowApplyMode;
  existingNodes: WorkflowNode[];
  existingConnections: WorkflowConnection[];
  suggestionNodes: SuggestedWorkflowNode[];
  normalizeConfig: (type: WorkflowNode['type'], config: Record<string, any>) => Record<string, any>;
  editTargetNodeId?: string | null;
}): ExtendWorkflowResult {
  const summary = analyzeExistingWorkflowGraph(params.existingNodes, params.existingConnections);
  const rawMode = params.applyMode === 'extend' ? 'append' : params.applyMode;
  const mode: WorkflowApplyMode = (() => {
    if (!summary.hasMeaningfulNodes) return 'replace';
    if (rawMode === 'edit') return 'edit';
    if (rawMode === 'append' || rawMode === 'extend') return 'append';
    return 'replace';
  })();

  // ── EDIT: patch one existing node in place ─────────────────────────────
  if (mode === 'edit' && params.editTargetNodeId) {
    const target = params.existingNodes.find((n) => n.id === params.editTargetNodeId);
    if (!target) {
      // Fall back to append if target missing
    } else {
      const targetType = String(target.type || '').toLowerCase();
      const match = params.suggestionNodes.find((n) => {
        const t = mapNodeType(n.type);
        if (targetType === 'condition') return t === 'condition';
        if (targetType === 'start') return t === 'start';
        if (targetType === 'wait') return t === 'wait';
        if (targetType === 'end') return t === 'end';
        // action / notification / approval
        return t === 'action';
      }) || params.suggestionNodes.find((n) => mapNodeType(n.type) !== 'start' && mapNodeType(n.type) !== 'end');

      if (match) {
        const normalized = params.normalizeConfig(target.type, match.config || {});
        // For action nodes, replace config (don't shallow-merge) so an old
        // create_record actionType / fields cannot stick around when upgrading
        // to create_linked_record.
        const replaceActionConfig = targetType === 'action'
          || targetType === 'notification'
          || targetType === 'approval';
        const nodes = params.existingNodes.map((n) => {
          if (n.id !== target.id) return n;
          return {
            ...n,
            label: match.label || n.label,
            data: {
              ...n.data,
              config: replaceActionConfig
                ? { ...normalized }
                : {
                  ...(n.data?.config || {}),
                  ...normalized,
                },
              description: match.description || n.data?.description || '',
            },
          };
        });
        return {
          nodes,
          connections: params.existingConnections,
          applyMode: 'edit',
          addedNodeCount: 0,
          summary,
        };
      }
    }
  }

  let fragment = params.suggestionNodes;
  if (mode === 'append') {
    fragment = stripDuplicateStartFromSuggestion(fragment, summary);
  }

  const yBase = mode === 'append' ? maxY(params.existingNodes) : 0;
  const mapped = buildSuggestionNodesAsWorkflowNodes(fragment, params.normalizeConfig, yBase);
  const newConnections = buildSuggestionConnections(fragment, mapped);

  if (mode === 'replace' || !params.existingNodes.length) {
    return {
      nodes: mapped.map(({ _suggestKey, ...n }) => n),
      connections: newConnections,
      applyMode: 'replace',
      addedNodeCount: mapped.length,
      summary,
    };
  }

  // APPEND (legacy extend): redirect edges that pointed at End nodes → first new node
  const firstNew = mapped[0];
  const endIds = new Set(summary.endNodeIds);
  let keptConnections = [...params.existingConnections];

  if (firstNew && endIds.size) {
    keptConnections = keptConnections.map((c) => {
      if (endIds.has(c.target)) {
        return { ...c, target: firstNew.id };
      }
      return c;
    });
  } else if (firstNew && summary.tailNodeIds.length) {
    for (const tailId of summary.tailNodeIds) {
      const already = keptConnections.some((c) => c.source === tailId && c.target === firstNew.id);
      if (already) continue;
      const tail = params.existingNodes.find((n) => n.id === tailId);
      if (!tail || tail.type === 'end') continue;
      keptConnections.push({
        id: crypto.randomUUID(),
        source: tailId,
        target: firstNew.id,
      });
    }
  } else if (firstNew && summary.startNodeId) {
    const startHasOut = keptConnections.some((c) => c.source === summary.startNodeId);
    if (!startHasOut) {
      keptConnections.push({
        id: crypto.randomUUID(),
        source: summary.startNodeId,
        target: firstNew.id,
      });
    }
  }

  const inbound = new Set(keptConnections.map((c) => c.target).concat(newConnections.map((c) => c.target)));
  const keptExistingNodes = params.existingNodes.filter((n) => {
    if (n.type !== 'end') return true;
    return inbound.has(n.id);
  });
  const keptIds = new Set(keptExistingNodes.map((n) => n.id).concat(mapped.map((n) => n.id)));
  const allConnections = [...keptConnections, ...newConnections].filter(
    (c) => keptIds.has(c.source) && keptIds.has(c.target),
  );

  return {
    nodes: [
      ...keptExistingNodes,
      ...mapped.map(({ _suggestKey, ...n }) => n),
    ],
    connections: allConnections,
    applyMode: 'append',
    addedNodeCount: mapped.length,
    summary,
  };
}
