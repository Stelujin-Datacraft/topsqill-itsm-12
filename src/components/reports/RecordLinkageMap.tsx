import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ChevronRight, ExternalLink, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface TreeNode {
  id: string;
  submissionRefId: string;
  formName: string;
  formId: string;
  children: TreeNode[];
  isLoading?: boolean;
  isExpanded?: boolean;
}

interface RecordLinkageMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  submissions: any[];
  formFields: any[];
  formName: string;
}

// Fetch cross-ref linked children for a given submission
async function fetchLinkedChildren(
  submission: any,
  crossRefFields: Array<{ id: string; label: string; targetFormId: string }>
): Promise<TreeNode[]> {
  const children: TreeNode[] = [];

  for (const crField of crossRefFields) {
    const value = submission.submission_data?.[crField.id];
    if (!value) continue;

    let refIds: string[] = [];
    if (Array.isArray(value)) {
      refIds = value.map((item: any) => item?.submission_ref_id || (typeof item === 'string' ? item : null)).filter(Boolean);
    } else if (typeof value === 'string') {
      refIds = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (refIds.length === 0) continue;

    // Fetch linked submissions
    const { data: linkedSubs } = await supabase
      .from('form_submissions')
      .select('id, submission_ref_id, form_id, submission_data')
      .eq('form_id', crField.targetFormId)
      .in('submission_ref_id', refIds);

    // Fetch target form name
    const { data: formData } = await supabase
      .from('forms')
      .select('name')
      .eq('id', crField.targetFormId)
      .single();

    for (const ls of linkedSubs || []) {
      children.push({
        id: ls.id,
        submissionRefId: ls.submission_ref_id || ls.id.slice(0, 8),
        formName: formData?.name || crField.label,
        formId: ls.form_id,
        children: [],
        isExpanded: false,
      });
    }
  }

  return children;
}

// Get cross-ref fields from a form
async function getCrossRefFields(formId: string) {
  const { data: fields } = await supabase
    .from('form_fields')
    .select('id, label, field_type, custom_config')
    .eq('form_id', formId)
    .in('field_type', ['cross-reference']);

  return (fields || []).map(f => {
    let config: any = f.custom_config;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch { config = {}; }
    }
    return {
      id: f.id,
      label: f.label,
      targetFormId: config?.targetFormId || '',
    };
  }).filter(f => f.targetFormId);
}

function TreeNodeComponent({
  node,
  depth,
  onExpandNode,
  onNavigate,
}: {
  node: TreeNode;
  depth: number;
  onExpandNode: (node: TreeNode) => void;
  onNavigate: (submissionId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const bgShades = [
    'bg-primary/10',
    'bg-primary/7',
    'bg-primary/5',
    'bg-muted/50',
  ];
  const bgClass = bgShades[Math.min(depth, bgShades.length - 1)];

  return (
    <div className="flex items-start gap-0">
      {/* Node card */}
      <div className="flex flex-col items-start">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border ${bgClass} min-w-[180px] max-w-[260px] cursor-pointer hover:shadow-md transition-shadow`}
          onClick={() => onExpandNode(node)}
        >
          {/* Expand indicator */}
          <div className="flex-shrink-0">
            {node.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <ChevronRight
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  node.isExpanded ? 'rotate-90' : ''
                }`}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground font-mono truncate">
              {node.submissionRefId}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{node.formName}</p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(node.id);
            }}
            title="View record"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        {/* Children connector + children */}
        {node.isExpanded && hasChildren && (
          <div className="flex items-stretch ml-6 mt-0">
            {/* Vertical line */}
            <div className="flex flex-col">
              {node.children.map((child, idx) => (
                <div key={child.id} className="flex items-center">
                  {/* Horizontal connector */}
                  <div className="flex flex-col items-center">
                    {/* Top half of vertical line */}
                    <div
                      className={`w-px ${idx === 0 ? 'bg-transparent' : 'bg-border'}`}
                      style={{ height: '20px' }}
                    />
                    {/* Horizontal branch */}
                    <div className="flex items-center">
                      <div className="w-6 h-px bg-border" />
                      <TreeNodeComponent
                        node={child}
                        depth={depth + 1}
                        onExpandNode={onExpandNode}
                        onNavigate={onNavigate}
                      />
                    </div>
                    {/* Bottom half of vertical line */}
                    <div
                      className={`w-px ${idx === node.children.length - 1 ? 'bg-transparent' : 'bg-border'}`}
                      style={{ height: '20px', flex: 1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RecordLinkageMap({
  open,
  onOpenChange,
  formId,
  submissions,
  formFields,
  formName,
}: RecordLinkageMapProps) {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [crossRefFieldsCache, setCrossRefFieldsCache] = useState<Record<string, any[]>>({});
  const navigate = useNavigate();

  // Build initial tree from submissions
  useEffect(() => {
    if (!open || submissions.length === 0) return;

    const nodes: TreeNode[] = submissions.map(sub => ({
      id: sub.id,
      submissionRefId: sub.submission_ref_id || sub.id.slice(0, 8),
      formName: formName,
      formId: formId,
      children: [],
      isExpanded: false,
    }));
    setTreeNodes(nodes);
  }, [open, submissions, formId, formName]);

  // Recursively expand a node
  const handleExpandNode = useCallback(async (targetNode: TreeNode) => {
    // Toggle collapse
    if (targetNode.isExpanded) {
      setTreeNodes(prev => updateNodeInTree(prev, targetNode.id, { isExpanded: false }));
      return;
    }

    // If already has children, just expand
    if (targetNode.children.length > 0) {
      setTreeNodes(prev => updateNodeInTree(prev, targetNode.id, { isExpanded: true }));
      return;
    }

    // Fetch children
    setTreeNodes(prev => updateNodeInTree(prev, targetNode.id, { isLoading: true }));

    try {
      // Get cross-ref fields for this form
      let crFields = crossRefFieldsCache[targetNode.formId];
      if (!crFields) {
        crFields = await getCrossRefFields(targetNode.formId);
        setCrossRefFieldsCache(prev => ({ ...prev, [targetNode.formId]: crFields }));
      }

      if (crFields.length === 0) {
        setTreeNodes(prev => updateNodeInTree(prev, targetNode.id, { isLoading: false, isExpanded: true }));
        return;
      }

      // Fetch the full submission data
      const { data: subData } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, form_id, submission_data')
        .eq('id', targetNode.id)
        .single();

      if (!subData) {
        setTreeNodes(prev => updateNodeInTree(prev, targetNode.id, { isLoading: false, isExpanded: true }));
        return;
      }

      const children = await fetchLinkedChildren(subData, crFields);
      setTreeNodes(prev =>
        updateNodeInTree(prev, targetNode.id, {
          children,
          isExpanded: true,
          isLoading: false,
        })
      );
    } catch (err) {
      console.error('Error expanding node:', err);
      setTreeNodes(prev => updateNodeInTree(prev, targetNode.id, { isLoading: false }));
    }
  }, [crossRefFieldsCache]);

  const handleNavigate = useCallback((submissionId: string) => {
    navigate(`/submission/${submissionId}`);
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Record Linkage Map
            <Badge variant="outline" className="ml-2">
              {submissions.length} records
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Click on any record to expand and view its linked cross-reference records. Click the arrow icon to navigate to the record.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 min-w-[600px]">
            {treeNodes.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No records to display
              </div>
            ) : (
              <div className="space-y-1">
                {treeNodes.map(node => (
                  <TreeNodeComponent
                    key={node.id}
                    node={node}
                    depth={0}
                    onExpandNode={handleExpandNode}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Helper: recursively update a node in the tree
function updateNodeInTree(
  nodes: TreeNode[],
  targetId: string,
  updates: Partial<TreeNode>
): TreeNode[] {
  return nodes.map(node => {
    if (node.id === targetId) {
      return { ...node, ...updates };
    }
    if (node.children.length > 0) {
      return { ...node, children: updateNodeInTree(node.children, targetId, updates) };
    }
    return node;
  });
}
