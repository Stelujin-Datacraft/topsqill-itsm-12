
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, GitBranch, Clock, Square, Settings, FileCheck } from 'lucide-react';

interface NodePaletteProps {
  onAddNode: (nodeType: string, position: { x: number; y: number }) => void;
  getViewportCenter?: () => { x: number; y: number };
}

const nodeDefinitions = [
  {
    type: 'start',
    label: 'Start',
    icon: Play,
    description: 'Trigger point for the workflow',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    type: 'action',
    label: 'Action',
    icon: Settings,
    description: 'Perform actions like assign, notify, update status',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  {
    type: 'approval',
    label: 'Approval',
    icon: FileCheck,
    description: 'Approve or disapprove form submissions',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    description: 'Branch workflow based on conditions',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  {
    type: 'wait',
    label: 'Wait',
    icon: Clock,
    description: 'Wait for time or events',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    type: 'end',
    label: 'End',
    icon: Square,
    description: 'End point of the workflow',
    color: 'bg-red-100 text-red-800 border-red-200',
  },
];

export function NodePalette({ onAddNode, getViewportCenter }: NodePaletteProps) {
  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAddNode = (nodeType: string) => {
    // Get viewport center if available, otherwise use default position
    const center = getViewportCenter?.() ?? { x: 300, y: 200 };
    // Add small random offset to avoid overlapping when adding multiple nodes
    const position = { 
      x: center.x + (Math.random() - 0.5) * 50, 
      y: center.y + (Math.random() - 0.5) * 50 
    };
    onAddNode(nodeType, position);
  };

  return (
    <Card className="w-64 h-full rounded-none border-r">
      <CardHeader>
        <CardTitle className="text-lg">Node Palette</CardTitle>
        <p className="text-sm text-gray-600">Drag to canvas or click to add</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {nodeDefinitions.map((nodeDef) => {
          const Icon = nodeDef.icon;
          return (
            <div
              key={nodeDef.type}
              className={`p-3 rounded border-2 border-dashed cursor-pointer hover:bg-opacity-80 transition-colors ${nodeDef.color}`}
              draggable
              onDragStart={(e) => handleDragStart(e, nodeDef.type)}
              onClick={() => handleAddNode(nodeDef.type)}
            >
              <div className="flex items-center space-x-2">
                <Icon className="h-4 w-4" />
                <span className="font-medium text-sm">{nodeDef.label}</span>
              </div>
              <p className="text-xs mt-1 opacity-75">{nodeDef.description}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
