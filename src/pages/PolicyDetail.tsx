import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Save, Send, Archive, History, Link2, CheckCircle, Clock, FileText, Download, Plus, UserCheck, AlertOctagon, CalendarClock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePolicies, usePolicyDetail } from '@/hooks/usePolicies';
import { useAuth } from '@/contexts/AuthContext';
import { POLICY_CATEGORIES, POLICY_STATUSES, POLICY_PRIORITIES, REVIEW_CYCLE_OPTIONS } from '@/types/policy';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PolicyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { policies, updatePolicy, deletePolicy, createVersion, createTemplate } = usePolicies();
  const { versions, linkages, approvals, acknowledgments, exceptions, reviewCycles, isLoading, acknowledgePolicy, requestException, createLinkage } = usePolicyDetail(id);
  
  const policy = policies.find(p => p.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [changeSummary, setChangeSummary] = useState('');
  const [showAckDialog, setShowAckDialog] = useState(false);
  const [ackComment, setAckComment] = useState('');
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({ reason: '', justification: '', risk_assessment: '', compensating_controls: '', start_date: '', end_date: '' });
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkForm, setLinkForm] = useState({ linked_entity_type: 'form' as const, linked_entity_id: '', link_description: '' });

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
      priority: policy.priority || 'medium',
      effective_date: policy.effective_date || '',
      expiry_date: policy.expiry_date || '',
      review_cycle_days: policy.review_cycle_days || 365,
      acknowledgment_required: policy.acknowledgment_required || false,
      exception_allowed: policy.exception_allowed !== false,
    });
    setIsEditing(true);
  };

  const saveChanges = async () => {
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

    let next_review_date: string | undefined;
    if (editForm.effective_date && editForm.review_cycle_days) {
      const d = new Date(editForm.effective_date);
      d.setDate(d.getDate() + editForm.review_cycle_days);
      next_review_date = d.toISOString().split('T')[0];
    }

    await updatePolicy.mutateAsync({
      id: policy.id,
      ...editForm,
      next_review_date,
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

  const handleAcknowledge = async () => {
    await acknowledgePolicy.mutateAsync({
      policyId: policy.id,
      versionNumber: policy.current_version,
      comments: ackComment || undefined,
    });
    setShowAckDialog(false);
    setAckComment('');
  };

  const handleRequestException = async () => {
    if (!exceptionForm.reason || !exceptionForm.start_date || !exceptionForm.end_date) return;
    await requestException.mutateAsync({
      policy_id: policy.id,
      ...exceptionForm,
    });
    setShowExceptionDialog(false);
    setExceptionForm({ reason: '', justification: '', risk_assessment: '', compensating_controls: '', start_date: '', end_date: '' });
  };

  const handleCreateLinkage = async () => {
    if (!linkForm.linked_entity_id) return;
    await createLinkage.mutateAsync({
      policy_id: policy.id,
      ...linkForm,
    });
    setShowLinkDialog(false);
    setLinkForm({ linked_entity_type: 'form', linked_entity_id: '', link_description: '' });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(policy.name, 14, 22);
    doc.setFontSize(10);
    doc.text(`${policy.policy_number || ''} | Status: ${policy.status} | Category: ${policy.category} | Priority: ${policy.priority || 'medium'} | Version: ${policy.current_version}`, 14, 32);
    doc.text(`Last Updated: ${format(new Date(policy.updated_at), 'PPpp')}`, 14, 38);
    if (policy.effective_date) doc.text(`Effective: ${policy.effective_date}`, 14, 44);
    if (policy.compliance_standard) doc.text(`Compliance: ${policy.compliance_standard} ${policy.compliance_reference || ''}`, 14, 50);
    
    if (policy.description) {
      doc.setFontSize(12);
      doc.text('Description', 14, 62);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(policy.description, 180);
      doc.text(lines, 14, 70);
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
        startY: 90,
      });
    }

    doc.save(`${policy.policy_number || policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${policy.current_version}.pdf`);
    toast.success('PDF exported');
  };

  const statusDef = POLICY_STATUSES.find(s => s.value === policy.status);
  const priorityDef = POLICY_PRIORITIES.find(p => p.value === (policy.priority || 'medium'));
  const isOverdueReview = policy.next_review_date && isPast(new Date(policy.next_review_date));
  const userHasAcked = acknowledgments.some(a => a.user_id === user?.id && a.version_acknowledged === policy.current_version);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/policies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {policy.policy_number && (
                <span className="text-sm font-mono text-muted-foreground">{policy.policy_number}</span>
              )}
              <h1 className="text-xl font-bold text-foreground">{policy.name}</h1>
              <Badge className={statusDef?.color}>{statusDef?.label}</Badge>
              <Badge variant="outline">{policy.category}</Badge>
              <Badge className={priorityDef?.color}>{priorityDef?.label}</Badge>
              <Badge variant="secondary">v{policy.current_version}</Badge>
              {isOverdueReview && (
                <Badge variant="destructive" className="gap-1">
                  <CalendarClock className="h-3 w-3" /> Review Overdue
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {policy.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={saveAsTemplate}>
            <Save className="h-4 w-4 mr-1" /> Save as Template
          </Button>
          {policy.acknowledgment_required && policy.status === 'published' && !userHasAcked && (
            <Button size="sm" variant="outline" onClick={() => setShowAckDialog(true)} className="border-blue-300 text-blue-700 dark:text-blue-300">
              <UserCheck className="h-4 w-4 mr-1" /> Acknowledge
            </Button>
          )}
          {policy.exception_allowed && policy.status === 'published' && (
            <Button size="sm" variant="outline" onClick={() => setShowExceptionDialog(true)}>
              <AlertOctagon className="h-4 w-4 mr-1" /> Request Exception
            </Button>
          )}
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
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={v => setEditForm((p: any) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{POLICY_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input value={editForm.department} onChange={e => setEditForm((p: any) => ({ ...p, department: e.target.value }))} />
              </div>
              <div>
                <Label>Compliance Standard</Label>
                <Input value={editForm.compliance_standard} onChange={e => setEditForm((p: any) => ({ ...p, compliance_standard: e.target.value }))} />
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input type="date" value={editForm.effective_date} onChange={e => setEditForm((p: any) => ({ ...p, effective_date: e.target.value }))} />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={editForm.expiry_date} onChange={e => setEditForm((p: any) => ({ ...p, expiry_date: e.target.value }))} />
              </div>
              <div>
                <Label>Review Cycle</Label>
                <Select value={String(editForm.review_cycle_days)} onValueChange={v => setEditForm((p: any) => ({ ...p, review_cycle_days: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REVIEW_CYCLE_OPTIONS.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.acknowledgment_required} onCheckedChange={v => setEditForm((p: any) => ({ ...p, acknowledgment_required: v }))} />
                  <Label className="text-sm">Require ACK</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.exception_allowed} onCheckedChange={v => setEditForm((p: any) => ({ ...p, exception_allowed: v }))} />
                  <Label className="text-sm">Allow Exceptions</Label>
                </div>
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions" className="gap-1">
            <History className="h-3.5 w-3.5" /> Versions ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Approvals ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledgments" className="gap-1">
            <UserCheck className="h-3.5 w-3.5" /> Acknowledgments ({acknowledgments.length})
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="gap-1">
            <AlertOctagon className="h-3.5 w-3.5" /> Exceptions ({exceptions.length})
          </TabsTrigger>
          <TabsTrigger value="linkages" className="gap-1">
            <Link2 className="h-3.5 w-3.5" /> Linkages ({linkages.length})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <DetailRow label="Policy Number" value={policy.policy_number || '—'} />
                <DetailRow label="Category" value={policy.category} />
                <DetailRow label="Department" value={policy.department || '—'} />
                <DetailRow label="Priority" value={<Badge className={priorityDef?.color}>{priorityDef?.label}</Badge>} />
                <DetailRow label="Owner Type" value={<span className="capitalize">{policy.owner_type}</span>} />
                <DetailRow label="Version" value={`v${policy.current_version}`} />
                <DetailRow label="Acknowledgment Required" value={policy.acknowledgment_required ? 'Yes' : 'No'} />
                <DetailRow label="Exceptions Allowed" value={policy.exception_allowed !== false ? 'Yes' : 'No'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Compliance & Dates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <DetailRow label="Compliance Standard" value={policy.compliance_standard || '—'} />
                <DetailRow label="Reference" value={policy.compliance_reference || '—'} />
                <DetailRow label="Effective Date" value={policy.effective_date || '—'} />
                <DetailRow label="Expiry Date" value={policy.expiry_date || '—'} />
                <DetailRow label="Review Cycle" value={REVIEW_CYCLE_OPTIONS.find(o => o.value === policy.review_cycle_days)?.label || `${policy.review_cycle_days || 365} days`} />
                <DetailRow label="Next Review" value={
                  policy.next_review_date ? (
                    <span className={isOverdueReview ? 'text-destructive font-medium' : ''}>
                      {policy.next_review_date} {isOverdueReview && '(Overdue)'}
                    </span>
                  ) : '—'
                } />
                <DetailRow label="Created" value={format(new Date(policy.created_at), 'PPpp')} />
                <DetailRow label="Last Updated" value={format(new Date(policy.updated_at), 'PPpp')} />
                <DetailRow label="Published" value={policy.published_at ? format(new Date(policy.published_at), 'PPpp') : '—'} />
              </CardContent>
            </Card>
          </div>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Attachments</CardTitle>
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
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Open</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No version history yet</p>
              ) : (
                <div className="space-y-3">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-start gap-3 p-3 rounded-md border">
                      <Badge variant="outline">v{v.version_number}</Badge>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{v.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{v.change_summary || 'No change summary'}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{format(new Date(v.changed_at), 'MMM d, yyyy HH:mm')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No approval history</p>
              ) : (
                <div className="space-y-3">
                  {approvals.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-md border">
                      {a.status === 'approved' && <CheckCircle className="h-5 w-5 text-primary mt-0.5" />}
                      {a.status === 'pending' && <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />}
                      {a.status === 'rejected' && <AlertOctagon className="h-5 w-5 text-destructive mt-0.5" />}
                      <div className="flex-1">
                        <div className="text-sm capitalize font-medium">{a.status}</div>
                        {a.comments && <div className="text-xs text-muted-foreground">{a.comments}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'MMM d, yyyy HH:mm')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Acknowledgments Tab */}
        <TabsContent value="acknowledgments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Policy Acknowledgments</CardTitle>
              {policy.acknowledgment_required && policy.status === 'published' && !userHasAcked && (
                <Button size="sm" onClick={() => setShowAckDialog(true)}>
                  <UserCheck className="h-4 w-4 mr-1" /> Acknowledge
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {acknowledgments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No acknowledgments recorded</p>
              ) : (
                <div className="space-y-3">
                  {acknowledgments.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-md border">
                      <UserCheck className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Version {a.version_acknowledged} acknowledged</div>
                        {a.comments && <div className="text-xs text-muted-foreground">{a.comments}</div>}
                        <div className="text-xs text-muted-foreground mt-0.5">User: {a.user_id.slice(0, 8)}...</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{format(new Date(a.acknowledged_at), 'MMM d, yyyy HH:mm')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Policy Exceptions</CardTitle>
              {policy.exception_allowed && policy.status === 'published' && (
                <Button size="sm" variant="outline" onClick={() => setShowExceptionDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Request Exception
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {exceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No exceptions requested</p>
              ) : (
                <div className="space-y-3">
                  {exceptions.map(e => {
                    const statusColors: Record<string, string> = {
                      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                      expired: 'bg-muted text-muted-foreground',
                    };
                    return (
                      <div key={e.id} className="p-3 rounded-md border space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={statusColors[e.status]}>{e.status}</Badge>
                          <span className="text-xs text-muted-foreground">{format(new Date(e.created_at), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="text-sm"><strong>Reason:</strong> {e.reason}</div>
                        {e.justification && <div className="text-xs text-muted-foreground"><strong>Justification:</strong> {e.justification}</div>}
                        {e.risk_assessment && <div className="text-xs text-muted-foreground"><strong>Risk:</strong> {e.risk_assessment}</div>}
                        <div className="text-xs text-muted-foreground">
                          Period: {e.start_date} to {e.end_date}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linkages Tab */}
        <TabsContent value="linkages" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Linked Modules</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowLinkDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Link
              </Button>
            </CardHeader>
            <CardContent>
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
                      <div className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'MMM d, yyyy')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Acknowledge Dialog */}
      <Dialog open={showAckDialog} onOpenChange={setShowAckDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Policy</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            By acknowledging, you confirm that you have read and understood <strong>{policy.name}</strong> (v{policy.current_version}).
          </p>
          <div>
            <Label>Comments (optional)</Label>
            <Textarea value={ackComment} onChange={e => setAckComment(e.target.value)} placeholder="Any comments..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAckDialog(false)}>Cancel</Button>
            <Button onClick={handleAcknowledge} disabled={acknowledgePolicy.isPending}>
              {acknowledgePolicy.isPending ? 'Acknowledging...' : 'Acknowledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exception Request Dialog */}
      <Dialog open={showExceptionDialog} onOpenChange={setShowExceptionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Policy Exception</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason *</Label>
              <Textarea value={exceptionForm.reason} onChange={e => setExceptionForm(p => ({ ...p, reason: e.target.value }))} placeholder="Why is an exception needed?" rows={2} />
            </div>
            <div>
              <Label>Business Justification</Label>
              <Textarea value={exceptionForm.justification} onChange={e => setExceptionForm(p => ({ ...p, justification: e.target.value }))} placeholder="Business justification..." rows={2} />
            </div>
            <div>
              <Label>Risk Assessment</Label>
              <Textarea value={exceptionForm.risk_assessment} onChange={e => setExceptionForm(p => ({ ...p, risk_assessment: e.target.value }))} placeholder="What are the risks?" rows={2} />
            </div>
            <div>
              <Label>Compensating Controls</Label>
              <Textarea value={exceptionForm.compensating_controls} onChange={e => setExceptionForm(p => ({ ...p, compensating_controls: e.target.value }))} placeholder="What controls will compensate?" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={exceptionForm.start_date} onChange={e => setExceptionForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input type="date" value={exceptionForm.end_date} onChange={e => setExceptionForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExceptionDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestException} disabled={!exceptionForm.reason || !exceptionForm.start_date || !exceptionForm.end_date || requestException.isPending}>
              {requestException.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Linkage Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Entity Type</Label>
              <Select value={linkForm.linked_entity_type} onValueChange={v => setLinkForm(p => ({ ...p, linked_entity_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="form">Form</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity ID</Label>
              <Input value={linkForm.linked_entity_id} onChange={e => setLinkForm(p => ({ ...p, linked_entity_id: e.target.value }))} placeholder="Paste entity ID" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={linkForm.link_description} onChange={e => setLinkForm(p => ({ ...p, link_description: e.target.value }))} placeholder="Describe the relationship" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateLinkage} disabled={!linkForm.linked_entity_id || createLinkage.isPending}>
              {createLinkage.isPending ? 'Linking...' : 'Create Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
      <Separator />
    </>
  );
}

export default PolicyDetail;
