import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Search, FileText, Trash2, Edit, BookOpen, Shield, ClipboardList, FileBox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useKnowledgeBaseFolders } from '@/hooks/useKnowledgeBaseFolders';
import { usePolicies } from '@/hooks/usePolicies';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

const KnowledgeBase = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const { folders, isLoading, createFolder, updateFolder, deleteFolder } = useKnowledgeBaseFolders();
  const { policies } = usePolicies();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editFolder, setEditFolder] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = folders.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Search across all policies/audits
  const matchingPolicies = search.trim()
    ? policies.filter((p: any) =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.policy_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase()) ||
        p.department?.toLowerCase().includes(search.toLowerCase()) ||
        p.compliance_standard?.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // Count items per folder
  const getItemCount = (folderId: string) => {
    return policies.filter((p: any) => p.folder_id === folderId).length;
  };

  // Orphaned policies (no folder)
  const orphanedCount = policies.filter((p: any) => !p.folder_id).length;

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">No Project Selected</h3>
          <p className="text-sm text-muted-foreground">Select a project to manage your Knowledge Base.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Organize policies, audits, and governance documents</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Folder
          </Button>
        )}
      </div>

      {/* Quick Access Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/compliance')}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10"><Shield className="h-6 w-6 text-blue-600" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Compliance Frameworks</h3>
              <p className="text-xs text-muted-foreground">SOC 2, ISO 27001, NIST, custom frameworks & controls</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/audit-programs')}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-orange-500/10"><ClipboardList className="h-6 w-6 text-orange-600" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Audit Programs</h3>
              <p className="text-xs text-muted-foreground">Plan audits, track findings & remediation tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/evidence-locker')}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10"><FileBox className="h-6 w-6 text-green-600" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Evidence Locker</h3>
              <p className="text-xs text-muted-foreground">Centralized evidence for compliance & audit trails</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search folders, policies, audits..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* KB-wide search results */}
      {matchingPolicies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {matchingPolicies.length} matching item{matchingPolicies.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-1">
            {matchingPolicies.map((p: any) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/policy/${p.id}`)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        {p.policy_number && <span className="text-xs font-mono text-muted-foreground">{p.policy_number}</span>}
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="outline" className="text-[10px]">{p.item_type || 'policy'}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{p.category}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 && orphanedCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No folders yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first Knowledge Base folder to organize policies and audits.</p>
            {isAdmin && (
              <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Create Folder
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(folder => {
            const count = getItemCount(folder.id);
            return (
              <Card
                key={folder.id}
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => navigate(`/knowledge-base/${folder.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{folder.name}</h3>
                        {folder.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{folder.description}</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={e => { e.stopPropagation(); setEditFolder(folder); setNewName(folder.name); setNewDesc(folder.description || ''); }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={e => { e.stopPropagation(); setDeleteId(folder.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{count} item{count !== 1 ? 's' : ''}</Badge>
                    <span>Created {format(new Date(folder.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Orphaned policies card */}
          {orphanedCount > 0 && (
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors border-dashed"
              onClick={() => navigate('/knowledge-base/unassigned')}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Unassigned Items</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Policies & audits not in any folder</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Badge variant="outline" className="text-xs">{orphanedCount} item{orphanedCount !== 1 ? 's' : ''}</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Knowledge Base Folder</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Folder Name *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., IT Policies" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!newName.trim() || createFolder.isPending}
              onClick={() => {
                createFolder.mutate({ name: newName, description: newDesc || undefined });
                setShowCreate(false);
                setNewName('');
                setNewDesc('');
              }}
            >
              {createFolder.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={!!editFolder} onOpenChange={open => !open && setEditFolder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Folder</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Folder Name *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolder(null)}>Cancel</Button>
            <Button
              disabled={!newName.trim() || updateFolder.isPending}
              onClick={() => {
                if (editFolder) {
                  updateFolder.mutate({ id: editFolder.id, name: newName, description: newDesc || undefined });
                  setEditFolder(null);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the folder. Policies inside will become unassigned. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { deleteFolder.mutate(deleteId); setDeleteId(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default KnowledgeBase;
