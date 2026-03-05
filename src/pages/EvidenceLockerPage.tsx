import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, FileBox, Trash2, Upload, ExternalLink, File, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useEvidence } from '@/hooks/useEvidence';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { EVIDENCE_TYPES } from '@/types/compliance';
import { format } from 'date-fns';

const EvidenceLockerPage = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const { evidence, isLoading, createEvidence, deleteEvidence } = useEvidence();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', evidence_type: 'document', file_url: '', collection_date: '', expiry_date: '' });

  const resetForm = () => setForm({ name: '', description: '', evidence_type: 'document', file_url: '', collection_date: '', expiry_date: '' });

  const filtered = evidence.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || e.evidence_type === typeFilter;
    return matchSearch && matchType;
  });

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <FileBox className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">No Project Selected</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/knowledge-base')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Evidence Locker</h1>
            <p className="text-sm text-muted-foreground">Centralized evidence storage for compliance and audit</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Evidence
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><FileBox className="h-5 w-5 text-primary" /></div>
          <div><div className="text-2xl font-bold">{evidence.length}</div><div className="text-xs text-muted-foreground">Total Evidence</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10"><File className="h-5 w-5 text-green-600" /></div>
          <div><div className="text-2xl font-bold">{evidence.filter(e => e.status === 'current').length}</div><div className="text-xs text-muted-foreground">Current</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10"><Calendar className="h-5 w-5 text-yellow-600" /></div>
          <div><div className="text-2xl font-bold">{evidence.filter(e => e.status === 'expired').length}</div><div className="text-xs text-muted-foreground">Expired</div></div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search evidence..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {EVIDENCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileBox className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No evidence yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Add evidence items to support compliance and audit activities.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const typeDef = EVIDENCE_TYPES.find(t => t.value === item.evidence_type);
            return (
              <Card key={item.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <File className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium text-sm">{item.name}</h3>
                      <Badge variant="outline" className="text-xs">{typeDef?.label}</Badge>
                      <Badge variant={item.status === 'current' ? 'default' : item.status === 'expired' ? 'destructive' : 'secondary'} className="text-xs">{item.status}</Badge>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-1 ml-6">{item.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {item.collection_date && <span className="text-xs text-muted-foreground">{format(new Date(item.collection_date), 'MMM d, yyyy')}</span>}
                    {item.file_url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(item.file_url!, '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={open => { if (!open) setShowCreate(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Evidence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., SOC 2 Report 2025" /></div>
            <div><Label>Type</Label>
              <Select value={form.evidence_type} onValueChange={v => setForm(f => ({ ...f, evidence_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVIDENCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>File URL</Label><Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Collection Date</Label><Input type="date" value={form.collection_date} onChange={e => setForm(f => ({ ...f, collection_date: e.target.value }))} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!form.name.trim()} onClick={() => {
              createEvidence.mutate({
                ...form,
                collection_date: form.collection_date || undefined,
                expiry_date: form.expiry_date || undefined,
                file_url: form.file_url || undefined,
              } as any);
              setShowCreate(false); resetForm();
            }}>Add Evidence</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Evidence</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleteId) { deleteEvidence.mutate(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EvidenceLockerPage;
