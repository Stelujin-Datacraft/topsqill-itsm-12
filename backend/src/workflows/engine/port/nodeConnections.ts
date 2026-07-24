// @ts-nocheck

import { workflowDb } from './workflow-db';
import type { WorkflowGraph } from './types';

export class NodeConnections {
  static async getNextNodes(
    workflowId: string,
    currentNodeId: string,
    condition?: string,
    graph?: WorkflowGraph,
  ): Promise<string[]> {
    if (graph) {
      return graph.getNextNodes(currentNodeId, condition);
    }

    try {
      const { data: connections, error } = await engineDb()
        .from('workflow_connections')
        .select('target_node_id, condition_type, source_handle')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', currentNodeId);

      if (error) {
        return [];
      }

      if (!condition) {
        return connections?.map((conn) => conn.target_node_id) || [];
      }

      const filteredConnections = connections?.filter((conn) => {
        if (conn.source_handle === condition) return true;
        if (conn.condition_type === condition) return true;
        if (condition === 'default' && (!conn.condition_type || conn.condition_type === 'default')) {
          return true;
        }
        return false;
      }) || [];

      return filteredConnections.map((conn) => conn.target_node_id);
    } catch {
      return [];
    }
  }

  static async getNodeConnections(workflowId: string, nodeId: string, graph?: WorkflowGraph) {
    if (graph) {
      return graph.getConnections(nodeId);
    }

    try {
      const { data: connections, error } = await engineDb()
        .from('workflow_connections')
        .select('target_node_id, condition_type, source_handle')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', nodeId);

      if (error) {
        return [];
      }

      return connections || [];
    } catch {
      return [];
    }
  }
}
