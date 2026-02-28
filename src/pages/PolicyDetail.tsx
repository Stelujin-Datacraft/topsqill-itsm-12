import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Save, Send, Archive, History, Link2, CheckCircle, Clock, FileText, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePolicies, usePolicyDetail } from '@/hooks/usePolicies';
import { useAuth } from '@/contexts/AuthContext';
import { POLICY_CATEGORIES, POLICY_STATUSES } from '@/types/policy';
import { format } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PolicyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { policies, updatePolicy, deletePolicy, createVersion, createTemplate } = usePolicies();
  const { versions, linkages, approvals, isLoading } = usePolicyDetail(id);
  
  const policy = policies.find(p => p.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [changeSummary, setChangeSummary] = useState('');

  if (!policy) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">Policy not found</h3>
          <Button variant="outline" onClick={() => navigate('/policies')}>Back to Policies</Button>
        </div>
      </div>
    );
  }

  const startEditing = () => {
    setEditForm({
      name: policy.name,
      description: policy.description || '',
      category: policy.category,
      department: policy.department || '',
      compliance_standard: policy.compliance_standard || '',
      compliance_reference: policy.compliance_reference || '',
    });
    setIsEditing(true);
  };

  const saveChanges = async () => {
    // Create version snapshot first
    await createVersion.mutateAsync({
      policy_id: policy.id,
      version_number: policy.current_version,
      name: policy.name,
      description: policy.description,
      category: policy.category,
      department: policy.department,
      content: policy.content,
      attachments: policy.attachments as any,
      change_summary: changeSummary || 'Manual update',
    });

    // Update policy
    await updatePolicy.mutateAsync({
      id: policy.id,
      ...editForm,
      current_version: policy.current_version + 1,
    });

    setIsEditing(false);
    setChangeSummary('');
  };

  const submitForApproval = async () => {
    await updatePolicy.mutateAsync({ id: policy.id, status: 'pending_approval' });
  };

  const publishPolicy = async () => {
    await updatePolicy.mutateAsync({
      id: policy.id,
      status: 'published',
      published_at: new Date().toISOString(),
    });
  };

  const retirePolicy = async () => {
    await updatePolicy.mutateAsync({
      id: policy.id,
      status: 'retired',
      retired_at: new Date().toISOString(),
    });
  };

  const handleDelete = async () => {
    await deletePolicy.mutateAsync(policy.id);
    navigate('/policies');
  };

  const saveAsTemplate = async () => {
    await createTemplate.mutateAsync({
      name: policy.name,
      description: policy.description,
      category: policy.category,
      content_structure: policy.content,
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(policy.name, 14, 22);
    doc.setFontSize(10);
    doc.text(`Status: ${policy.status} | Category: ${policy.category} | Version: ${policy.current_version}`, 14, 32);
    doc.text(`Last Updated: ${format(new Date(policy.updated_at), 'PPpp')}`, 14, 38);
    
    if (policy.description) {
      doc.setFontSize(12);
      doc.text('Description', 14, 50);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(policy.description, 180);
      doc.text(lines, 14, 58);
    }

    if (versions.length > 0) {
      const tableData = versions.map(v => [
        `v${v.version_number}`,
        v.change_summary || '—',
        format(new Date(v.changed_at), 'MMM d, yyyy'),
      ]);
      autoTable(doc, {
        head: [['Version', 'Change Summary', 'Date']],
        body: tableData,
        startY: 80,
      });
    }

    doc.save(`${policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${policy.current_version}.pdf`);
    toast.success('PDF exported');
  };

  const statusDef = POLICY_STATUSES.find(s => s.value === policy.status);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/policies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{policy.name}</h1>
              <Badge className={statusDef?.color}>{statusDef?.label}</Badge>
              <Badge variant="outline">{policy.category}</Badge>
              <Badge variant="secondary">v{policy.current_version}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {policy.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={saveAsTemplate}>
            <Save className="h-4 w-4 mr-1" /> Save as Template
          </Button>
          {policy.status === 'draft' && (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button size="sm" onClick={submitForApproval}>
                <Send className="h-4 w-4 mr-1" /> Submit for Approval
              </Button>
            </>
          )}
          {policy.status === 'pending_approval' && (
            <Button size="sm" onClick={publishPolicy}>
              <CheckCircle className="h-4 w-4 mr-1" /> Publish
            </Button>
          )}
          {policy.status === 'published' && (
            <Button variant="outline" size="sm" onClick={retirePolicy}>
              <Archive className="h-4 w-4 mr-1" /> Retire
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Policy</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this policy and all its versions. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-sm">Edit Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input value={editForm.name} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={e => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={v => setEditForm((p: any) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{POLICY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input value={editForm.department} onChange={e => setEditForm((p: any) => ({ ...p, department: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Change Summary</Label>
                <Input value={changeSummary} onChange={e => setChangeSummary(e.target.value)} placeholder="What changed?" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={saveChanges} disabled={updatePolicy.isPending}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions" className="gap-1">
            <History className="h-3.5 w-3.5" />
            Versions ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            Approvals ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="linkages" className="gap-1">
            <Link2 className="h-3.5 w-3.5" />
            Linkages ({linkages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{policy.category}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{policy.department || '—'}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Compliance Standard</span><span>{policy.compliance_standard || '—'}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span>{policy.compliance_reference || '—'}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Owner Type</span><span className="capitalize">{policy.owner_type}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>v{policy.current_version}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(new Date(policy.created_at), 'PPpp')}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Last Updated</span><span>{format(new Date(policy.updated_at), 'PPpp')}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Published</span><span>{policy.published_at ? format(new Date(policy.published_at), 'PPpp') : '—'}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Retired</span><span>{policy.retired_at ? format(new Date(policy.retired_at), 'PPpp') : '—'}</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Attachments</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {(!policy.attachments || policy.attachments.length === 0) ? (
                <p className="text-sm text-muted-foreground">No attachments</p>
              ) : (
                <div className="space-y-2">
                  {policy.attachments.map((att: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{att.name}</span>
                      {att.url && (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                          Open
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No version history yet</p>
              ) : (
                <div className="space-y-3">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-start gap-3 p-3 rounded-md border">
                      <div className="mt-0.5">
                        <Badge variant="outline">v{v.version_number}</Badge>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{v.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {v.change_summary || 'No change summary'}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(v.changed_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No approval history</p>
              ) : (
                <div className="space-y-3">
                  {approvals.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-md border">
                      <div className="mt-0.5">
                        {a.status === 'approved' && <CheckCircle className="h-5 w-5 text-primary" />}
                        {a.status === 'pending' && <Clock className="h-5 w-5 text-muted-foreground" />}
                        {a.status === 'rejected' && <AlertCircleIcon className="h-5 w-5 text-destructive" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm capitalize font-medium">{a.status}</div>
                        {a.comments && <div className="text-xs text-muted-foreground">{a.comments}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(a.created_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linkages" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {linkages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No linked modules</p>
              ) : (
                <div className="space-y-3">
                  {linkages.map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-3 rounded-md border">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <Badge variant="outline" className="capitalize">{l.linked_entity_type}</Badge>
                        {l.link_description && <span className="text-sm ml-2">{l.link_description}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(l.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Simple alert circle for rejected state
const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default PolicyDetail;
