import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes,
  BackgroundVariant,
  OnSelectionChangeParams,
} from '@xyflow/react';
import { LabeledEdge } from './edges/LabeledEdge';
import { EdgeConfigModal } from './EdgeConfigModal';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';
import { WorkflowNode, WorkflowConnection } from '@/types/workflow';
import { StartNode } from './nodes/StartNode';
import { ConditionNode } from './nodes/ConditionNode';
import { WaitNode } from './nodes/WaitNode';
import { EndNode } from './nodes/EndNode';
import { ActionNode } from './nodes/ActionNode';
import { ApprovalNode } from './nodes/ApprovalNode';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { useFormFields } from '@/hooks/useConditionFormData';
import { supabase } from '@/integrations/supabase/client';

const nodeTypes: NodeTypes = {
  'start': StartNode,
  'action': ActionNode,
  'approval': ApprovalNode,
  'condition': ConditionNode,
  'wait': WaitNode,
  'end': EndNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

// Helper function to generate valid UUIDs
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface WorkflowDesignerProps {
  workflowId?: string;
  projectId?: string;
  initialNodes: WorkflowNode[];
  initialConnections: WorkflowConnection[];
  onSave: (nodes: WorkflowNode[], connections: WorkflowConnection[]) => void;
}

export function WorkflowDesigner({ workflowId, projectId, initialNodes, initialConnections, onSave }: WorkflowDesignerProps) {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowConnections, setWorkflowConnections] = useState<WorkflowConnection[]>([]);
  
  // Edge config modal state
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  
  const isInitialized = useRef(false);
  
  // Store refs for stable callbacks
  const workflowNodesRef = useRef<WorkflowNode[]>([]);
  const workflowConnectionsRef = useRef<WorkflowConnection[]>([]);
  
  // Keep refs in sync
  useEffect(() => {
    workflowNodesRef.current = workflowNodes;
    workflowConnectionsRef.current = workflowConnections;
  }, [workflowNodes, workflowConnections]);
  
  // Stable node select handler using ref
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);
  
  // Create a stable ref for the handler that nodes can use
  const nodeSelectRef = useRef(handleNodeSelect);
  nodeSelectRef.current = handleNodeSelect;

  // Get selected node from workflowNodes
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return workflowNodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, workflowNodes]);

  // Get trigger form ID from start node - check multiple possible locations
  const startNodeTriggerFormId = useMemo(() => {
    const startNode = workflowNodes.find(n => n.type === 'start');
    return startNode?.data?.config?.triggerFormId || 
           startNode?.data?.config?.formId ||
           startNode?.data?.config?.sourceFormId;
  }, [workflowNodes]);

  // Fallback: fetch trigger form ID from workflow_triggers table if not in start node
  const [triggerFormIdFromDB, setTriggerFormIdFromDB] = useState<string | undefined>();
  
  useEffect(() => {
    const fetchTriggerFormId = async () => {
      if (startNodeTriggerFormId || !workflowId) {
        setTriggerFormIdFromDB(undefined);
        return;
      }
      
      try {
        // Use .maybeSingle() or fetch array since there may be multiple triggers
        const { data, error } = await supabase
          .from('workflow_triggers')
          .select('source_form_id')
          .eq('target_workflow_id', workflowId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!error && data && data.length > 0 && data[0].source_form_id) {
          console.log('📋 Fetched trigger form ID from DB:', data[0].source_form_id);
          setTriggerFormIdFromDB(data[0].source_form_id);
        }
      } catch (err) {
        console.error('Error fetching trigger form ID:', err);
      }
    };
    
    fetchTriggerFormId();
  }, [workflowId, startNodeTriggerFormId]);

  // Use start node config first, fallback to DB
  const triggerFormId = startNodeTriggerFormId || triggerFormIdFromDB;

  // Load form fields for the trigger form
  const { fields: formFields } = useFormFields(triggerFormId);

  // Convert workflow data to React Flow format
  const syncToReactFlow = useCallback((nodes: WorkflowNode[], connections: WorkflowConnection[]) => {
    setReactFlowNodes(currentNodes => {
      return nodes.map(node => {
        const existingNode = currentNodes.find(n => n.id === node.id);
        
        // Check if anything actually changed
        const positionChanged = !existingNode || 
          existingNode.position.x !== node.position.x ||
          existingNode.position.y !== node.position.y;
        const labelChanged = existingNode?.data?.label !== node.label;
        const configChanged = JSON.stringify(existingNode?.data?.config) !== JSON.stringify(node.data?.config);
        
        if (!positionChanged && !labelChanged && !configChanged && existingNode) {
          return existingNode;
        }
        
        return {
          id: node.id,
          type: node.type,
          position: { x: node.position.x, y: node.position.y },
          data: {
            label: node.label,
            config: node.data?.config || {},
            nodeId: node.id,
            onSelect: nodeSelectRef,
          },
        };
      });
    });

    setReactFlowEdges(currentEdges => {
      const newEdgeData = connections.map(c => `${c.id}:${c.label || ''}`).sort().join(',');
      const currentEdgeData = currentEdges.map(e => `${e.id}:${e.data?.label || ''}`).sort().join(',');
      
      if (newEdgeData === currentEdgeData) {
        return currentEdges;
      }
      
      return connections.map(conn => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
        type: 'labeled',
        data: { label: conn.label || '' },
      }));
    });
  }, [setReactFlowNodes, setReactFlowEdges]);

  // Initialize only once from props
  useEffect(() => {
    if (!isInitialized.current && (initialNodes.length > 0 || initialConnections.length > 0)) {
      console.log('Initializing WorkflowDesigner with data:', { nodes: initialNodes.length, connections: initialConnections.length });
      setWorkflowNodes([...initialNodes]);
      setWorkflowConnections([...initialConnections]);
      syncToReactFlow(initialNodes, initialConnections);
      isInitialized.current = true;
    } else if (!isInitialized.current) {
      console.log('Initializing WorkflowDesigner with empty state');
      setWorkflowNodes([]);
      setWorkflowConnections([]);
      setReactFlowNodes([]);
      setReactFlowEdges([]);
      isInitialized.current = true;
    }
  }, [initialNodes, initialConnections, syncToReactFlow, setReactFlowNodes, setReactFlowEdges]);

  // Add node
  const addNodeToWorkflow = useCallback((nodeType: string, position: { x: number; y: number }) => {
    const newNode: WorkflowNode = {
      id: generateUUID(),
      type: nodeType as any,
      label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace('-', ' ')} Node`,
      position,
      data: { config: {} },
    };

    console.log('Adding node:', newNode);
    
    setWorkflowNodes(prev => {
      const updatedNodes = [...prev, newNode];
      syncToReactFlow(updatedNodes, workflowConnectionsRef.current);
      return updatedNodes;
    });
  }, [syncToReactFlow]);

  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      // Prevent self-connections
      if (params.source === params.target) {
        console.warn('Cannot connect a node to itself');
        return;
      }

      // Prevent duplicate connections
      const isDuplicate = workflowConnectionsRef.current.some(
        conn => conn.source === params.source && 
                conn.target === params.target &&
                conn.sourceHandle === (params.sourceHandle || undefined)
      );
      
      if (isDuplicate) {
        console.warn('Connection already exists');
        return;
      }

      const newConnection: WorkflowConnection = {
        id: generateUUID(),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || undefined,
        targetHandle: params.targetHandle || undefined,
      };

      console.log('Adding connection:', newConnection);
      setWorkflowConnections(prev => [...prev, newConnection]);
      setReactFlowEdges((eds) => addEdge(params, eds));
    },
    [setReactFlowEdges]
  );

  // Handle node position changes (drag)
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setWorkflowNodes(prev => prev.map(n => 
        n.id === node.id 
          ? { ...n, position: node.position }
          : n
      ));
    },
    []
  );

  // Handle drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const reactFlowBounds = (event.target as Element).closest('.react-flow')?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      addNodeToWorkflow(type, position);
    },
    [addNodeToWorkflow]
  );

  // Update node configuration - stable callback that uses refs
  const updateNodeConfig = useCallback((nodeId: string, config: any) => {
    console.log('🔧 WorkflowDesigner: Updating node config:', nodeId, config);
    
    setWorkflowNodes(prev => {
      const updatedNodes = prev.map(node =>
        node.id === nodeId
          ? { 
              ...node, 
              data: { ...node.data, config },
              label: config.label || node.label
            }
          : node
      );
      
      // Use requestAnimationFrame to batch the sync
      requestAnimationFrame(() => {
        syncToReactFlow(updatedNodes, workflowConnectionsRef.current);
      });
      
      return updatedNodes;
    });
  }, [syncToReactFlow]);

  // Delete node - stable callback
  const deleteNode = useCallback((nodeId: string) => {
    console.log('Deleting node:', nodeId);
    
    setWorkflowNodes(prev => {
      const updatedNodes = prev.filter(node => node.id !== nodeId);
      setWorkflowConnections(prevConns => {
        const updatedConnections = prevConns.filter(
          conn => conn.source !== nodeId && conn.target !== nodeId
        );
        syncToReactFlow(updatedNodes, updatedConnections);
        return updatedConnections;
      });
      return updatedNodes;
    });
    
    setSelectedNodeId(null);
  }, [syncToReactFlow]);

  // Handle edge deletion
  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    console.log('Deleting edges:', edgesToDelete.map(e => e.id));
    setWorkflowConnections(prev => 
      prev.filter(conn => !edgesToDelete.some(edge => edge.id === conn.id))
    );
  }, []);

  // Show hint when edge is selected
  const onSelectionChange = useCallback(({ edges }: OnSelectionChangeParams) => {
    if (edges.length > 0) {
      toast.info('Click on connection to rename or delete it', { duration: 2000 });
    }
  }, []);

  // Handle edge click - open modal
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setIsEdgeModalOpen(true);
  }, []);

  // Get selected edge name
  const selectedEdgeName = useMemo(() => {
    if (!selectedEdgeId) return '';
    const conn = workflowConnections.find(c => c.id === selectedEdgeId);
    return conn?.label || '';
  }, [selectedEdgeId, workflowConnections]);

  // Save edge name
  const handleSaveEdgeName = useCallback((edgeId: string, name: string) => {
    setWorkflowConnections(prev => {
      const updated = prev.map(conn =>
        conn.id === edgeId ? { ...conn, label: name } : conn
      );
      syncToReactFlow(workflowNodesRef.current, updated);
      return updated;
    });
  }, [syncToReactFlow]);

  // Delete edge from modal
  const handleDeleteEdge = useCallback((edgeId: string) => {
    setWorkflowConnections(prev => {
      const updated = prev.filter(conn => conn.id !== edgeId);
      syncToReactFlow(workflowNodesRef.current, updated);
      return updated;
    });
    setReactFlowEdges(prev => prev.filter(edge => edge.id !== edgeId));
  }, [syncToReactFlow, setReactFlowEdges]);

  // Close edge modal
  const handleCloseEdgeModal = useCallback(() => {
    setIsEdgeModalOpen(false);
    setSelectedEdgeId(null);
  }, []);

  // Save current state - use refs for latest values
  const handleSave = useCallback(() => {
    console.log('Saving workflow state:', { nodes: workflowNodesRef.current.length, connections: workflowConnectionsRef.current.length });
    onSave(workflowNodesRef.current, workflowConnectionsRef.current);
  }, [onSave]);

  // Close panel handler - stable
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Memoize the config change handler for the selected node
  const handleConfigChange = useMemo(() => {
    if (!selectedNodeId) return () => {};
    return (config: any) => updateNodeConfig(selectedNodeId, config);
  }, [selectedNodeId, updateNodeConfig]);

  // Memoize the delete handler for the selected node
  const handleDeleteNode = useMemo(() => {
    if (!selectedNodeId) return () => {};
    return () => deleteNode(selectedNodeId);
  }, [selectedNodeId, deleteNode]);

  return (
    <div className="h-full flex">
      <NodePalette onAddNode={addNodeToWorkflow} />
      
      <div className="flex-1 relative">
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDelete}
          onSelectionChange={onSelectionChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-slate-50"
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>

      {selectedNode && (
        <NodeConfigPanel
          key={selectedNode.id}
          node={selectedNode}
          workflowId={workflowId}
          projectId={projectId}
          triggerFormId={triggerFormId}
          formFields={formFields}
          onConfigChange={handleConfigChange}
          onDelete={handleDeleteNode}
          onClose={handleClosePanel}
          onSave={handleSave}
        />
      )}

      <EdgeConfigModal
        isOpen={isEdgeModalOpen}
        edgeId={selectedEdgeId}
        edgeName={selectedEdgeName}
        onClose={handleCloseEdgeModal}
        onSave={handleSaveEdgeName}
        onDelete={handleDeleteEdge}
      />
    </div>
  );
}
