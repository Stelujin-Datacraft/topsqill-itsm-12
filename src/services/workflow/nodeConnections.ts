
import { supabase } from '@/integrations/supabase/client';

export class NodeConnections {
  static async getNextNodes(workflowId: string, currentNodeId: string, condition?: string): Promise<string[]> {
    try {
      console.log(`🔍 Finding next nodes from ${currentNodeId} in workflow ${workflowId}`, { condition });
      
      const { data: connections, error } = await supabase
        .from('workflow_connections')
        .select('target_node_id, condition_type, source_handle')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', currentNodeId);

      if (error) {
        console.error('❌ Error getting next nodes:', error);
        return [];
      }

      console.log('🔗 Found connections:', connections);

      // If no condition specified, return ALL connections for normal flow
      if (!condition) {
        const nextNodeIds = connections?.map(conn => conn.target_node_id) || [];
        console.log(`➡️ Normal flow - returning all next nodes:`, nextNodeIds);
        return nextNodeIds;
      }

      // Enhanced filtering for conditional connections only when condition is specified
      const filteredConnections = connections?.filter(conn => {
        // Match by source handle (React Flow handle system)
        if (conn.source_handle === condition) {
          return true;
        }
        
        // Match by condition type (legacy system)
        if (conn.condition_type === condition) {
          return true;
        }
        
        // Default path handling
        if (condition === 'default' && (!conn.condition_type || conn.condition_type === 'default')) {
          return true;
        }
        
        return false;
      }) || [];

      const nextNodeIds = filteredConnections.map(conn => conn.target_node_id);
      console.log(`➡️ Conditional flow - next node IDs for condition "${condition}":`, nextNodeIds);
      
      return nextNodeIds;
    } catch (error) {
      console.error('❌ Error getting next nodes:', error);
      return [];
    }
  }

  /**
   * Get all connections from a node with their conditions
   */
  static async getNodeConnections(workflowId: string, nodeId: string) {
    try {
      const { data: connections, error } = await supabase
        .from('workflow_connections')
        .select('target_node_id, condition_type, source_handle')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', nodeId);

      if (error) {
        console.error('❌ Error getting node connections:', error);
        return [];
      }

      return connections || [];
    } catch (error) {
      console.error('❌ Error getting node connections:', error);
      return [];
    }
  }
}
