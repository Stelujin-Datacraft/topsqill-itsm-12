
import React, { createContext, useContext, useState } from 'react';

interface WorkflowContextType {
  workflows: any[];
  currentWorkflow: any | null;
  setCurrentWorkflow: (workflow: any) => void;
  createWorkflow: (workflowData: any) => Promise<any>;
  addWorkflow: (workflow: any) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<any | null>(null);

  const createWorkflow = async (workflowData: any) => {
    // Basic implementation - can be expanded later
    const newWorkflow = {
      id: `workflow-${Date.now()}`,
      ...workflowData,
      createdAt: new Date().toISOString(),
      nodes: [],
      connections: [],
    };
    setWorkflows(prev => [...prev, newWorkflow]);
    return newWorkflow;
  };

  const addWorkflow = (workflow: any) => {
    // Ensure workflow has required properties
    const workflowWithDefaults = {
      ...workflow,
      nodes: workflow.nodes || [],
      connections: workflow.connections || [],
    };
    setWorkflows(prev => [...prev, workflowWithDefaults]);
  };

  return (
    <WorkflowContext.Provider value={{
      workflows,
      currentWorkflow,
      setCurrentWorkflow,
      createWorkflow,
      addWorkflow,
    }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
