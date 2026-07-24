// @ts-nocheck

import { workflowDb } from './workflow-db';
import type { WorkflowGraph } from './workflowGraph';

export class BranchDiscovery {
  static async getNodesInBranch(
    workflowId: string,
    startNodeId: string,
    visitedNodes: Set<string> = new Set(),
    graph?: WorkflowGraph,
  ): Promise<string[]> {
    if (graph) {
      return graph.getNodesInBranch(startNodeId, visitedNodes);
    }

    if (visitedNodes.has(startNodeId)) {
      return [];
    }

    visitedNodes.add(startNodeId);
    const branchNodes = [startNodeId];

    try {
      const { data: connections, error } = await engineDb()
        .from('workflow_connections')
        .select('target_node_id')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', startNodeId);

      if (error) {
        return branchNodes;
      }

      for (const connection of connections || []) {
        const downstreamNodes = await this.getNodesInBranch(
          workflowId,
          connection.target_node_id,
          visitedNodes,
        );
        branchNodes.push(...downstreamNodes);
      }

      return branchNodes;
    } catch {
      return branchNodes;
    }
  }

  static async getConditionalBranches(
    workflowId: string,
    conditionalNodeId: string,
    graph?: WorkflowGraph,
  ): Promise<{ trueBranchNodes: string[]; falseBranchNodes: string[] }> {
    if (graph) {
      return graph.getConditionalBranches(conditionalNodeId);
    }

    try {
      const { data: connections, error } = await engineDb()
        .from('workflow_connections')
        .select('target_node_id, source_handle, condition_type')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', conditionalNodeId);

      if (error) {
        return { trueBranchNodes: [], falseBranchNodes: [] };
      }

      let trueBranchNodes: string[] = [];
      let falseBranchNodes: string[] = [];

      for (const connection of connections || []) {
        const isTrue =
          connection.source_handle === 'true' || connection.condition_type === 'true';
        const isFalse =
          connection.source_handle === 'false' || connection.condition_type === 'false';

        if (isTrue) {
          const branchNodes = await this.getNodesInBranch(workflowId, connection.target_node_id);
          trueBranchNodes.push(...branchNodes);
        } else if (isFalse) {
          const branchNodes = await this.getNodesInBranch(workflowId, connection.target_node_id);
          falseBranchNodes.push(...branchNodes);
        } else {
          const branchNodes = await this.getNodesInBranch(workflowId, connection.target_node_id);
          trueBranchNodes.push(...branchNodes);
        }
      }

      return { trueBranchNodes, falseBranchNodes };
    } catch {
      return { trueBranchNodes: [], falseBranchNodes: [] };
    }
  }
}
