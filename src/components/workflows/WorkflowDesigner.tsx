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
  BackgroundVariant,
} from '@xyflow/react';
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

const nodeTypes: NodeTypes = {
  'start': StartNode,
  'action': ActionNode,
  'approval': ApprovalNode,
  'condition': ConditionNode,
  'wait': WaitNode,
  'end': EndNode,
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
  initialNodes: WorkflowNode[];
  initialConnections: WorkflowConnection[];
  onSave: (nodes: WorkflowNode[], connections: WorkflowConnection[]) => void;
}

export function WorkflowDesigner({ workflowId, initialNodes, initialConnections, onSave }: WorkflowDesignerProps) {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowConnections, setWorkflowConnections] = useState<WorkflowConnection[]>([]);
  
  const isInitialized = useRef(false);

  // Get trigger form ID from start node
  const triggerFormId = useMemo(() => {
    const startNode = workflowNodes.find(n => n.type === 'start');
    return startNode?.data?.config?.triggerFormId;
  }, [workflowNodes]);

  // Load form fields for the trigger form
  const { fields: formFields } = useFormFields(triggerFormId);

  // Initialize only once from props
  useEffect(() => {
    if (!isInitialized.current && (initialNodes.length > 0 || initialConnections.length > 0)) {
      console.log('Initializing WorkflowDesigner with data:', { nodes: initialNodes.length, connections: initialConnections.length });
      setWorkflowNodes([...initialNodes]);
      setWorkflowConnections([...initialConnections]);
      syncToReactFlow(initialNodes, initialConnections);
      isInitialized.current = true;
    } else if (!isInitialized.current) {
      // Initialize with empty state
      console.log('Initializing WorkflowDesigner with empty state');
      setWorkflowNodes([]);
      setWorkflowConnections([]);
      setReactFlowNodes([]);
      setReactFlowEdges([]);
      isInitialized.current = true;
    }
  }, [initialNodes, initialConnections]);

  // Convert workflow data to React Flow format
  const syncToReactFlow = useCallback((nodes: WorkflowNode[], connections: WorkflowConnection[]) => {
    const flowNodes = nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: node.label,
        config: node.data?.config || {},
        onSelect: () => {
          const currentNode = nodes.find(n => n.id === node.id);
          if (currentNode) {
            setSelectedNode(currentNode);
          }
        },
      },
    }));

    const flowEdges = connections.map(conn => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle,
      targetHandle: conn.targetHandle,
    }));

    console.log('Syncing to React Flow:', { nodes: flowNodes.length, edges: flowEdges.length });
    setReactFlowNodes(flowNodes);
    setReactFlowEdges(flowEdges);
  }, [setReactFlowNodes, setReactFlowEdges]);

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
    
    const updatedNodes = [...workflowNodes, newNode];
    setWorkflowNodes(updatedNodes);
    syncToReactFlow(updatedNodes, workflowConnections);
  }, [workflowNodes, workflowConnections, syncToReactFlow]);

  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const newConnection: WorkflowConnection = {
        id: generateUUID(),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || undefined,
        targetHandle: params.targetHandle || undefined,
      };

      console.log('Adding connection:', newConnection);
      const updatedConnections = [...workflowConnections, newConnection];
      setWorkflowConnections(updatedConnections);
      
      // Update React Flow edges immediately
      setReactFlowEdges((eds) => addEdge(params, eds));
    },
    [workflowConnections, setReactFlowEdges]
  );

  // Handle node position changes (drag)
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      console.log('Node drag stopped:', node.id, node.position);
      const updatedNodes = workflowNodes.map(n => 
        n.id === node.id 
          ? { ...n, position: node.position }
          : n
      );
      setWorkflowNodes(updatedNodes);
    },
    [workflowNodes]
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

  // Update node configuration
  const updateNodeConfig = useCallback((nodeId: string, config: any) => {
    console.log('🔧 WorkflowDesigner: Updating node config:', nodeId, config);
    const updatedNodes = workflowNodes.map(node =>
      node.id === nodeId
        ? { 
            ...node, 
            data: { ...node.data, config },
            label: config.label || node.label
          }
        : node
    );
    
    console.log('🔧 WorkflowDesigner: Updated nodes array:', updatedNodes);
    setWorkflowNodes(updatedNodes);
    
    // Update selected node to reflect changes in the panel
    setSelectedNode(prev => prev?.id === nodeId ? { 
      ...prev, 
      data: { ...prev.data, config },
      label: config.label || prev.label
    } : prev);
    
    // Update React Flow immediately for visual feedback
    syncToReactFlow(updatedNodes, workflowConnections);
  }, [workflowNodes, workflowConnections, syncToReactFlow]);

  // Delete node
  const deleteNode = useCallback((nodeId: string) => {
    console.log('Deleting node:', nodeId);
    const updatedNodes = workflowNodes.filter(node => node.id !== nodeId);
    const updatedConnections = workflowConnections.filter(
      conn => conn.source !== nodeId && conn.target !== nodeId
    );
    
    setWorkflowNodes(updatedNodes);
    setWorkflowConnections(updatedConnections);
    setSelectedNode(null);
    syncToReactFlow(updatedNodes, updatedConnections);
  }, [workflowNodes, workflowConnections, syncToReactFlow]);

  // Handle edge deletion
  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    console.log('Deleting edges:', edgesToDelete.map(e => e.id));
    const updatedConnections = workflowConnections.filter(
      conn => !edgesToDelete.some(edge => edge.id === conn.id)
    );
    setWorkflowConnections(updatedConnections);
  }, [workflowConnections]);

  // Save current state
  const handleSave = useCallback(() => {
    console.log('Saving workflow state:', { nodes: workflowNodes.length, connections: workflowConnections.length });
    onSave(workflowNodes, workflowConnections);
  }, [workflowNodes, workflowConnections, onSave]);

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
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
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
          node={selectedNode}
          workflowId={workflowId}
          triggerFormId={triggerFormId}
          formFields={formFields}
          onConfigChange={(config) => updateNodeConfig(selectedNode.id, config)}
          onDelete={() => deleteNode(selectedNode.id)}
          onClose={() => setSelectedNode(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
