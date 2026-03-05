import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ClipboardList, Trash2, Edit, ChevronRight, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuditPrograms, useAuditFindings, useRemediationTasks } from '@/hooks/useAuditPrograms';
import { useComplianceFrameworks } from '@/hooks/useCompliance';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { AUDIT_TYPES, AUDIT_STATUSES, FINDING_TYPES, FINDING_SEVERITIES, FINDING_STATUSES } from '@/types/compliance';
import { format } from 'date-fns';

const AuditPage = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const { audits, isLoading, createAudit, updateAudit, deleteAudit } = useAuditPrograms();
  const { frameworks } = useComplianceFrameworks();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', audit_type: 'internal', scope: '', objectives: '', framework_id: '', start_date: '', end_date: '' });

  const resetForm = () => setForm({ name: '', description: '', audit_type: 'internal', scope: '', objectives: '', framework_id: '', start_date: '', end_date: '' });

  const filtered = audits.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">No Project Selected</h3>
        </div>
      </div>
    );
  }

  if (selectedAudit) {
    return <AuditDetail auditId={selectedAudit} onBack={() => setSelectedAudit(null)} />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/knowledge-base')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Programs</h1>
            <p className="text-sm text-muted-foreground">Plan, execute, and track audits with findings and remediation</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Create Audit
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><ClipboardList className="h-5 w-5 text-primary" /></div>
          <div><div className="text-2xl font-bold">{audits.length}</div><div className="text-xs text-muted-foreground">Total Audits</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10"><Clock className="h-5 w-5 text-blue-600" /></div>
          <div><div className="text-2xl font-bold">{audits.filter(a => a.status === 'in_progress').length}</div><div className="text-xs text-muted-foreground">In Progress</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-600" /></div>
          <div><div className="text-2xl font-bold">{audits.filter(a => a.status === 'completed').length}</div><div className="text-xs text-muted-foreground">Completed</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
          <div><div className="text-2xl font-bold">{audits.filter(a => a.status === 'planned').length}</div><div className="text-xs text-muted-foreground">Planned</div></div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search audits..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {AUDIT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No audits yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first audit program.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(audit => {
            const statusDef = AUDIT_STATUSES.find(s => s.value === audit.status);
            const typeDef = AUDIT_TYPES.find(t => t.value === audit.audit_type);
            return (
              <Card key={audit.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedAudit(audit.id)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium text-foreground">{audit.name}</h3>
                      <Badge className={statusDef?.color || ''}>{statusDef?.label}</Badge>
                      <Badge variant="outline">{typeDef?.label}</Badge>
                    </div>
                    {audit.description && <p className="text-sm text-muted-foreground line-clamp-1">{audit.description}</p>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground ml-4 shrink-0 space-y-0.5">
                    {audit.start_date && <div>Start: {format(new Date(audit.start_date), 'MMM d, yyyy')}</div>}
                    {audit.end_date && <div>End: {format(new Date(audit.end_date), 'MMM d, yyyy')}</div>}
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Audit Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) setShowCreate(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Audit Program</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Q1 2026 Internal Audit" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label>
                <Select value={form.audit_type} onValueChange={v => setForm(f => ({ ...f, audit_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AUDIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Framework (optional)</Label>
                <Select value={form.framework_id} onValueChange={v => setForm(f => ({ ...f, framework_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {frameworks.map(fw => <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>Scope</Label><Textarea value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} rows={2} placeholder="What areas/processes will be audited?" /></div>
            <div><Label>Objectives</Label><Textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!form.name.trim()} onClick={() => {
              createAudit.mutate({
                ...form,
                framework_id: form.framework_id || undefined,
                start_date: form.start_date || undefined,
                end_date: form.end_date || undefined,
              } as any);
              setShowCreate(false); resetForm();
            }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Audit</AlertDialogTitle><AlertDialogDescription>This will delete the audit and all findings. Continue?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleteId) { deleteAudit.mutate(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Audit Detail: Findings, Remediation
const AuditDetail = ({ auditId, onBack }: { auditId: string; onBack: () => void }) => {
  const { audits, updateAudit } = useAuditPrograms();
  const { findings, isLoading, createFinding, updateFinding, deleteFinding } = useAuditFindings(auditId);
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const audit = audits.find(a => a.id === auditId);

  const [showCreate, setShowCreate] = useState(false);
  const [editFinding, setEditFinding] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [tab, setTab] = useState('findings');
  const [form, setForm] = useState({ title: '', description: '', finding_type: 'observation', severity: 'medium', recommendation: '', root_cause: '', due_date: '' });

  const resetForm = () => setForm({ title: '', description: '', finding_type: 'observation', severity: 'medium', recommendation: '', root_cause: '', due_date: '' });

  const statusDef = AUDIT_STATUSES.find(s => s.value === audit?.status);

  if (selectedFinding) {
    return <FindingDetail findingId={selectedFinding} auditId={auditId} onBack={() => setSelectedFinding(null)} />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{audit?.name}</h1>
              <Badge className={statusDef?.color || ''}>{statusDef?.label}</Badge>
            </div>
            {audit?.description && <p className="text-sm text-muted-foreground">{audit.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && audit?.status === 'planned' && (
            <Button variant="outline" onClick={() => updateAudit.mutate({ id: auditId, status: 'in_progress' })}>Start Audit</Button>
          )}
          {isAdmin && audit?.status === 'in_progress' && (
            <Button variant="outline" onClick={() => updateAudit.mutate({ id: auditId, status: 'completed' })}>Complete Audit</Button>
          )}
          {isAdmin && (
            <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Add Finding
            </Button>
          )}
        </div>
      </div>

      {/* Audit info */}
      {(audit?.scope || audit?.objectives) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audit?.scope && <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1 font-medium">Scope</div><p className="text-sm">{audit.scope}</p></CardContent></Card>}
          {audit?.objectives && <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1 font-medium">Objectives</div><p className="text-sm">{audit.objectives}</p></CardContent></Card>}
        </div>
      )}

      {/* Findings stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{findings.length}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-600">{findings.filter(f => f.status === 'open').length}</div><div className="text-xs text-muted-foreground">Open</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-blue-600">{findings.filter(f => f.status === 'in_progress').length}</div><div className="text-xs text-muted-foreground">In Progress</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-green-600">{findings.filter(f => f.status === 'closed').length}</div><div className="text-xs text-muted-foreground">Closed</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-orange-600">{findings.filter(f => f.severity === 'critical' || f.severity === 'high').length}</div><div className="text-xs text-muted-foreground">High/Critical</div></CardContent></Card>
      </div>

      {/* Findings list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : findings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No findings yet</h3>
            <p className="text-sm text-muted-foreground">Add findings as you conduct the audit.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {findings.map(finding => {
            const sevDef = FINDING_SEVERITIES.find(s => s.value === finding.severity);
            const stDef = FINDING_STATUSES.find(s => s.value === finding.status);
            const typeDef = FINDING_TYPES.find(t => t.value === finding.finding_type);
            return (
              <Card key={finding.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedFinding(finding.id)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {finding.finding_ref && <span className="font-mono text-xs text-muted-foreground">{finding.finding_ref}</span>}
                      <h3 className="font-medium text-foreground">{finding.title}</h3>
                      <Badge className={stDef?.color || ''}>{stDef?.label}</Badge>
                      <Badge className={sevDef?.color || ''} variant="outline">{sevDef?.label}</Badge>
                      <Badge variant="secondary" className="text-xs">{typeDef?.label}</Badge>
                    </div>
                    {finding.description && <p className="text-sm text-muted-foreground line-clamp-1">{finding.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {isAdmin && (
                      <Select value={finding.status} onValueChange={v => updateFinding.mutate({ id: finding.id, status: v, ...(v === 'closed' ? { closed_at: new Date().toISOString() } : {}) })}>
                        <SelectTrigger className="w-[140px] h-8 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                        <SelectContent>{FINDING_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Finding */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) setShowCreate(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Finding</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label>
                <Select value={form.finding_type} onValueChange={v => setForm(f => ({ ...f, finding_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FINDING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FINDING_SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Root Cause</Label><Textarea value={form.root_cause} onChange={e => setForm(f => ({ ...f, root_cause: e.target.value }))} rows={2} /></div>
            <div><Label>Recommendation</Label><Textarea value={form.recommendation} onChange={e => setForm(f => ({ ...f, recommendation: e.target.value }))} rows={2} /></div>
            <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!form.title.trim()} onClick={() => {
              createFinding.mutate({ ...form, due_date: form.due_date || undefined } as any);
              setShowCreate(false); resetForm();
            }}>Add Finding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Finding Detail with Remediation Tasks
const FindingDetail = ({ findingId, auditId, onBack }: { findingId: string; auditId: string; onBack: () => void }) => {
  const { findings, updateFinding } = useAuditFindings(auditId);
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useRemediationTasks(findingId);
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const finding = findings.find(f => f.id === findingId);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });

  if (!finding) return null;

  const sevDef = FINDING_SEVERITIES.find(s => s.value === finding.severity);
  const stDef = FINDING_STATUSES.find(s => s.value === finding.status);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              {finding.finding_ref && <span className="font-mono text-sm text-muted-foreground">{finding.finding_ref}</span>}
              <h1 className="text-xl font-bold text-foreground">{finding.title}</h1>
              <Badge className={stDef?.color || ''}>{stDef?.label}</Badge>
              <Badge className={sevDef?.color || ''} variant="outline">{sevDef?.label}</Badge>
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm({ title: '', description: '', priority: 'medium', due_date: '' }); setShowCreate(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Remediation Task
          </Button>
        )}
      </div>

      {/* Finding details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {finding.description && <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1 font-medium">Description</div><p className="text-sm">{finding.description}</p></CardContent></Card>}
        {finding.root_cause && <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1 font-medium">Root Cause</div><p className="text-sm">{finding.root_cause}</p></CardContent></Card>}
        {finding.recommendation && <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1 font-medium">Recommendation</div><p className="text-sm">{finding.recommendation}</p></CardContent></Card>}
        {finding.management_response && <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1 font-medium">Management Response</div><p className="text-sm">{finding.management_response}</p></CardContent></Card>}
      </div>

      {/* Management Response (editable) */}
      {isAdmin && !finding.management_response && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-xs">Management Response</Label>
            <div className="flex gap-2 mt-1">
              <Textarea id="mgmt-response" placeholder="Enter management response..." rows={2} className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => {
                const val = (document.getElementById('mgmt-response') as HTMLTextAreaElement)?.value;
                if (val) updateFinding.mutate({ id: findingId, management_response: val });
              }}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remediation Tasks */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Remediation Tasks</h2>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-14" /></Card>)}</div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No remediation tasks yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <Card key={task.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-sm">{task.title}</h3>
                      <Badge variant={task.status === 'completed' ? 'default' : task.status === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">{task.status}</Badge>
                      <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 ml-4">
                      <Select value={task.status} onValueChange={v => updateTask.mutate({ id: task.id, status: v, ...(v === 'completed' ? { completed_at: new Date().toISOString() } : {}) })}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTask.mutate(task.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) setShowCreate(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Remediation Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!form.title.trim()} onClick={() => {
              createTask.mutate({ ...form, due_date: form.due_date || undefined } as any);
              setShowCreate(false);
            }}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditPage;
