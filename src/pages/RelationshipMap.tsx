
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, GitBranch, ExternalLink, Download, Image, FileImage } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from '@/contexts/FormContext';
import { useProject } from '@/contexts/ProjectContext';
import { exportAsPng, exportAsSvg } from '@/utils/diagramExport';
import { useToast } from '@/hooks/use-toast';

interface TreeNode {
  id: string;
  submissionRefId: string;
  formName: string;
  formId: string;
  children: TreeNode[];
  submissionData?: Record<string, any>;
  isSelected?: boolean;
  fieldLabels?: Record<string, string>;
}

/* ===================== CACHE ===================== */
const crFieldsCache: Record<string, Array<{ id: string; label: string; targetFormId: string; mapDisplayFields?: string[] }>> = {};
const formNameCache: Record<string, string> = {};
const formFieldLabelsCache: Record<string, Record<string, string>> = {};
const formPrefixCache: Record<string, string> = {};

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
    .from('form_fields')
    .select('id, label, field_type, custom_config')
    .eq('form_id', formId)
    .in('field_type', ['cross-reference']);

  const result = (fields || []).map((f) => {
    let config: any = f.custom_config;
    if (typeof config === 'string') { try { config = JSON.parse(config); } catch { config = {}; } }
    return { id: f.id, label: f.label, targetFormId: config?.targetFormId || '', mapDisplayFields: config?.mapDisplayFields || [] };
  }).filter((f) => f.targetFormId);

  crFieldsCache[formId] = result;
  return result;
}

async function getFormName(formId: string): Promise<string> {
  if (formNameCache[formId]) return formNameCache[formId];
  const { data } = await supabase.from('forms').select('name').eq('id', formId).single();
  const name = data?.name || 'Unknown';
  formNameCache[formId] = name;
  formPrefixCache[formId] = getFormPrefix(name);
  return name;
}

async function getFieldLabels(formId: string): Promise<Record<string, string>> {
  if (formFieldLabelsCache[formId]) return formFieldLabelsCache[formId];
  const { data } = await supabase.from('form_fields').select('id, label').eq('form_id', formId);
  const labels: Record<string, string> = {};
  (data || []).forEach(f => { labels[f.id] = f.label; });
  formFieldLabelsCache[formId] = labels;
  return labels;
}

function parseSubmissionData(data: any): Record<string, any> {
  if (!data) return {};
  if (typeof data === 'string') { try { return JSON.parse(data); } catch { return {}; } }
  return data as Record<string, any>;
}

/* ===================== BUILD TREE (DOWNSTREAM) ===================== */
async function buildDownstreamTree(
  submission: any, formId: string, formName: string,
  depth: number, maxDepth: number, visited: Set<string>,
  selectedSubmissionId?: string
): Promise<TreeNode> {
  const fieldLabels = await getFieldLabels(formId);
  const node: TreeNode = {
    id: submission.id,
    submissionRefId: submission.submission_ref_id || submission.id.slice(0, 8),
    formName, formId,
    children: [],
    submissionData: parseSubmissionData(submission.submission_data),
    isSelected: submission.id === selectedSubmissionId,
    fieldLabels,
  };

  if (depth >= maxDepth || visited.has(submission.id)) return node;
  visited.add(submission.id);

  const crFields = await getCrossRefFields(formId);
  
  // Collect all ref IDs and their target forms first
  const linkQueries: Array<{ crField: typeof crFields[0]; refIds: string[] }> = [];
  for (const crField of crFields) {
    const value = node.submissionData?.[crField.id];
    if (!value) continue;
    let refIds: string[] = [];
    if (Array.isArray(value)) {
      refIds = value.map((item: any) => item?.submission_ref_id || (typeof item === 'string' ? item : null)).filter(Boolean);
    } else if (typeof value === 'string') {
      refIds = value.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (refIds.length) linkQueries.push({ crField, refIds });
  }

  // Execute all link queries in parallel
  const linkResults = await Promise.all(
    linkQueries.map(async ({ crField, refIds }) => {
      const [{ data: linkedSubs }, targetName] = await Promise.all([
        supabase
          .from('form_submissions')
          .select('id, submission_ref_id, form_id, submission_data')
          .eq('form_id', crField.targetFormId)
          .in('submission_ref_id', refIds),
        getFormName(crField.targetFormId),
      ]);
      return { linkedSubs: linkedSubs || [], targetName, targetFormId: crField.targetFormId };
    })
  );

  // Build child nodes (parallel per batch)
  const childPromises: Promise<TreeNode>[] = [];
  for (const { linkedSubs, targetName } of linkResults) {
    for (const ls of linkedSubs) {
      childPromises.push(
        buildDownstreamTree(ls, ls.form_id, targetName, depth + 1, maxDepth, visited, selectedSubmissionId)
      );
    }
  }
  node.children = await Promise.all(childPromises);

  return node;
}

/* ===================== FIND UPSTREAM PARENTS (OPTIMIZED) ===================== */
const upstreamCrFieldsCache: Array<{ id: string; form_id: string; targetFormId: string }> | null = null;

async function getAllCrossRefFields(): Promise<Array<{ id: string; form_id: string; targetFormId: string }>> {
  const { data: allCrFields } = await supabase
    .from('form_fields')
    .select('id, form_id, custom_config')
    .eq('field_type', 'cross-reference');

  return (allCrFields || []).map(f => {
    let config: any = f.custom_config;
    if (typeof config === 'string') { try { config = JSON.parse(config); } catch { config = {}; } }
    return { id: f.id, form_id: f.form_id as string, targetFormId: config?.targetFormId || '' };
  }).filter(f => f.targetFormId);
}

async function findUpstreamParents(
  submissionRefId: string, formId: string, formName: string,
  depth: number, maxDepth: number, visited: Set<string>,
  selectedSubmissionId: string
): Promise<TreeNode[]> {
  if (depth >= maxDepth) return [];

  const allCrFields = await getAllCrossRefFields();
  const parentingFields = allCrFields.filter(f => f.targetFormId === formId);

  if (parentingFields.length === 0) return [];

  const parentNodes: TreeNode[] = [];

  // Group by form_id to batch queries
  const fieldsByForm = new Map<string, typeof parentingFields>();
  for (const pf of parentingFields) {
    const existing = fieldsByForm.get(pf.form_id) || [];
    existing.push(pf);
    fieldsByForm.set(pf.form_id, existing);
  }

  // Fetch all parent form submissions in parallel, using textSearch to filter
  const formEntries = Array.from(fieldsByForm.entries());
  const results = await Promise.all(
    formEntries.map(([fId]) =>
      supabase
        .from('form_submissions')
        .select('id, submission_ref_id, form_id, submission_data')
        .eq('form_id', fId)
        .textSearch('submission_data', submissionRefId, { type: 'plain' })
        .limit(50)
        .then(res => ({ formId: fId, data: res.data }))
        // Fallback: if textSearch returns nothing, try a broader but still limited query
        .then(async (res) => {
          if (res.data && res.data.length > 0) return res;
          const fallback = await supabase
            .from('form_submissions')
            .select('id, submission_ref_id, form_id, submission_data')
            .eq('form_id', res.formId)
            .limit(100);
          return { formId: res.formId, data: fallback.data };
        })
    )
  );

  for (const { formId: fId, data: parentSubs } of results) {
    const fields = fieldsByForm.get(fId) || [];
    
    for (const ps of parentSubs || []) {
      if (visited.has(ps.id)) continue;
      const sd = parseSubmissionData(ps.submission_data);
      
      let matched = false;
      for (const pf of fields) {
        const val = sd[pf.id];
        if (!val) continue;

        let refs: string[] = [];
        if (Array.isArray(val)) {
          refs = val.map((v: any) => v?.submission_ref_id || (typeof v === 'string' ? v : null)).filter(Boolean);
        } else if (typeof val === 'string') {
          refs = val.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        if (refs.includes(submissionRefId)) {
          matched = true;
          break;
        }
      }

      if (!matched) continue;
      
      visited.add(ps.id);
      const [parentFormName, fieldLabels] = await Promise.all([
        getFormName(fId),
        getFieldLabels(fId),
      ]);

      // Recursively find grandparents (limit depth)
      const grandparents = await findUpstreamParents(
        ps.submission_ref_id || ps.id.slice(0, 8),
        fId, parentFormName,
        depth + 1, maxDepth, visited, selectedSubmissionId
      );

      const node: TreeNode = {
        id: ps.id,
        submissionRefId: ps.submission_ref_id || ps.id.slice(0, 8),
        formName: parentFormName,
        formId: fId,
        children: [],
        submissionData: sd,
        isSelected: false,
        fieldLabels,
      };

      if (grandparents.length > 0) {
        for (const gp of grandparents) {
          gp.children = [node];
          parentNodes.push(gp);
        }
      } else {
        parentNodes.push(node);
      }
    }
  }

  return parentNodes;
}

/* ===================== MAP DISPLAY FIELD VALUES ===================== */
function getMapDisplayValues(node: TreeNode): Array<{ label: string; value: string }> {
  const crFields = crFieldsCache[node.formId] || [];
  const allMapFields = new Set<string>();
  
  Object.values(crFieldsCache).forEach(fields => {
    fields.forEach(f => {
      if (f.targetFormId === node.formId && f.mapDisplayFields?.length) {
        f.mapDisplayFields.forEach(mf => allMapFields.add(mf));
      }
    });
  });

  crFields.forEach(f => {
    if (f.mapDisplayFields?.length) {
      f.mapDisplayFields.forEach(mf => allMapFields.add(mf));
    }
  });

  const result: Array<{ label: string; value: string }> = [];
  allMapFields.forEach(fieldId => {
    const val = node.submissionData?.[fieldId];
    if (val !== undefined && val !== null && val !== '') {
      const label = node.fieldLabels?.[fieldId] || fieldId;
      const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      result.push({ label, value: displayVal });
    }
  });

  return result;
}

/* ===================== NODE CARD ===================== */
function MapNodeCard({ node, onNavigate }: { node: TreeNode; onNavigate: (id: string) => void }) {
  const mapValues = getMapDisplayValues(node);
  const prefix = formPrefixCache[node.formId] || getFormPrefix(node.formName);

  return (
    <div className={`flex flex-col gap-1 px-3 py-2 rounded-lg border-2 min-w-[180px] max-w-[280px] text-xs transition-all ${
      node.isSelected
        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 ring-2 ring-primary/30'
        : 'border-border bg-card hover:border-muted-foreground/40'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-xs">
          {prefix && <span className="text-muted-foreground">{prefix}:</span>}
          {node.submissionRefId}
        </span>
        <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => onNavigate(node.id)}>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
      <Badge variant="secondary" className="text-[10px] w-fit">{node.formName}</Badge>
      {mapValues.map((mv, i) => (
        <div key={i} className="text-sm min-w-0">
          <div className="text-muted-foreground text-sm font-semibold">
            {mv.label}:
          </div>
          <div className="font-mono break-words whitespace-pre-wrap">
            {mv.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================== HORIZONTAL TREE WITH ARROWS ===================== */
function HorizontalTreeView({ node, onNavigate }: { node: TreeNode; onNavigate: (id: string) => void }) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex items-center">
      <MapNodeCard node={node} onNavigate={onNavigate} />

      {hasChildren && (
        <>
          {/* Arrow connector */}
          <div className="flex items-center flex-shrink-0">
            <div className="w-8 h-px bg-primary relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-primary border-y-[4px] border-y-transparent" />
            </div>
          </div>

          <div className="flex flex-col gap-3 relative">
            {node.children.length > 1 && (
              <div
                className="absolute left-0 w-px bg-primary"
                style={{
                  top: '50%',
                  height: `calc(100% - 20px)`,
                  transform: 'translateY(-50%)',
                }}
              />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="flex items-center relative">
                {node.children.length > 1 && (
                  <div className="w-4 h-px bg-primary flex-shrink-0" />
                )}
                <HorizontalTreeView node={child} onNavigate={onNavigate} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ===================== MAIN PAGE ===================== */
export default function RelationshipMap() {
  const { forms } = useForm();
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const { toast } = useToast();
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const [selectedFormId, setSelectedFormId] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmissionRefId, setSelectedSubmissionRefId] = useState('');
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const projectForms = forms.filter(f => f.projectId === currentProject?.id);

  // Load submissions when form selected
  useEffect(() => {
    if (!selectedFormId) { setSubmissions([]); setSelectedSubmissionRefId(''); return; }
    const load = async () => {
      setLoadingSubmissions(true);
      const { data } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id')
        .eq('form_id', selectedFormId)
        .order('submitted_at', { ascending: false })
        .limit(500);
      setSubmissions(data || []);
      setLoadingSubmissions(false);
    };
    load();
  }, [selectedFormId]);

  // Build tree when submission selected
  useEffect(() => {
    if (!selectedSubmissionRefId || !selectedFormId) { setTreeRoot(null); return; }
    let cancelled = false;

    const build = async () => {
      setLoading(true);
      // Clear caches for fresh data
      Object.keys(crFieldsCache).forEach(k => delete crFieldsCache[k]);
      Object.keys(formFieldLabelsCache).forEach(k => delete formFieldLabelsCache[k]);

      const selectedSub = submissions.find(s => s.submission_ref_id === selectedSubmissionRefId);
      if (!selectedSub) { setLoading(false); return; }

      const { data: fullSub } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, form_id, submission_data')
        .eq('id', selectedSub.id)
        .single();

      if (!fullSub || cancelled) { setLoading(false); return; }

      const formName = await getFormName(selectedFormId);
      const visited = new Set<string>();

      // Build downstream tree (limit depth to 3)
      const downstreamNode = await buildDownstreamTree(
        fullSub, selectedFormId, formName, 0, 3, visited, fullSub.id
      );

      if (cancelled) { setLoading(false); return; }

      // Find upstream parents (limit depth to 2)
      const upstreamVisited = new Set<string>([fullSub.id]);
      const upstreamParents = await findUpstreamParents(
        fullSub.submission_ref_id || fullSub.id.slice(0, 8),
        selectedFormId, formName,
        0, 2, upstreamVisited, fullSub.id
      );

      if (cancelled) { setLoading(false); return; }

      if (upstreamParents.length > 0) {
        const setDeepestChild = (node: TreeNode): void => {
          if (node.children.length === 0) {
            node.children = [downstreamNode];
          } else {
            node.children.forEach(setDeepestChild);
          }
        };

        if (upstreamParents.length === 1) {
          setDeepestChild(upstreamParents[0]);
          setTreeRoot(upstreamParents[0]);
        } else {
          const virtualRoot: TreeNode = {
            id: 'virtual-root',
            submissionRefId: 'Upstream',
            formName: 'Multiple Parents',
            formId: '',
            children: upstreamParents.map(p => {
              setDeepestChild(p);
              return p;
            }),
            isSelected: false,
            fieldLabels: {},
          };
          setTreeRoot(virtualRoot);
        }
      } else {
        setTreeRoot(downstreamNode);
      }

      setLoading(false);
    };

    build();
    return () => { cancelled = true; };
  }, [selectedSubmissionRefId, selectedFormId]);

  const handleNavigate = useCallback((id: string) => navigate(`/submission/${id}`), [navigate]);

  const selectedFormName = projectForms.find(f => f.id === selectedFormId)?.name || '';
  const selectedPrefix = selectedFormName ? getFormPrefix(selectedFormName) : '';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Relationship Map</h1>
              <p className="text-sm text-muted-foreground">Visualize upstream and downstream record linkages</p>
            </div>
          </div>

          {treeRoot && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => {
                  if (!treeContainerRef.current) return;
                  await exportAsPng(treeContainerRef.current, `relationship-map-${selectedSubmissionRefId}`);
                  toast({ title: 'Exported', description: 'Map downloaded as PNG' });
                }}>
                  <Image className="h-4 w-4 mr-2" /> Download as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  if (!treeContainerRef.current) return;
                  await exportAsSvg(treeContainerRef.current, `relationship-map-${selectedSubmissionRefId}`);
                  toast({ title: 'Exported', description: 'Map downloaded as SVG (Visio)' });
                }}>
                  <FileImage className="h-4 w-4 mr-2" /> Download as SVG (Visio)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 px-6 py-4 border-b bg-muted/30">
        <div className="flex items-end gap-4">
          <div className="space-y-1 min-w-[250px]">
            <Label className="text-sm font-medium">Select Form</Label>
            <Select value={selectedFormId} onValueChange={(v) => { setSelectedFormId(v); setSelectedSubmissionRefId(''); setTreeRoot(null); }}>
              <SelectTrigger><SelectValue placeholder="Choose a form" /></SelectTrigger>
              <SelectContent>
                {projectForms.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[250px]">
            <Label className="text-sm font-medium">Select Record (Submission Ref ID)</Label>
            <Select value={selectedSubmissionRefId} onValueChange={setSelectedSubmissionRefId} disabled={!selectedFormId || loadingSubmissions}>
              <SelectTrigger>
                <SelectValue placeholder={loadingSubmissions ? 'Loading...' : 'Choose a record'} />
              </SelectTrigger>
              <SelectContent>
                {submissions.map(s => (
                  <SelectItem key={s.id} value={s.submission_ref_id || s.id}>
                    {selectedPrefix ? `${selectedPrefix}:` : ''}{s.submission_ref_id || s.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tree visualization */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center gap-3 justify-center py-12">
            <Loader2 className="animate-spin h-5 w-5 text-primary" />
            <span className="text-muted-foreground">Building relationship map...</span>
          </div>
        ) : treeRoot ? (
          <div ref={treeContainerRef} className="inline-block min-w-full p-4">
            <HorizontalTreeView node={treeRoot} onNavigate={handleNavigate} />
          </div>
        ) : selectedFormId ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <GitBranch className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a record to view its relationship map</p>
            <p className="text-sm">Choose a submission ref ID above to visualize linked records</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <GitBranch className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a form to get started</p>
            <p className="text-sm">Choose a form from the dropdown above, then select a record</p>
          </div>
        )}
      </div>
    </div>
  );
}
