
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Workflow, WorkflowNode, WorkflowConnection } from '@/types/workflow';

export function useWorkflowData() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const queryClient = useQueryClient();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const { data: workflowData, isLoading, isError, error } = useQuery({
    queryKey: ['workflows', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return [];

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching workflows:", error);
        throw error;
      }
      
      // Map database response to Workflow type
      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        organizationId: item.organization_id,
        projectId: item.project_id,
        status: item.status as 'active' | 'draft' | 'inactive',
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        createdBy: item.created_by,
        nodes: [],
        connections: []
      })) as Workflow[];
    },
    enabled: !!currentProject?.id,
  });

  useEffect(() => {
    if (workflowData) {
      setWorkflows(workflowData);
    }
  }, [workflowData]);

  const createWorkflowMutation = useMutation({
    mutationFn: async (workflowData: { 
      name: string; 
      description?: string; 
      status?: 'active' | 'draft' | 'inactive';
    }) => {
      if (!userProfile?.organization_id || !currentProject?.id) {
        throw new Error('Organization and project required');
      }

      const { data, error } = await supabase
        .from('workflows')
        .insert({
          name: workflowData.name,
          description: workflowData.description,
          organization_id: userProfile.organization_id,
          project_id: currentProject.id,
          status: workflowData.status || 'draft',
          created_by: userProfile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      const { data, error } = await supabase
        .from('workflows')
        .update({
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
        })
        .eq('id', workflow.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const { data, error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId)

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const loadWorkflowNodes = async (workflowId: string): Promise<{ nodes: WorkflowNode[], connections: WorkflowConnection[] }> => {
    try {
      // Load nodes
      const { data: nodesData, error: nodesError } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', workflowId);

      if (nodesError) throw nodesError;

      // Load connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('workflow_connections')
        .select('*')
        .eq('workflow_id', workflowId);

      if (connectionsError) throw connectionsError;

      const nodes: WorkflowNode[] = (nodesData || []).map(node => ({
        id: node.id,
        type: node.node_type as WorkflowNode['type'],
        label: node.label,
        position: { x: node.position_x, y: node.position_y },
        data: { config: node.config }
      }));

      const connections: WorkflowConnection[] = (connectionsData || []).map(conn => ({
        id: conn.id,
        source: conn.source_node_id,
        target: conn.target_node_id,
        sourceHandle: conn.source_handle,
        targetHandle: conn.target_handle
      }));

      return { nodes, connections };
    } catch (error) {
      console.error('Error loading workflow nodes:', error);
      return { nodes: [], connections: [] };
    }
  };

  const saveWorkflowNodes = async (
    workflowId: string, 
    nodes: WorkflowNode[], 
    connections: WorkflowConnection[]
  ): Promise<boolean> => {
    try {
      console.log('Starting workflow save operation...');
      console.log('Saving nodes:', nodes.length, 'connections:', connections.length);

      // Step 1: Clear any workflow execution references to nodes we're about to delete
      console.log('Step 1: Clearing workflow execution references...');
      const { error: clearReferencesError } = await supabase
        .from('workflow_executions')
        .update({ current_node_id: null, wait_node_id: null })
        .eq('workflow_id', workflowId);

      if (clearReferencesError) {
        console.error('Error clearing workflow execution references:', clearReferencesError);
        throw new Error(`Failed to clear execution references: ${clearReferencesError.message}`);
      }

      // Step 2: Delete existing connections first (they depend on nodes)
      console.log('Step 2: Deleting existing connections...');
      const { error: connectionsDeleteError } = await supabase
        .from('workflow_connections')
        .delete()
        .eq('workflow_id', workflowId);

      if (connectionsDeleteError) {
        console.error('Error deleting connections:', connectionsDeleteError);
        throw new Error(`Failed to delete connections: ${connectionsDeleteError.message}`);
      }

      // Step 3: Delete existing nodes
      console.log('Step 3: Deleting existing nodes...');
      const { error: nodesDeleteError } = await supabase
        .from('workflow_nodes')
        .delete()
        .eq('workflow_id', workflowId);

      if (nodesDeleteError) {
        console.error('Error deleting nodes:', nodesDeleteError);
        throw new Error(`Failed to delete nodes: ${nodesDeleteError.message}`);
      }

      // Step 4: Insert new nodes first (connections depend on nodes)
      if (nodes.length > 0) {
        console.log('Step 4: Inserting new nodes...');
        
        // Prepare node data with proper validation
        const nodeInserts = nodes.map(node => {
          // Ensure we have valid UUIDs and positions
          if (!node.id || !node.type || !node.label) {
            throw new Error(`Invalid node data: missing required fields for node ${node.id}`);
          }
          
          return {
            id: node.id,
            workflow_id: workflowId,
            node_type: node.type,
            label: node.label,
            position_x: Math.round(Number(node.position.x) || 0),
            position_y: Math.round(Number(node.position.y) || 0),
            config: node.data?.config || {}
          };
        });

        console.log('Inserting nodes with data:', nodeInserts);

        const { error: nodesError } = await supabase
          .from('workflow_nodes')
          .insert(nodeInserts);

        if (nodesError) {
          console.error('Error inserting nodes:', nodesError);
          if (nodesError.code === '23505') {
            throw new Error('Duplicate node ID detected. Please refresh and try again.');
          }
          throw new Error(`Failed to insert nodes: ${nodesError.message}`);
        }
      }

      // Step 5: Insert new connections
      if (connections.length > 0) {
        console.log('Step 5: Inserting new connections...');
        
        // Prepare connection data with validation
        const connectionInserts = connections.map(conn => {
          if (!conn.id || !conn.source || !conn.target) {
            throw new Error(`Invalid connection data: missing required fields for connection ${conn.id}`);
          }
          
          return {
            id: conn.id,
            workflow_id: workflowId,
            source_node_id: conn.source,
            target_node_id: conn.target,
            source_handle: conn.sourceHandle || null,
            target_handle: conn.targetHandle || null
          };
        });

        console.log('Inserting connections with data:', connectionInserts);

        const { error: connectionsError } = await supabase
          .from('workflow_connections')
          .insert(connectionInserts);

        if (connectionsError) {
          console.error('Error inserting connections:', connectionsError);
          if (connectionsError.code === '23503') {
            throw new Error('Invalid connection: one or more nodes do not exist.');
          }
          throw new Error(`Failed to insert connections: ${connectionsError.message}`);
        }
      }

      console.log('Workflow save operation completed successfully');
      return true;
    } catch (error) {
      console.error('Error saving workflow nodes:', error);
      return false;
    }
  };

  return {
    workflows,
    isLoading,
    isError,
    error,
    createWorkflow: createWorkflowMutation.mutateAsync,
    updateWorkflow: updateWorkflowMutation.mutateAsync,
    deleteWorkflow: deleteWorkflowMutation.mutateAsync,
    loadWorkflowNodes,
    saveWorkflowNodes,
  };
}
