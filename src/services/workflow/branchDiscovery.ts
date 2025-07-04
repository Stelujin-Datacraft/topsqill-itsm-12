
import { supabase } from '@/integrations/supabase/client';

export class BranchDiscovery {
  /**
   * Discovers all nodes in a specific branch starting from a given node
   */
  static async getNodesInBranch(
    workflowId: string, 
    startNodeId: string, 
    visitedNodes: Set<string> = new Set()
  ): Promise<string[]> {
    if (visitedNodes.has(startNodeId)) {
      return [];
    }
    
    visitedNodes.add(startNodeId);
    const branchNodes = [startNodeId];
    
    try {
      // Get all connections from this node
      const { data: connections, error } = await supabase
        .from('workflow_connections')
        .select('target_node_id')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', startNodeId);

      if (error) {
        console.error('❌ Error getting branch connections:', error);
        return branchNodes;
      }

      // Recursively get all downstream nodes
      for (const connection of connections || []) {
        const downstreamNodes = await this.getNodesInBranch(
          workflowId, 
          connection.target_node_id, 
          visitedNodes
        );
        branchNodes.push(...downstreamNodes);
      }

      return branchNodes;
    } catch (error) {
      console.error('❌ Error discovering branch nodes:', error);
      return branchNodes;
    }
  }

  /**
   * Gets nodes in both true and false branches from a conditional node
   */
  static async getConditionalBranches(
    workflowId: string, 
    conditionalNodeId: string
  ): Promise<{ trueBranchNodes: string[], falseBranchNodes: string[] }> {
    try {
      console.log(`🔍 Getting conditional branches for node ${conditionalNodeId}`);
      
      // Get connections from the conditional node
      const { data: connections, error } = await supabase
        .from('workflow_connections')
        .select('target_node_id, source_handle, condition_type')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', conditionalNodeId);

      if (error) {
        console.error('❌ Error getting conditional connections:', error);
        return { trueBranchNodes: [], falseBranchNodes: [] };
      }

      console.log('🔗 Conditional connections found:', connections);

      let trueBranchNodes: string[] = [];
      let falseBranchNodes: string[] = [];

      for (const connection of connections || []) {
        const isTrue = connection.source_handle === 'true' || 
                      connection.condition_type === 'true';
        
        const isFalse = connection.source_handle === 'false' || 
                       connection.condition_type === 'false';

        console.log(`🔗 Connection analysis:`, {
          targetNodeId: connection.target_node_id,
          sourceHandle: connection.source_handle,
          conditionType: connection.condition_type,
          isTrue,
          isFalse
        });

        if (isTrue) {
          const branchNodes = await this.getNodesInBranch(workflowId, connection.target_node_id);
          trueBranchNodes.push(...branchNodes);
          console.log(`✅ Added to true branch:`, branchNodes);
        } else if (isFalse) {
          const branchNodes = await this.getNodesInBranch(workflowId, connection.target_node_id);
          falseBranchNodes.push(...branchNodes);
          console.log(`❌ Added to false branch:`, branchNodes);
        } else {
          // If no specific condition is set, treat as true branch (default path)
          const branchNodes = await this.getNodesInBranch(workflowId, connection.target_node_id);
          trueBranchNodes.push(...branchNodes);
          console.log(`🔄 Added to true branch (default):`, branchNodes);
        }
      }

      console.log(`🎯 Conditional branches for node ${conditionalNodeId}:`, {
        trueBranchNodes: trueBranchNodes.length,
        falseBranchNodes: falseBranchNodes.length,
        trueNodes: trueBranchNodes,
        falseNodes: falseBranchNodes
      });

      return { trueBranchNodes, falseBranchNodes };
    } catch (error) {
      console.error('❌ Error getting conditional branches:', error);
      return { trueBranchNodes: [], falseBranchNodes: [] };
    }
  }
}
