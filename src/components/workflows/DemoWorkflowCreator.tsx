
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useToast } from '@/hooks/use-toast';
import { Zap, FileText, UserCheck, Mail } from 'lucide-react';

interface DemoWorkflowCreatorProps {
  onWorkflowCreated: (workflowId: string) => void;
}

export function DemoWorkflowCreator({ onWorkflowCreated }: DemoWorkflowCreatorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { createWorkflow } = useWorkflowData();
  const { toast } = useToast();

  const demoWorkflows = [
    {
      id: 'approval-workflow',
      name: 'Form Approval Workflow',
      description: 'Automatically route form submissions for approval',
      icon: UserCheck,
      template: {
        name: 'Form Approval Workflow',
        description: 'Automatically route form submissions for approval with notifications',
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Form Submitted', nodeType: 'start' }
          },
          {
            id: 'approval-1',
            type: 'assignment',
            position: { x: 300, y: 100 },
            data: { label: 'Assign for Approval', nodeType: 'assignment' }
          },
          {
            id: 'notification-1',
            type: 'notification',
            position: { x: 500, y: 100 },
            data: { label: 'Send Notification', nodeType: 'notification' }
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 700, y: 100 },
            data: { label: 'Complete', nodeType: 'end' }
          }
        ],
        connections: [
          { id: 'c1', source: 'start-1', target: 'approval-1' },
          { id: 'c2', source: 'approval-1', target: 'notification-1' },
          { id: 'c3', source: 'notification-1', target: 'end-1' }
        ]
      }
    },
    {
      id: 'review-workflow',
      name: 'Document Review Workflow',
      description: 'Multi-stage document review process',
      icon: FileText,
      template: {
        name: 'Document Review Workflow',
        description: 'Multi-stage document review with conditional routing',
        nodes: [
          {
            id: 'start-2',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Document Submitted', nodeType: 'start' }
          },
          {
            id: 'condition-1',
            type: 'condition',
            position: { x: 300, y: 100 },
            data: { label: 'Check Document Type', nodeType: 'condition' }
          },
          {
            id: 'review-1',
            type: 'assignment',
            position: { x: 500, y: 50 },
            data: { label: 'Technical Review', nodeType: 'assignment' }
          },
          {
            id: 'review-2',
            type: 'assignment',
            position: { x: 500, y: 150 },
            data: { label: 'Legal Review', nodeType: 'assignment' }
          },
          {
            id: 'end-2',
            type: 'end',
            position: { x: 700, y: 100 },
            data: { label: 'Review Complete', nodeType: 'end' }
          }
        ],
        connections: [
          { id: 'c1', source: 'start-2', target: 'condition-1' },
          { id: 'c2', source: 'condition-1', target: 'review-1' },
          { id: 'c3', source: 'condition-1', target: 'review-2' },
          { id: 'c4', source: 'review-1', target: 'end-2' },
          { id: 'c5', source: 'review-2', target: 'end-2' }
        ]
      }
    },
    {
      id: 'notification-workflow',
      name: 'Smart Notification Workflow',
      description: 'Intelligent notification routing based on form data',
      icon: Mail,
      template: {
        name: 'Smart Notification Workflow',
        description: 'Route notifications based on form field values',
        nodes: [
          {
            id: 'start-3',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Form Received', nodeType: 'start' }
          },
          {
            id: 'condition-2',
            type: 'condition',
            position: { x: 300, y: 100 },
            data: { label: 'Check Priority', nodeType: 'condition' }
          },
          {
            id: 'urgent-notify',
            type: 'notification',
            position: { x: 500, y: 50 },
            data: { label: 'Urgent Notification', nodeType: 'notification' }
          },
          {
            id: 'normal-notify',
            type: 'notification',
            position: { x: 500, y: 150 },
            data: { label: 'Normal Notification', nodeType: 'notification' }
          },
          {
            id: 'end-3',
            type: 'end',
            position: { x: 700, y: 100 },
            data: { label: 'Notification Sent', nodeType: 'end' }
          }
        ],
        connections: [
          { id: 'c1', source: 'start-3', target: 'condition-2' },
          { id: 'c2', source: 'condition-2', target: 'urgent-notify' },
          { id: 'c3', source: 'condition-2', target: 'normal-notify' },
          { id: 'c4', source: 'urgent-notify', target: 'end-3' },
          { id: 'c5', source: 'normal-notify', target: 'end-3' }
        ]
      }
    }
  ];

  const handleCreateDemoWorkflow = async (template: any) => {
    setIsCreating(true);
    try {
      const workflow = await createWorkflow({
        name: template.name,
        description: template.description,
      });

      if (workflow) {
        // Here you would also save the nodes and connections
        // For now, we'll just create the workflow and let the designer handle the rest
        toast({
          title: "Demo workflow created",
          description: `${template.name} has been created successfully.`,
        });
        onWorkflowCreated(workflow.id);
      }
    } catch (error) {
      console.error('Error creating demo workflow:', error);
      toast({
        title: "Error",
        description: "Failed to create demo workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Demo Workflow Templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {demoWorkflows.map((workflow) => (
            <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <workflow.icon className="h-5 w-5 text-primary" />
                    <h3 className="font-medium">{workflow.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {workflow.description}
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleCreateDemoWorkflow(workflow.template)}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Template'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
