import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ReactFlow, 
  Node, 
  Edge, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileText, Clock, CheckCircle, Mail, Database, MessageSquare, Play } from "lucide-react";

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    position: { x: 50, y: 100 },
    data: { 
      label: (
        <div className="flex items-center gap-2 p-2">
          <FileText className="h-4 w-4 text-primary" />
          <span>Form Submit</span>
        </div>
      ) 
    },
    style: { background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary))', borderRadius: '8px' }
  },
  {
    id: '2',
    position: { x: 250, y: 50 },
    data: { 
      label: (
        <div className="flex items-center gap-2 p-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <span>Manager Review</span>
        </div>
      ) 
    },
    style: { background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgb(59, 130, 246)', borderRadius: '8px' }
  },
  {
    id: '3',
    position: { x: 250, y: 150 },
    data: { 
      label: (
        <div className="flex items-center gap-2 p-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>Auto Approve</span>
        </div>
      ) 
    },
    style: { background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgb(34, 197, 94)', borderRadius: '8px' }
  },
  {
    id: '4',
    position: { x: 450, y: 100 },
    data: { 
      label: (
        <div className="flex items-center gap-2 p-2">
          <Mail className="h-4 w-4 text-blue-600" />
          <span>Send Email</span>
        </div>
      ) 
    },
    style: { background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgb(59, 130, 246)', borderRadius: '8px' }
  },
  {
    id: '5',
    position: { x: 650, y: 50 },
    data: { 
      label: (
        <div className="flex items-center gap-2 p-2">
          <Database className="h-4 w-4 text-purple-600" />
          <span>Update Database</span>
        </div>
      ) 
    },
    style: { background: 'rgba(147, 51, 234, 0.1)', border: '1px solid rgb(147, 51, 234)', borderRadius: '8px' }
  },
  {
    id: '6',
    position: { x: 650, y: 150 },
    data: { 
      label: (
        <div className="flex items-center gap-2 p-2">
          <MessageSquare className="h-4 w-4 text-orange-600" />
          <span>Slack Notify</span>
        </div>
      ) 
    },
    style: { background: 'rgba(234, 88, 12, 0.1)', border: '1px solid rgb(234, 88, 12)', borderRadius: '8px' }
  }
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: 'hsl(var(--primary))' } },
  { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: 'hsl(var(--primary))' } },
  { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: 'hsl(var(--secondary))' } },
  { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: 'rgb(34, 197, 94)' } },
  { id: 'e4-5', source: '4', target: '5', animated: true, style: { stroke: 'rgb(59, 130, 246)' } },
  { id: 'e4-6', source: '4', target: '6', animated: true, style: { stroke: 'rgb(59, 130, 246)' } }
];

export default function WorkflowPreview() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isPlaying, setIsPlaying] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handlePlayDemo = () => {
    setIsPlaying(true);
    // Reset after animation
    setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <section aria-labelledby="workflow-preview-heading" className="container mx-auto px-4">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle id="workflow-preview-heading" className="text-2xl text-foreground">
                Visual Workflow Automation
              </CardTitle>
              <CardDescription className="text-lg">
                Drag, connect, and automate complex business processes visually
              </CardDescription>
            </div>
            <Button 
              onClick={handlePlayDemo}
              className="bg-foreground text-background hover:bg-foreground/90"
              disabled={isPlaying}
            >
              <Play className="h-4 w-4 mr-2" />
              {isPlaying ? "Playing..." : "Demo Flow"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-96 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              attributionPosition="bottom-left"
              className={isPlaying ? 'workflow-playing' : ''}
            >
              <Background />
              <Controls />
              <MiniMap 
                nodeColor="#e2e8f0"
                nodeStrokeWidth={2}
                className="!bg-background !border !border-border"
              />
            </ReactFlow>
          </div>
          
          <div className="p-6 bg-muted/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary">Triggers</Badge>
                <p className="text-sm text-muted-foreground">Form submissions, webhooks, schedules</p>
              </div>
              <div>
                <Badge variant="secondary" className="mb-2 bg-secondary/10 text-secondary">Actions</Badge>
                <p className="text-sm text-muted-foreground">Approvals, calculations, transformations</p>
              </div>
              <div>
                <Badge variant="secondary" className="mb-2 bg-green-100 text-green-700">Conditions</Badge>
                <p className="text-sm text-muted-foreground">Smart routing based on data</p>
              </div>
              <div>
                <Badge variant="secondary" className="mb-2 bg-blue-100 text-blue-700">Integrations</Badge>
                <p className="text-sm text-muted-foreground">Email, Slack, databases, APIs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <style>{`
        .workflow-playing .react-flow__edge-path {
          animation: flow 2s ease-in-out infinite;
        }
        
        @keyframes flow {
          0%, 100% { stroke-dasharray: 5, 5; stroke-dashoffset: 0; }
          50% { stroke-dasharray: 5, 5; stroke-dashoffset: -10; }
        }
      `}</style>
    </section>
  );
}