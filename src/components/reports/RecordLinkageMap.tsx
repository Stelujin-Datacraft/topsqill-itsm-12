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
  selectedFieldIds,
}: {
  node: TreeNode;
  onNavigate: (id: string) => void;
  selectedFieldIds?: string[];
}) {
  const combinedValues: string[] = [];

  selectedFieldIds?.forEach((fieldId) => {
    const value = node.submissionData?.[fieldId];
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (typeof v === "object") {
          combinedValues.push(
            v?.submission_ref_id?.toString() || JSON.stringify(v)
          );
        } else {
          combinedValues.push(v.toString());
        }
      });
    } else if (typeof value === "object") {
      combinedValues.push(
        value?.submission_ref_id?.toString() || JSON.stringify(value)
      );
    } else {
      combinedValues.push(value.toString());
    }
  });

  const [valueOpen, setValueOpen] = useState(false);
  const valueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        valueRef.current &&
        !valueRef.current.contains(event.target as Node)
      ) {
        setValueOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-xs relative">
      <div>
        <span className="font-mono font-semibold">{node.submissionRefId}</span>
        <span className="ml-2 text-muted-foreground text-[10px]">
          ({node.formName})
        </span>
      </div>

      {/* Navigate Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(node.id);
        }}
      >
        <ExternalLink className="h-3 w-3 text-gray-800" />
      </Button>

      {/* VALUE DROPDOWN BUTTON */}
      {combinedValues.length > 0 && (
        <div className="relative" ref={valueRef}>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={(e) => {
              e.stopPropagation();
              setValueOpen((prev) => !prev);
            }}
          >
            Values ({combinedValues.length})
          </Button>

          {valueOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-card border rounded shadow-lg z-50 max-h-40 overflow-auto p-2">
              {combinedValues.map((val, i) => (
                <div
                  key={i}
                  className="text-xs p-1 hover:bg-muted rounded break-words"
                >
                  {val}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===================== TREE ===================== */

function HorizontalTree({
  node,
  onNavigate,
  selectedFieldIds,
}: any) {
  return (
    <div className="flex items-center">
      <NodeCard
        node={node}
        onNavigate={onNavigate}
        selectedFieldIds={selectedFieldIds}
      />

      {node.children.length > 0 && (
        <>
          <div className="w-5 h-px bg-gray-800" />

          <div className="flex flex-col">
            {node.children.map((child: TreeNode) => (
              <div key={child.id} className="flex items-center">
                <div className="w-5 h-px bg-gray-800" />
                <HorizontalTree
                  node={child}
                  onNavigate={onNavigate}
                  selectedFieldIds={selectedFieldIds}
                />
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
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
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

  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id]
    );
  };

  const handleNavigate = useCallback(
    (id: string) => navigate(`/submission/${id}`),
    [navigate]
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

          {/* MULTI FIELD DROPDOWN */}
          <div className="relative mt-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">
                Display Fields:
              </label>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((prev) => !prev);
                  }}
                  className="border rounded px-3 py-1 text-sm bg-background hover:bg-muted min-w-[200px] text-left"
                >
                  {selectedFieldIds.length > 0
                    ? `${selectedFieldIds.length} field(s) selected`
                    : "Select fields"}
                </button>

                {dropdownOpen && (
                  <div className="absolute z-50 mt-1 w-64 bg-card border rounded shadow-lg max-h-60 overflow-auto p-2">
                    {formFields.map((field) => (
                      <label
                        key={field.id}
                        className="flex items-center gap-2 text-sm p-1 hover:bg-muted rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFieldIds.includes(field.id)}
                          onChange={() => toggleField(field.id)}
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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
                selectedFieldIds={selectedFieldIds}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}