import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface TreeNode {
  id: string;
  submissionRefId: string;
  formName: string;
  formId: string;
  children: TreeNode[];
}

interface RecordLinkageMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  submissions: any[];
  formFields: any[];
  formName: string;
}

// Cache for cross-ref fields per form
const crFieldsCache: Record<string, Array<{ id: string; label: string; targetFormId: string }>> = {};
// Cache for form names
const formNameCache: Record<string, string> = {};

async function getCrossRefFields(formId: string) {
  if (crFieldsCache[formId]) return crFieldsCache[formId];
  const { data: fields } = await supabase
    .from('form_fields')
    .select('id, label, field_type, custom_config')
    .eq('form_id', formId)
    .in('field_type', ['cross-reference']);

  const result = (fields || []).map(f => {
    let config: any = f.custom_config;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch { config = {}; }
    }
    return { id: f.id, label: f.label, targetFormId: config?.targetFormId || '' };
  }).filter(f => f.targetFormId);

  crFieldsCache[formId] = result;
  return result;
}

async function getFormName(formId: string): Promise<string> {
  if (formNameCache[formId]) return formNameCache[formId];
  const { data } = await supabase.from('forms').select('name').eq('id', formId).single();
  const name = data?.name || 'Unknown';
  formNameCache[formId] = name;
  return name;
}

// Recursively build tree up to maxDepth
async function buildTreeNode(
  submission: any,
  formId: string,
  formName: string,
  depth: number,
  maxDepth: number,
  visited: Set<string>
): Promise<TreeNode> {
  const node: TreeNode = {
    id: submission.id,
    submissionRefId: submission.submission_ref_id || submission.id.slice(0, 8),
    formName,
    formId,
    children: [],
  };

  if (depth >= maxDepth || visited.has(submission.id)) return node;
  visited.add(submission.id);

  const crFields = await getCrossRefFields(formId);
  if (crFields.length === 0) return node;

  for (const crField of crFields) {
    const value = submission.submission_data?.[crField.id];
    if (!value) continue;

    let refIds: string[] = [];
    if (Array.isArray(value)) {
      refIds = value.map((item: any) => item?.submission_ref_id || (typeof item === 'string' ? item : null)).filter(Boolean);
    } else if (typeof value === 'string') {
      refIds = value.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (refIds.length === 0) continue;

    const { data: linkedSubs } = await supabase
      .from('form_submissions')
      .select('id, submission_ref_id, form_id, submission_data')
      .eq('form_id', crField.targetFormId)
      .in('submission_ref_id', refIds);

    const targetName = await getFormName(crField.targetFormId);

    for (const ls of linkedSubs || []) {
      if (visited.has(ls.id)) {
        node.children.push({
          id: ls.id,
          submissionRefId: ls.submission_ref_id || ls.id.slice(0, 8),
          formName: targetName,
          formId: ls.form_id,
          children: [],
        });
        continue;
      }
      const childNode = await buildTreeNode(ls, ls.form_id, targetName, depth + 1, maxDepth, visited);
      node.children.push(childNode);
    }
  }

  return node;
}

/* ── Horizontal Tree Rendering (Left → Right) ── */

function NodeCard({ node, onNavigate }: { node: TreeNode; onNavigate: (id: string) => void }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card hover:shadow-md transition-shadow whitespace-nowrap text-xs"
    >
      <div className="min-w-0">
        <span className="font-mono font-semibold text-foreground">{node.submissionRefId}</span>
        <span className="ml-1.5 text-muted-foreground text-[10px]">({node.formName})</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4 flex-shrink-0 ml-1"
        onClick={(e) => { e.stopPropagation(); onNavigate(node.id); }}
        title="View record"
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
}

function HorizontalTree({ node, onNavigate }: { node: TreeNode; onNavigate: (id: string) => void }) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex items-center">
      {/* The node itself */}
      <NodeCard node={node} onNavigate={onNavigate} />

      {/* Connector + children */}
      {hasChildren && (
        <>
          {/* Horizontal line from node to vertical branch */}
          <div className="w-6 h-px bg-border flex-shrink-0" />

          {/* Vertical branch with children */}
          <div className="flex flex-col relative">
            {/* Vertical line spanning all children */}
            {node.children.length > 1 && (
              <div
                className="absolute left-0 bg-border"
                style={{
                  width: '1px',
                  top: '50%',
                  // Compute from first child center to last child center
                  // Each child row is roughly equal height, so we span from first to last
                }}
              />
            )}
            {node.children.map((child, idx) => (
              <div key={child.id} className="flex items-center relative">
                {/* Vertical connector segment */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: '1px' }}>
                  {/* Top half */}
                  <div
                    className={idx === 0 ? 'bg-transparent' : 'bg-border'}
                    style={{ width: '1px', height: '12px' }}
                  />
                  {/* Bottom half */}
                  <div
                    className={idx === node.children.length - 1 ? 'bg-transparent' : 'bg-border'}
                    style={{ width: '1px', height: '12px' }}
                  />
                </div>
                {/* Horizontal connector to child */}
                <div className="w-5 h-px bg-border flex-shrink-0" />
                {/* Child subtree */}
                <div className="py-[3px]">
                  <HorizontalTree node={child} onNavigate={onNavigate} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand all nodes recursively when dialog opens
  useEffect(() => {
    if (!open || submissions.length === 0) {
      setTreeNodes([]);
      return;
    }

    let cancelled = false;
    const buildAll = async () => {
      setLoading(true);
      const visited = new Set<string>();
      const nodes: TreeNode[] = [];

      for (const sub of submissions) {
        if (cancelled) break;
        const node = await buildTreeNode(sub, formId, formName, 0, 3, visited);
        nodes.push(node);
      }

      if (!cancelled) {
        setTreeNodes(nodes);
        setLoading(false);
      }
    };

    buildAll();
    return () => { cancelled = true; };
  }, [open, submissions, formId, formName]);

  const handleNavigate = useCallback((submissionId: string) => {
    navigate(`/submission/${submissionId}`);
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-fit max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Record Linkage Map
            <Badge variant="outline" className="ml-2">
              {submissions.length} records
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Left-to-right tree showing all cross-reference linked records. Click the arrow to view a record.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 h-40 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Building linkage map...
              </div>
            ) : treeNodes.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No records to display
              </div>
            ) : (
              <div className="space-y-3">
                {treeNodes.map(node => (
                  <HorizontalTree
                    key={node.id}
                    node={node}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
