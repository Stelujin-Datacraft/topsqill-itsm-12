import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Shield, Settings, Trash2, Edit, ChevronRight, CheckCircle, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useComplianceFrameworks, useComplianceControls } from '@/hooks/useCompliance';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { FRAMEWORK_TYPES, IMPLEMENTATION_STATUSES, EFFECTIVENESS_LEVELS } from '@/types/compliance';
import { format } from 'date-fns';

const CompliancePage = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const { frameworks, isLoading, createFramework, updateFramework, deleteFramework } = useComplianceFrameworks();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editFw, setEditFw] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', framework_type: 'custom', version: '' });

  const filtered = frameworks.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.description?.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => setForm({ name: '', description: '', framework_type: 'custom', version: '' });

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">No Project Selected</h3>
          <p className="text-sm text-muted-foreground">Select a project to manage compliance.</p>
        </div>
      </div>
    );
  }

  if (selectedFramework) {
    return <FrameworkDetail frameworkId={selectedFramework} onBack={() => setSelectedFramework(null)} />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/knowledge-base')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compliance Frameworks</h1>
            <p className="text-sm text-muted-foreground">Manage compliance frameworks, controls, and mappings</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Framework
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search frameworks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Shield className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-2xl font-bold">{frameworks.length}</div>
              <div className="text-xs text-muted-foreground">Frameworks</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-600" /></div>
            <div>
              <div className="text-2xl font-bold">{frameworks.filter(f => f.status === 'active').length}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24" /></Card>)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No frameworks yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first compliance framework.</p>
            {isAdmin && (
              <Button onClick={() => { resetForm(); setShowCreate(true); }} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Add Framework
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(fw => (
            <Card key={fw.id} className="cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => setSelectedFramework(fw.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{fw.name}</h3>
                      <Badge variant="outline">{FRAMEWORK_TYPES.find(t => t.value === fw.framework_type)?.label || fw.framework_type}</Badge>
                    </div>
                    {fw.description && <p className="text-xs text-muted-foreground line-clamp-2">{fw.description}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => {
                        e.stopPropagation();
                        setEditFw(fw);
                        setForm({ name: fw.name, description: fw.description || '', framework_type: fw.framework_type, version: fw.version || '' });
                      }}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); setDeleteId(fw.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  {fw.version && <Badge variant="secondary" className="text-xs">v{fw.version}</Badge>}
                  <Badge variant={fw.status === 'active' ? 'default' : 'secondary'} className="text-xs">{fw.status}</Badge>
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editFw} onOpenChange={open => { if (!open) { setShowCreate(false); setEditFw(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editFw ? 'Edit Framework' : 'Add Compliance Framework'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., SOC 2 Type II" /></div>
            <div><Label>Type</Label>
              <Select value={form.framework_type} onValueChange={v => setForm(f => ({ ...f, framework_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FRAMEWORK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Version</Label><Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="e.g., 2023" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditFw(null); }}>Cancel</Button>
            <Button disabled={!form.name.trim()} onClick={() => {
              if (editFw) {
                updateFramework.mutate({ id: editFw.id, ...form });
              } else {
                createFramework.mutate(form);
              }
              setShowCreate(false); setEditFw(null); resetForm();
            }}>{editFw ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Framework</AlertDialogTitle>
            <AlertDialogDescription>This will delete the framework and all associated controls. Continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleteId) { deleteFramework.mutate(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Framework Detail with Controls
const FrameworkDetail = ({ frameworkId, onBack }: { frameworkId: string; onBack: () => void }) => {
  const { frameworks } = useComplianceFrameworks();
  const { controls, isLoading, createControl, updateControl, deleteControl } = useComplianceControls(frameworkId);
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const fw = frameworks.find(f => f.id === frameworkId);

  const [showCreate, setShowCreate] = useState(false);
  const [editCtrl, setEditCtrl] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({ control_id_ref: '', title: '', description: '', category: '', implementation_status: 'not_implemented', risk_level: 'medium' });

  const resetForm = () => setForm({ control_id_ref: '', title: '', description: '', category: '', implementation_status: 'not_implemented', risk_level: 'medium' });

  const filtered = controls.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.control_id_ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.implementation_status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Stats
  const implemented = controls.filter(c => c.implementation_status === 'implemented').length;
  const partial = controls.filter(c => c.implementation_status === 'partially_implemented').length;
  const progress = controls.length ? Math.round(((implemented + partial * 0.5) / controls.length) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{fw?.name || 'Framework'}</h1>
              <Badge variant="outline">{FRAMEWORK_TYPES.find(t => t.value === fw?.framework_type)?.label}</Badge>
            </div>
            {fw?.description && <p className="text-sm text-muted-foreground">{fw.description}</p>}
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Control
          </Button>
        )}
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Controls</div>
            <div className="text-2xl font-bold">{controls.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Implemented</div>
            <div className="text-2xl font-bold text-green-600">{implemented}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Not Implemented</div>
            <div className="text-2xl font-bold text-red-600">{controls.filter(c => c.implementation_status === 'not_implemented').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Coverage</div>
            <div className="text-2xl font-bold">{progress}%</div>
            <Progress value={progress} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search controls..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {IMPLEMENTATION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No controls yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Add controls to track compliance.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(ctrl => {
            const statusDef = IMPLEMENTATION_STATUSES.find(s => s.value === ctrl.implementation_status);
            const effDef = EFFECTIVENESS_LEVELS.find(e => e.value === ctrl.effectiveness);
            return (
              <Card key={ctrl.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{ctrl.control_id_ref}</span>
                        <h3 className="font-medium text-foreground">{ctrl.title}</h3>
                        <Badge className={statusDef?.color || ''}>{statusDef?.label}</Badge>
                        <Badge className={effDef?.color || ''} variant="outline">{effDef?.label}</Badge>
                        {ctrl.category && <Badge variant="secondary" className="text-xs">{ctrl.category}</Badge>}
                      </div>
                      {ctrl.description && <p className="text-sm text-muted-foreground line-clamp-1">{ctrl.description}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 ml-4">
                        <Select value={ctrl.implementation_status} onValueChange={v => updateControl.mutate({ id: ctrl.id, implementation_status: v })}>
                          <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{IMPLEMENTATION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditCtrl(ctrl);
                          setForm({ control_id_ref: ctrl.control_id_ref, title: ctrl.title, description: ctrl.description || '', category: ctrl.category || '', implementation_status: ctrl.implementation_status, risk_level: ctrl.risk_level });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(ctrl.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Control */}
      <Dialog open={showCreate || !!editCtrl} onOpenChange={open => { if (!open) { setShowCreate(false); setEditCtrl(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCtrl ? 'Edit Control' : 'Add Control'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Control ID *</Label><Input value={form.control_id_ref} onChange={e => setForm(f => ({ ...f, control_id_ref: e.target.value }))} placeholder="e.g., CC1.1" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g., Access Control" /></div>
            </div>
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Status</Label>
                <Select value={form.implementation_status} onValueChange={v => setForm(f => ({ ...f, implementation_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{IMPLEMENTATION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Risk Level</Label>
                <Select value={form.risk_level} onValueChange={v => setForm(f => ({ ...f, risk_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditCtrl(null); }}>Cancel</Button>
            <Button disabled={!form.control_id_ref.trim() || !form.title.trim()} onClick={() => {
              if (editCtrl) {
                updateControl.mutate({ id: editCtrl.id, ...form });
              } else {
                createControl.mutate(form);
              }
              setShowCreate(false); setEditCtrl(null); resetForm();
            }}>{editCtrl ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Control</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleteId) { deleteControl.mutate(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompliancePage;
