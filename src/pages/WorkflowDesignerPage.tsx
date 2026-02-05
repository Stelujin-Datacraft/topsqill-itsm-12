
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkflowDesigner } from '@/components/workflows/WorkflowDesigner';
import { WorkflowInstances } from '@/components/workflows/WorkflowInstances';
import { WorkflowSettingsPanel } from '@/components/workflows/WorkflowSettingsPanel';

import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useAuth } from '@/contexts/AuthContext';
import { TriggerService } from '@/services/triggerService';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, ArrowLeft, Activity, Play, Loader2, Sparkles, Settings } from 'lucide-react';
import { WorkflowNode, WorkflowConnection } from '@/types/workflow';
import { useToast } from '@/hooks/use-toast';
import { AIWorkflowSuggester } from '@/components/ai/AIWorkflowSuggester';
import { supabase } from '@/integrations/supabase/client';

const WorkflowDesignerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadWorkflowNodes, saveWorkflowNodes, workflows } = useWorkflowData();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Simple local state for workflow data
  const [workflowData, setWorkflowData] = useState<{
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  }>({
    nodes: [],
    connections: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('designer');
  
  // Enrollment settings state
  const [enrollmentMode, setEnrollmentMode] = useState<'allow_always' | 'once_per_record' | 'cooldown'>('allow_always');
  const [enrollmentCooldownHours, setEnrollmentCooldownHours] = useState(24);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Get current workflow info
  const currentWorkflow = workflows.find(w => w.id === id);

  // Check if workflow has manual trigger
  const isManualTrigger = workflowData.nodes.some(
    node => node.type === 'start' && node.data?.config?.triggerType === 'manual'
  );

  // Run workflow manually
  const handleRunWorkflow = async () => {
    if (!id || !user?.id) return;
    
    setRunning(true);
    try {
      const executionId = await TriggerService.handleManualTrigger(id, {
        triggeredAt: new Date().toISOString(),
        triggeredFrom: 'workflow_designer'
      }, user.id);
      
      toast({
        title: "Workflow Started",
        description: `Workflow execution started. ID: ${executionId?.slice(0, 8)}...`,
      });
      
      // Switch to execution history tab
      setActiveTab('instances');
    } catch (error) {
      console.error('Error running workflow:', error);
      toast({
        title: "Failed to run workflow",
        description: "Could not start workflow execution. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  // Load workflow data and settings only once on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadWorkflowData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        console.log('Loading workflow data for ID:', id);
        const { nodes, connections } = await loadWorkflowNodes(id);
        
        if (!isMounted) return;

        console.log('Loaded workflow data:', { nodes: nodes.length, connections: connections.length });
        
        setWorkflowData({ nodes, connections });
        
        // Load enrollment settings
        const { data: workflowSettings } = await supabase
          .from('workflows')
          .select('enrollment_mode, enrollment_cooldown_hours')
          .eq('id', id)
          .single();
        
        if (isMounted && workflowSettings) {
          const mode = workflowSettings.enrollment_mode as 'allow_always' | 'once_per_record' | 'cooldown' | null;
          setEnrollmentMode(mode || 'allow_always');
          setEnrollmentCooldownHours(workflowSettings.enrollment_cooldown_hours || 24);
          setSettingsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading workflow data:', error);
        if (isMounted) {
          toast({
            title: "Error loading workflow",
            description: "Failed to load workflow data. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadWorkflowData();
    
    return () => {
      isMounted = false;
    };
  }, [id, loadWorkflowNodes, toast]);

  // Save enrollment settings when they change
  const handleEnrollmentModeChange = async (mode: 'allow_always' | 'once_per_record' | 'cooldown') => {
    if (!id) return;
    
    setEnrollmentMode(mode);
    
    const { error } = await supabase
      .from('workflows')
      .update({ enrollment_mode: mode })
      .eq('id', id);
    
    if (error) {
      console.error('Error saving enrollment mode:', error);
      toast({
        title: "Failed to save setting",
        description: "Could not update enrollment mode.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Setting saved",
        description: `Enrollment mode set to "${mode.replace(/_/g, ' ')}"`,
      });
    }
  };

  const handleCooldownHoursChange = async (hours: number) => {
    if (!id) return;
    
    setEnrollmentCooldownHours(hours);
    
    const { error } = await supabase
      .from('workflows')
      .update({ enrollment_cooldown_hours: hours })
      .eq('id', id);
    
    if (error) {
      console.error('Error saving cooldown hours:', error);
    }
  };

  // Save workflow to database and update local state
  const handleSave = async (nodes: WorkflowNode[], connections: WorkflowConnection[]) => {
    if (!id) return;
    
    setSaving(true);
    console.log('Saving workflow to database...');
    
    try {
      const success = await saveWorkflowNodes(id, nodes, connections);
      
      if (success) {
        toast({
          title: "Workflow saved",
          description: "Your workflow has been saved successfully.",
        });
        
        // Update local state to reflect saved state
        setWorkflowData({ nodes: [...nodes], connections: [...connections] });
      } else {
        toast({
          title: "Save failed",
          description: "Failed to save workflow. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: "Save failed",
        description: "Failed to save workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackToList = () => {
    navigate('/workflows');
  };


  if (loading) {
    return (
      <DashboardLayout title="Workflow Designer">
        <div className="flex items-center justify-center h-full">
          <div>Loading workflow...</div>
        </div>
      </DashboardLayout>
    );
  }

  // Valid node types in our system
  const VALID_NODE_TYPES = ['start', 'action', 'condition', 'wait', 'end'];

  // Map AI-generated node types to valid types
  const mapNodeType = (aiType: string): string => {
    const typeMap: Record<string, string> = {
      'form-assignment': 'action',
      'notification': 'action',
      'approval': 'action',
      'email': 'action',
      'trigger': 'start',
      'branch': 'condition',
      'decision': 'condition',
      'delay': 'wait',
      'pause': 'wait',
      'stop': 'end',
      'finish': 'end',
      'complete': 'end',
    };
    
    const normalized = aiType.toLowerCase().replace(/\s+/g, '-');
    if (VALID_NODE_TYPES.includes(normalized)) {
      return normalized;
    }
    return typeMap[normalized] || 'action'; // Default to action for unknown types
  };

  // Normalize AI-generated config to match our expected structure
  const normalizeNodeConfig = (nodeType: string, aiConfig: Record<string, any>): Record<string, any> => {
    const config = { ...aiConfig };
    
    switch (nodeType) {
      case 'start':
        // Ensure triggerType has a valid value
        if (!config.triggerType) {
          config.triggerType = 'form_submission';
        }
        break;
        
      case 'action':
        // Normalize action type variations
        if (!config.actionType) {
          // Infer from config structure
          if (config.notificationConfig || config.message || config.recipients) {
            config.actionType = 'send_notification';
          } else if (config.fieldUpdates || config.targetFieldId) {
            config.actionType = 'change_field_value';
          } else if (config.targetFormId && config.fieldMappings) {
            config.actionType = 'create_record';
          } else {
            config.actionType = 'send_notification'; // Default
          }
        }
        
        // Normalize notification config if present
        if (config.actionType === 'send_notification' && !config.notificationConfig) {
          config.notificationConfig = {
            type: config.notificationType || 'email',
            subject: config.subject || 'Notification',
            message: config.message || '',
            recipientConfig: config.recipientConfig || {
              type: 'submitter'
            }
          };
        }
        break;
        
      case 'condition':
        // Ensure enhancedCondition structure exists
        if (!config.enhancedCondition && config.condition) {
          // Convert simple condition to enhanced format
          const simpleCondition = config.condition;
          config.enhancedCondition = {
            systemType: 'field_level',
            conditions: [{
              id: `cond_${Date.now()}`,
              systemType: 'field_level',
              fieldLevelCondition: {
                id: `flc_${Date.now()}`,
                formId: simpleCondition.formId || '',
                fieldId: simpleCondition.fieldId || simpleCondition.field || '',
                fieldLabel: simpleCondition.fieldLabel || simpleCondition.field || '',
                fieldType: simpleCondition.fieldType || 'text',
                operator: simpleCondition.operator || '==',
                value: simpleCondition.value || ''
              }
            }]
          };
        }
        break;
        
      case 'wait':
        // Ensure wait config has required fields
        if (!config.waitType) {
          config.waitType = 'duration';
        }
        if (config.waitType === 'duration') {
          config.durationValue = config.durationValue || config.waitDuration || 1;
          config.durationUnit = config.durationUnit || config.waitUnit || 'hours';
        }
        break;
        
      case 'end':
        // Ensure end status
        if (!config.endStatus) {
          config.endStatus = 'completed';
        }
        break;
    }
    
    return config;
  };

  // Handle AI workflow suggestions
  const handleAIWorkflowApply = (suggestion: {
    name: string;
    description: string;
    nodes: Array<{
      type: string;
      label: string;
      description?: string;
      config: Record<string, any>;
      connections?: Array<{ to: string; condition?: string }>;
    }>;
  }) => {
    const timestamp = Date.now();
    
    // Convert AI suggestions to workflow format with valid node types and normalized configs
    const newNodes: WorkflowNode[] = suggestion.nodes.map((node, index) => {
      const nodeType = mapNodeType(node.type);
      const normalizedConfig = normalizeNodeConfig(nodeType, node.config || {});
      
      // Calculate positions - condition nodes need more space for branches
      const yOffset = 100 + index * 150;
      const xOffset = nodeType === 'condition' ? 350 : 250;
      
      return {
        id: `ai-node-${index}-${timestamp}`,
        type: nodeType as any,
        label: node.label,
        position: { x: xOffset, y: yOffset },
        data: { 
          config: normalizedConfig,
          description: node.description || ''
        }
      };
    });

    // Build connections from node.connections with proper edge handling
    const newConnections: WorkflowConnection[] = [];
    const connectionTimestamp = Date.now();
    
    suggestion.nodes.forEach((node, sourceIndex) => {
      const sourceNode = newNodes[sourceIndex];
      
      if (node.connections && node.connections.length > 0) {
        node.connections.forEach((conn, connIndex) => {
          // Find target by label (case-insensitive)
          const targetIndex = suggestion.nodes.findIndex(n => 
            n.label.toLowerCase() === conn.to.toLowerCase()
          );
          
          if (targetIndex !== -1) {
            const targetNode = newNodes[targetIndex];
            
            // Determine source handle for condition nodes
            let sourceHandle: string | undefined;
            if (sourceNode.type === 'condition' && conn.condition) {
              sourceHandle = conn.condition.toLowerCase() === 'true' ? 'true' : 'false';
            }
            
            newConnections.push({
              id: `conn-${sourceIndex}-${connIndex}-${connectionTimestamp}`,
              source: sourceNode.id,
              target: targetNode.id,
              sourceHandle,
              label: sourceNode.type === 'condition' ? conn.condition : undefined
            });
          }
        });
      } else if (sourceNode.type !== 'end' && sourceIndex < suggestion.nodes.length - 1) {
        // Auto-connect sequential nodes if no connections specified (except for end nodes)
        const nextNode = newNodes[sourceIndex + 1];
        newConnections.push({
          id: `conn-auto-${sourceIndex}-${connectionTimestamp}`,
          source: sourceNode.id,
          target: nextNode.id
        });
      }
    });

    console.log('🤖 AI Workflow Applied:', { 
      nodes: newNodes.length, 
      connections: newConnections.length,
      nodeTypes: newNodes.map(n => n.type)
    });

    // Update local state
    setWorkflowData({ nodes: newNodes, connections: newConnections });
    
    toast({
      title: "AI Workflow Applied",
      description: `Created ${newNodes.length} nodes with ${newConnections.length} connections. Configure each node as needed.`,
    });
  };

  return (
    <DashboardLayout 
      title={`Workflow Designer${currentWorkflow ? ` - ${currentWorkflow.name}` : ''}`}
      actions={
        <div className="flex space-x-2">
          <AIWorkflowSuggester
            onApply={handleAIWorkflowApply}
            existingNodes={workflowData.nodes.map(n => ({ id: n.id, type: n.type, label: n.label }))}
            buttonLabel="AI Suggest"
            buttonVariant="outline"
            buttonSize="default"
          />
          {isManualTrigger && (
            <Button 
              variant="default" 
              onClick={handleRunWorkflow}
              disabled={running}
            >
              {running ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {running ? 'Running...' : 'Run Workflow'}
            </Button>
          )}
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>
        </div>
      }
    >
      <div className="h-[calc(100vh-140px)] flex flex-col">
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="designer" className="flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Designer</span>
            </TabsTrigger>
            <TabsTrigger value="instances" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Execution History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="flex-1">
            <WorkflowDesigner
              workflowId={id}
              projectId={currentWorkflow?.projectId}
              initialNodes={workflowData.nodes}
              initialConnections={workflowData.connections}
              onSave={handleSave}
            />
          </TabsContent>

          <TabsContent value="instances" className="flex-1">
            <WorkflowInstances workflowId={id} />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto">
            <WorkflowSettingsPanel
              enrollmentMode={enrollmentMode}
              enrollmentCooldownHours={enrollmentCooldownHours}
              onEnrollmentModeChange={handleEnrollmentModeChange}
              onCooldownHoursChange={handleCooldownHoursChange}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default WorkflowDesignerPage;
