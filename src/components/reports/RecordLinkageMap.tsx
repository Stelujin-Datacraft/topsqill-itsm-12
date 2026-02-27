import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, GitBranch, Download, Image, FileImage } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { exportAsPng, exportAsSvg } from '@/utils/diagramExport';
import { useToast } from '@/hooks/use-toast';

interface TreeNode {
  id: string;
  submissionRefId: string;
  formName: string;
  formId: string;
  children: TreeNode[];
  submissionData?: Record<string, any>;
}

interface RecordLinkageMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  submissions: any[];
  formFields: any[];
  formName: string;
}

/* ===================== CACHE ===================== */

const crFieldsCache: Record<string, Array<{ id: string; label: string; targetFormId: string }>> = {};
const formNameCache: Record<string, string> = {};

/* ===================== HELPERS ===================== */

function getFormPrefix(formName: string): string {
  const cleanName = formName.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  const words = cleanName.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 5).padEnd(5, 'X');
  if (words.length === 2) {
    const part1 = words[0].slice(0, 3);
    const part2 = words[1].slice(0, 2);
    return (part1 + part2).padEnd(5, 'X').slice(0, 5);
  }
  let prefix = words[0].slice(0, 2);
  for (let i = 1; i < Math.min(words.length, 4); i++) {
    prefix += words[i].charAt(0);
  }
  return prefix.padEnd(5, 'X').slice(0, 5);
}

async function getCrossRefFields(formId: string) {
  if (crFieldsCache[formId]) return crFieldsCache[formId];

  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, label, field_type, custom_config")
    .eq("form_id", formId)
    .in("field_type", ["cross-reference"]);

  const result = (fields || [])
    .map((f) => {
      let config: any = f.custom_config;
      if (typeof config === "string") {
        try { config = JSON.parse(config); } catch { config = {}; }
      }
      return { id: f.id, label: f.label, targetFormId: config?.targetFormId || "" };
    })
    .filter((f) => f.targetFormId);

  crFieldsCache[formId] = result;
  return result;
}

async function getFormName(formId: string): Promise<string> {
  if (formNameCache[formId]) return formNameCache[formId];

  const { data } = await supabase
    .from("forms")
    .select("name")
    .eq("id", formId)
    .single();

  const name = data?.name || "Unknown";
  formNameCache[formId] = name;
  return name;
}

function parseSubmissionData(data: any): Record<string, any> {
  if (!data) return {};
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data as Record<string, any>;
}

/* ===================== BUILD TREE ===================== */

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
    submissionData: parseSubmissionData(submission.submission_data),
  };

  if (depth >= maxDepth || visited.has(submission.id)) return node;
  visited.add(submission.id);

  const crFields = await getCrossRefFields(formId);
  if (!crFields.length) return node;

  for (const crField of crFields) {
    const value = node.submissionData?.[crField.id];
    if (!value) continue;

    let refIds: string[] = [];

    if (Array.isArray(value)) {
      refIds = value
        .map((item: any) =>
          item?.submission_ref_id || (typeof item === "string" ? item : null)
        )
        .filter(Boolean);
    } else if (typeof value === "string") {
      refIds = value.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    if (!refIds.length) continue;

    const { data: linkedSubs } = await supabase
      .from("form_submissions")
      .select("id, submission_ref_id, form_id, submission_data")
      .eq("form_id", crField.targetFormId)
      .in("submission_ref_id", refIds);

    const targetName = await getFormName(crField.targetFormId);

    for (const ls of linkedSubs || []) {
      const childNode = await buildTreeNode(
        ls,
        ls.form_id,
        targetName,
        depth + 1,
        maxDepth,
        visited
      );
      node.children.push(childNode);
    }
  }

  return node;
}

/* ===================== NODE CARD ===================== */

function NodeCard({
  node,
  onNavigate,
}: {
  node: TreeNode;
  onNavigate: (id: string) => void;
}) {
  const prefix = getFormPrefix(node.formName);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-xs">
      <div>
        <span className="font-mono font-semibold">
          {prefix && <span className="text-muted-foreground">{prefix}:</span>}
          {node.submissionRefId}
        </span>
        <span className="ml-2 text-muted-foreground text-[10px]">
          ({node.formName})
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(node.id);
        }}
      >
        <ExternalLink className="h-3 w-3 text-primary" />
      </Button>
    </div>
  );
}

/* ===================== TREE ===================== */

function HorizontalTree({
  node,
  onNavigate,
}: {
  node: TreeNode;
  onNavigate: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex items-center">
      <NodeCard node={node} onNavigate={onNavigate} />

      {hasChildren && (
        <>
          {/* Arrow connector from parent to branch point */}
          <div className="flex items-center flex-shrink-0">
            <div className="w-6 h-px bg-primary relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-l-primary border-y-[3px] border-y-transparent" />
            </div>
          </div>

          <div className="flex flex-col gap-2 relative">
            {/* Vertical connector line for multiple children */}
            {node.children.length > 1 && (
              <div
                className="absolute left-0 w-px bg-primary"
                style={{
                  top: '50%',
                  height: `calc(100% - 16px)`,
                  transform: 'translateY(-50%)',
                }}
              />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="flex items-center relative">
                {/* Horizontal branch line to child */}
                {node.children.length > 1 && (
                  <div className="w-4 h-px bg-primary flex-shrink-0" />
                )}
                <HorizontalTree node={child} onNavigate={onNavigate} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ===================== MAIN COMPONENT ===================== */

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
  const { toast } = useToast();
  const treeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !submissions.length) return;

    const buildAll = async () => {
      setLoading(true);
      const visited = new Set<string>();
      const nodes: TreeNode[] = [];

      for (const sub of submissions) {
        const node = await buildTreeNode(
          sub,
          formId,
          formName,
          0,
          3,
          visited
        );
        nodes.push(node);
      }

      setTreeNodes(nodes);
      setLoading(false);
    };

    buildAll();
  }, [open, submissions, formId, formName]);

  const handleNavigate = useCallback(
    (id: string) => navigate(`/submission/${id}`),
    [navigate]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[65vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Relationship Map
            <Badge variant="outline">{submissions.length}</Badge>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={async () => {
                    if (!treeContainerRef.current) return;
                    await exportAsPng(treeContainerRef.current, `${formName}-relationship-map`);
                    toast({ title: "Exported", description: "Map downloaded as PNG" });
                  }}>
                    <Image className="h-4 w-4 mr-2" />
                    Download as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    if (!treeContainerRef.current) return;
                    await exportAsSvg(treeContainerRef.current, `${formName}-relationship-map`);
                    toast({ title: "Exported", description: "Map downloaded as SVG (Visio)" });
                  }}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Download as SVG (Visio)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-3" ref={treeContainerRef}>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin h-4 w-4" />
              Building linkage map...
            </div>
          ) : (
            treeNodes.map((node) => (
              <HorizontalTree
                key={node.id}
                node={node}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
