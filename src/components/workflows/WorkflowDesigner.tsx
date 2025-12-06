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
  
  const isInitialized = useRef(false);
  
  // Create a stable ref for the node select handler
  const nodeSelectHandlerRef = useRef<(nodeId: string) => void>(() => {});
  nodeSelectHandlerRef.current = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  // Get selected node from workflowNodes
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return workflowNodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, workflowNodes]);

  // Get trigger form ID from start node
  const triggerFormId = useMemo(() => {
    const startNode = workflowNodes.find(n => n.type === 'start');
    return startNode?.data?.config?.triggerFormId;
  }, [workflowNodes]);

  // Load form fields for the trigger form
  const { fields: formFields } = useFormFields(triggerFormId);

  // Convert workflow data to React Flow format - only called when nodes/connections change structurally
  const syncToReactFlow = useCallback((nodes: WorkflowNode[], connections: WorkflowConnection[]) => {
    setReactFlowNodes(currentNodes => {
      const newNodes = nodes.map(node => {
        // Find existing React Flow node to preserve its reference if possible
        const existingNode = currentNodes.find(n => n.id === node.id);
        
        // Check if we need to update
        const needsUpdate = !existingNode || 
          existingNode.position.x !== node.position.x ||
          existingNode.position.y !== node.position.y ||
          existingNode.data?.label !== node.label ||
          JSON.stringify(existingNode.data?.config) !== JSON.stringify(node.data?.config);
        
        if (!needsUpdate && existingNode) {
          return existingNode;
        }
        
        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            label: node.label,
            config: node.data?.config || {},
            nodeId: node.id,
            onSelect: nodeSelectHandlerRef,
          },
        };
      });
      
      return newNodes;
    });

    setReactFlowEdges(currentEdges => {
      // Only update if edges actually changed
      const newEdgeIds = new Set(connections.map(c => c.id));
      const currentEdgeIds = new Set(currentEdges.map(e => e.id));
      
      const sameEdges = newEdgeIds.size === currentEdgeIds.size && 
        [...newEdgeIds].every(id => currentEdgeIds.has(id));
      
      if (sameEdges) {
        return currentEdges;
      }
      
      return connections.map(conn => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
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
      syncToReactFlow(updatedNodes, workflowConnections);
      return updatedNodes;
    });
  }, [workflowConnections, syncToReactFlow]);

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
      setWorkflowConnections(prev => [...prev, newConnection]);
      
      // Update React Flow edges immediately
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

  // Update node configuration - stable callback
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
      
      // Sync to React Flow after state update
      setTimeout(() => syncToReactFlow(updatedNodes, workflowConnections), 0);
      
      return updatedNodes;
    });
  }, [workflowConnections, syncToReactFlow]);

  // Delete node
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

  // Save current state - memoized to prevent re-renders
  const handleSave = useCallback(() => {
    console.log('Saving workflow state:', { nodes: workflowNodes.length, connections: workflowConnections.length });
    onSave(workflowNodes, workflowConnections);
  }, [workflowNodes, workflowConnections, onSave]);

  // Close panel handler
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

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
          key={selectedNode.id}
          node={selectedNode}
          workflowId={workflowId}
          projectId={projectId}
          triggerFormId={triggerFormId}
          formFields={formFields}
          onConfigChange={(config) => updateNodeConfig(selectedNode.id, config)}
          onDelete={() => deleteNode(selectedNode.id)}
          onClose={handleClosePanel}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
