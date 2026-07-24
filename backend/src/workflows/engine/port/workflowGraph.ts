// @ts-nocheck
import { workflowDb } from './workflow-db';

export interface WorkflowConnection {
  target_node_id: string;
  condition_type?: string | null;
  source_handle?: string | null;
  source_node_id: string;
}

export interface WorkflowNodeRow {
  id: string;
  workflow_id: string;
  node_type: string;
  label?: string;
  config?: unknown;
  execution_order?: number;
  [key: string]: unknown;
}

/**
 * In-memory workflow graph — preload once per execution to avoid per-node DB queries.
 */
export class WorkflowGraph {
  private readonly nodeMap = new Map<string, WorkflowNodeRow>();
  private readonly adjacency = new Map<string, WorkflowConnection[]>();

  private constructor(
    readonly workflowId: string,
    nodes: WorkflowNodeRow[],
    connections: WorkflowConnection[],
  ) {
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
    }
    for (const conn of connections) {
      const list = this.adjacency.get(conn.source_node_id) || [];
      list.push(conn);
      this.adjacency.set(conn.source_node_id, list);
    }
  }

  static async load(workflowId: string): Promise<WorkflowGraph> {
    const [nodesResult, connectionsResult] = await Promise.all([
      engineDb().from('workflow_nodes').select('*').eq('workflow_id', workflowId),
      supabase
        .from('workflow_connections')
        .select('source_node_id, target_node_id, condition_type, source_handle')
        .eq('workflow_id', workflowId),
    ]);

    return new WorkflowGraph(
      workflowId,
      (nodesResult.data || []) as WorkflowNodeRow[],
      (connectionsResult.data || []) as WorkflowConnection[],
    );
  }

  getNode(nodeId: string): WorkflowNodeRow | undefined {
    return this.nodeMap.get(nodeId);
  }

  getConnections(sourceNodeId: string): WorkflowConnection[] {
    return this.adjacency.get(sourceNodeId) || [];
  }

  getNextNodes(currentNodeId: string, condition?: string): string[] {
    const connections = this.getConnections(currentNodeId);
    if (!condition) {
      return connections.map((c) => c.target_node_id);
    }

    return connections
      .filter((conn) => {
        if (conn.source_handle === condition) return true;
        if (conn.condition_type === condition) return true;
        if (condition === 'default' && (!conn.condition_type || conn.condition_type === 'default')) {
          return true;
        }
        return false;
      })
      .map((c) => c.target_node_id);
  }

  getNodesInBranch(startNodeId: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(startNodeId)) return [];
    visited.add(startNodeId);

    const branchNodes = [startNodeId];
    for (const conn of this.getConnections(startNodeId)) {
      branchNodes.push(...this.getNodesInBranch(conn.target_node_id, visited));
    }
    return branchNodes;
  }

  getConditionalBranches(conditionalNodeId: string): {
    trueBranchNodes: string[];
    falseBranchNodes: string[];
  } {
    const connections = this.getConnections(conditionalNodeId);
    const trueBranchNodes: string[] = [];
    const falseBranchNodes: string[] = [];

    for (const connection of connections) {
      const isTrue =
        connection.source_handle === 'true' || connection.condition_type === 'true';
      const isFalse =
        connection.source_handle === 'false' || connection.condition_type === 'false';

      if (isTrue) {
        trueBranchNodes.push(...this.getNodesInBranch(connection.target_node_id));
      } else if (isFalse) {
        falseBranchNodes.push(...this.getNodesInBranch(connection.target_node_id));
      } else {
        trueBranchNodes.push(...this.getNodesInBranch(connection.target_node_id));
      }
    }

    return { trueBranchNodes, falseBranchNodes };
  }
}
