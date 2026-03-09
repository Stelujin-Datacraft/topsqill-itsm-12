import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search, FileText, Shield, BarChart3, LayoutTemplate, CalendarClock, FolderOpen, Users, Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePolicies } from '@/hooks/usePolicies';
import { useKnowledgeBaseFolders } from '@/hooks/useKnowledgeBaseFolders';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKnowledgeBasePermission } from '@/hooks/useKnowledgeBasePermission';
import { POLICY_CATEGORIES, POLICY_STATUSES, POLICY_PRIORITIES } from '@/types/policy';
import { PolicyDashboard } from '@/components/policies/PolicyDashboard';
import { format, isPast } from 'date-fns';
import { FolderAccessControls } from '@/components/policies/FolderAccessControls';
import { PolicyBulkActions } from '@/components/policies/PolicyBulkActions';
import { Checkbox } from '@/components/ui/checkbox';

// Reuse templates tab from original Policies page
import type { PolicyTemplate } from '@/types/policy';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { Trash2, Eye, Edit } from 'lucide-react';

const KnowledgeBaseFolder = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const { canEdit, canAdmin } = useKnowledgeBasePermission(folderId === 'unassigned' ? null : folderId);
  const isAdmin = canAdmin;
  const { policies, isLoading, templates, templatesLoading, deleteTemplate, updateTemplate, clonePolicy, bulkUpdateStatus, bulkDelete } = usePolicies();
  const { folders } = useKnowledgeBaseFolders();

  const isUnassigned = folderId === 'unassigned';
  const folder = isUnassigned ? null : folders.find(f => f.id === folderId);
  const folderName = isUnassigned ? 'Unassigned Items' : folder?.name || 'Folder';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('list');

  // Template state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewTemplate, setViewTemplate] = useState<PolicyTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<PolicyTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editContentHtml, setEditContentHtml] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const folderPolicies = useMemo(() => {
    return policies.filter((p: any) => {
      const matchFolder = isUnassigned ? !p.folder_id : p.folder_id === folderId;
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.policy_number?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchType = typeFilter === 'all' || (p as any).item_type === typeFilter;
      return matchFolder && matchSearch && matchStatus && matchCategory && matchType;
    });
  }, [policies, folderId, isUnassigned, search, statusFilter, categoryFilter, typeFilter]);

  const getStatusBadge = (status: string) => {
    const s = POLICY_STATUSES.find(st => st.value === status);
    return <Badge className={s?.color || ''}>{s?.label || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const p = POLICY_PRIORITIES.find(pr => pr.value === priority);
    return <Badge className={p?.color || ''} variant="outline">{p?.label || priority}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/knowledge-base')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">{folderName}</h1>
            </div>
            {folder?.description && (
              <p className="text-sm text-muted-foreground ml-7">{folder.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/policies/create-template')} className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Create Template
            </Button>
            <Button onClick={() => navigate(`/policies/create?folder=${folderId}&type=policy`)} className="gap-2">
              <FileText className="h-4 w-4" />
              Create Policy
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <FileText className="h-4 w-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          {/* Access Controls moved to Roles and Access page */}
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Bulk Actions */}
          <PolicyBulkActions
            policies={folderPolicies}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onBulkPublish={async (ids) => { await bulkUpdateStatus.mutateAsync({ ids, status: 'published', extra: { published_at: new Date().toISOString() } }); }}
            onBulkRetire={async (ids) => { await bulkUpdateStatus.mutateAsync({ ids, status: 'retired', extra: { retired_at: new Date().toISOString() } }); }}
            onBulkDelete={async (ids) => { await bulkDelete.mutateAsync(ids); }}
            onClone={async (id) => { await clonePolicy.mutateAsync(id); }}
          />
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, description, or policy number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="policy">Policy</SelectItem>
                <SelectItem value="audit">Audit</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {POLICY_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {POLICY_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
              ))}
            </div>
          ) : folderPolicies.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium">No items found</h3>
                <p className="text-sm text-muted-foreground mt-1">Create a Policy or Audit to get started.</p>
                {isAdmin && !isUnassigned && (
                  <div className="flex gap-2 mt-4">
                    <Button onClick={() => navigate(`/policies/create?folder=${folderId}&type=policy`)} className="gap-2">
                      <FileText className="h-4 w-4" /> Create Policy
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {folderPolicies.map((policy: any) => {
                const isOverdueReview = policy.next_review_date && isPast(new Date(policy.next_review_date));
                const itemType = policy.item_type || 'policy';
                return (
                  <Card
                    key={policy.id}
                    className={`cursor-pointer hover:border-primary/50 transition-colors ${isOverdueReview ? 'border-destructive/30' : ''}`}
                    onClick={() => navigate(`/policy/${policy.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Checkbox
                            checked={selectedIds.includes(policy.id)}
                            onCheckedChange={(checked) => {
                              setSelectedIds(prev => checked ? [...prev, policy.id] : prev.filter(id => id !== policy.id));
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={itemType === 'audit' ? 'default' : 'secondary'} className="text-xs">
                              {itemType === 'audit' ? <Shield className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                              {itemType === 'audit' ? 'Audit' : 'Policy'}
                            </Badge>
                            {policy.policy_number && (
                              <span className="text-xs font-mono text-muted-foreground">{policy.policy_number}</span>
                            )}
                            <h3 className="font-medium text-foreground truncate">{policy.name}</h3>
                            {getStatusBadge(policy.status)}
                            <Badge variant="outline">{policy.category}</Badge>
                            {getPriorityBadge(policy.priority || 'medium')}
                            {isOverdueReview && (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <CalendarClock className="h-3 w-3" /> Review Overdue
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {policy.description || 'No description'}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground ml-4 shrink-0 space-y-0.5">
                          <div>v{policy.current_version}</div>
                          <div>{format(new Date(policy.updated_at), 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {templatesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium">No templates yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Create your first policy template.</p>
                <Button onClick={() => navigate('/policies/create-template')} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" /> Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <Card key={t.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-medium text-foreground">{t.name}</h3>
                        <Badge variant="outline">{t.category}</Badge>
                        {t.is_system_template && <Badge variant="secondary" className="text-xs">System</Badge>}
                      </div>
                      {t.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{t.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewTemplate(t)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditTemplate(t); setEditName(t.name); setEditDescription(t.description || ''); setEditCategory(t.category); setEditContentHtml(t.content_structure?.html || ''); }} disabled={t.is_system_template}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmId(t.id)} disabled={t.is_system_template}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <PolicyDashboard policies={folderPolicies} />
        </TabsContent>

        {/* Access Controls moved to Roles and Access page */}
      </Tabs>

      {/* Template dialogs - same as original Policies page */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteConfirmId) { deleteTemplate.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewTemplate} onOpenChange={open => !open && setViewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{viewTemplate?.name}<Badge variant="outline">{viewTemplate?.category}</Badge></DialogTitle>
          </DialogHeader>
          {viewTemplate?.description && <p className="text-sm text-muted-foreground">{viewTemplate.description}</p>}
          <ScrollArea className="max-h-[400px] border rounded-md p-4">
            {viewTemplate?.content_structure?.html ? (
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: viewTemplate.content_structure.html }} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No content in this template.</p>
            )}
          </ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setViewTemplate(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTemplate} onOpenChange={open => !open && setEditTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Template Name *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} /></div>
            <div>
              <Label>Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{POLICY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <TiptapEditor content={editContentHtml} onChange={setEditContentHtml} placeholder="Template content..." className="min-h-[200px] mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Cancel</Button>
            <Button disabled={!editName.trim() || updateTemplate.isPending} onClick={() => { if (editTemplate) { updateTemplate.mutate({ id: editTemplate.id, name: editName, description: editDescription || undefined, category: editCategory, content_structure: editContentHtml ? { html: editContentHtml } : {} } as any); setEditTemplate(null); } }}>{updateTemplate.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBaseFolder;
