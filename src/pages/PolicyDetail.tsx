import React, { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import PizZip from 'pizzip';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Save, Send, Archive, History, CheckCircle, Clock, FileText, Download, Plus, AlertOctagon, CalendarClock, Shield, BookOpen, Upload, Loader2, FileDown, Users, Eye, EyeOff, RotateCcw, MessageSquare, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import { PolicyDynamicFieldsRenderer } from '@/components/policies/PolicyDynamicFieldsRenderer';
import { PolicyCustomFieldsBuilder, type PolicyCustomField } from '@/components/policies/PolicyCustomFieldsBuilder';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePolicies, usePolicyDetail } from '@/hooks/usePolicies';
import { useAuth } from '@/contexts/AuthContext';
import { useKnowledgeBasePermission } from '@/hooks/useKnowledgeBasePermission';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import { POLICY_CATEGORIES, POLICY_STATUSES, POLICY_PRIORITIES, REVIEW_CYCLE_OPTIONS } from '@/types/policy';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { PolicyApprovalFlow, type ApprovalMode } from '@/components/policies/PolicyApprovalFlow';
import { PolicyReviewFlow } from '@/components/policies/PolicyReviewFlow';
import { PolicyVersionDiff } from '@/components/policies/PolicyVersionDiff';
import { PolicyCustomFieldsRenderer } from '@/components/policies/PolicyCustomFieldsRenderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { sendKBNotificationEmail } from '@/services/kbNotificationEmail';

const PolicyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const { policies, updatePolicy, deletePolicy, createVersion, createReviewCycle, clonePolicy, completeReviewCycle } = usePolicies();
  const { versions, linkages, approvals, reviewCycles, isLoading, createLinkage, submitApproval, respondApproval } = usePolicyDetail(id);
  
  const policy = policies.find(p => p.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [changeSummary, setChangeSummary] = useState('');
  const [reviewCommentMap, setReviewCommentMap] = useState<Record<string, string>>({});
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkForm, setLinkForm] = useState({ linked_entity_type: 'form' as const, linked_entity_id: '', link_description: '' });
  const [approvalComment, setApprovalComment] = useState('');
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [dynamicFieldsFormat, setDynamicFieldsFormat] = useState<'table' | 'field-value'>(
    (policies.find(p => p.id === id)?.content?.dynamic_fields_display as 'table' | 'field-value') || 'table'
  );
  const [liveContentHtml, setLiveContentHtml] = useState<string | null>(null);
  const [contentDirty, setContentDirty] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(true);
  const [customFieldColumns, setCustomFieldColumns] = useState<number>(
    (policies.find(p => p.id === id)?.content?.custom_field_columns as number) || 1
  );
  const [dynamicFieldColumns, setDynamicFieldColumns] = useState<number>(
    (policies.find(p => p.id === id)?.content?.dynamic_field_columns as number) || 1
  );

  const DEFAULT_SECTION_ORDER = ['metadata', 'document_content', 'custom_fields', 'dynamic_fields', 'attachments'];
  const getSectionOrder = (): string[] => {
    const saved = policy?.content?.section_order as string[] | undefined;
    if (saved && Array.isArray(saved) && saved.length > 0) return saved;
    return DEFAULT_SECTION_ORDER;
  };
  const [sectionOrder, setSectionOrder] = useState<string[]>(getSectionOrder());

  const handleSectionDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || !policy) return;
    const items = Array.from(sectionOrder);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setSectionOrder(items);
    await updatePolicy.mutateAsync({
      id: policy.id,
      content: { ...(policy.content || {}), section_order: items },
    });
  }, [sectionOrder, policy, updatePolicy]);

  const handleCustomFieldDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || !policy) return;
    const fields = [...((policy.content?.custom_fields as any[]) || [])];
    const dataFields = fields.filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type));
    const layoutFields = fields.filter((f: any) => ['header', 'description', 'horizontal-line'].includes(f.type));
    const [reordered] = dataFields.splice(result.source.index, 1);
    dataFields.splice(result.destination.index, 0, reordered);
    // Reassign order
    const reorderedFields = dataFields.map((f: any, i: number) => ({ ...f, order: i }));
    const allFields = [...layoutFields, ...reorderedFields];
    await updatePolicy.mutateAsync({
      id: policy.id,
      content: { ...(policy.content || {}), custom_fields: allFields },
    });
  }, [policy, updatePolicy]);

  // Approval dialog state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedApproverIds, setSelectedApproverIds] = useState<string[]>([]);
  const [approvalSubmitComment, setApprovalSubmitComment] = useState('');
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(
    (policy?.content?.approval_mode as ApprovalMode) || 'any_one'
  );

  // Pre-Review / Post-Review dialog state
  const [showPreReviewDialog, setShowPreReviewDialog] = useState(false);
  const [showPostReviewDialog, setShowPostReviewDialog] = useState(false);
  const [preReviewerIds, setPreReviewerIds] = useState<string[]>([]);
  const [postReviewerIds, setPostReviewerIds] = useState<string[]>([]);
  const [preReviewComment, setPreReviewComment] = useState('');
  const [postReviewComment, setPostReviewComment] = useState('');

  // Fetch users for approver selection
  const usersQuery = useQuery({
    queryKey: ['users-for-approval', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, role')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch groups for reviewer selection
  const groupsQuery = useQuery({
    queryKey: ['groups-for-review', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch linkable entities based on type
  const formsQuery = useQuery({
    queryKey: ['linkable-forms', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const { data, error } = await supabase
        .from('forms')
        .select('id, name, reference_id')
        .eq('project_id', currentProject.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProject?.id,
  });

  const policiesForLink = useQuery({
    queryKey: ['linkable-policies', currentProject?.id, id],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const { data, error } = await supabase
        .from('policies')
        .select('id, name, policy_number')
        .eq('project_id', currentProject.id)
        .neq('id', id!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProject?.id && showLinkDialog,
  });

  if (!policy) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">Document not found</h3>
          <Button variant="outline" onClick={() => navigate(-1)}>Back to Knowledge Base</Button>
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
      priority: policy.priority || 'medium',
      effective_date: policy.effective_date || '',
      expiry_date: policy.expiry_date || '',
      review_cycle_days: policy.review_cycle_days || 365,
      content_html: policy.content?.html || '',
      custom_field_values: { ...(policy.content?.custom_field_values || {}) },
      custom_fields: [...(policy.content?.custom_fields as PolicyCustomField[] || [])],
    });
    setIsEditing(true);
  };

  const saveChanges = async () => {
    // Snapshot current version before update
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

    const { content_html, effective_date, expiry_date, custom_field_values, custom_fields, ...restEditForm } = editForm;
    // Merge content_html, custom_field_values, and custom_fields into existing content
    const updatedContent = {
      ...(policy.content || {}),
      ...(content_html !== undefined ? { html: content_html } : {}),
      ...(custom_field_values ? { custom_field_values } : {}),
      ...(custom_fields ? { custom_fields } : {}),
    };

    await updatePolicy.mutateAsync({
      id: policy.id,
      ...restEditForm,
      effective_date: effective_date || null,
      expiry_date: expiry_date || null,
      content: updatedContent,
      next_review_date: next_review_date || null,
      current_version: policy.current_version + 1,
    });

    setIsEditing(false);
    setChangeSummary('');
    setShowSaveConfirmDialog(false);
  };

  const handleSubmitForApproval = async () => {
    if (selectedApproverIds.length === 0) {
      toast.error('Please select at least one approver');
      return;
    }
    // Resolve group IDs to individual user IDs
    const resolvedUserIds = new Set<string>();
    for (const id of selectedApproverIds) {
      if (id.startsWith('group:')) {
        const groupId = id.replace('group:', '');
        const { data: members } = await supabase.rpc('get_group_members', { _group_id: groupId });
        if (members) {
          for (const m of members.filter((m: any) => m.member_type === 'user')) {
            resolvedUserIds.add(m.member_id);
          }
        }
      } else {
        resolvedUserIds.add(id);
      }
    }

    const approverIds = Array.from(resolvedUserIds);
    
    // Create one approval record per resolved user
    for (const approverId of approverIds) {
      await submitApproval.mutateAsync({
        policyId: policy.id,
        versionNumber: policy.current_version,
        approverId,
        comments: approvalSubmitComment || undefined,
      });

      // Notify the approver
      await supabase.from('notifications').insert({
        user_id: approverId,
        type: 'policy_approval_request',
        title: 'Policy Approval Required',
        message: `You have been requested to approve policy "${policy.name}" (${policy.policy_number || 'Draft'}) v${policy.current_version}.`,
        data: {
          policy_id: policy.id,
          policy_name: policy.name,
          policy_number: policy.policy_number,
          version: policy.current_version,
          submitted_by: user?.id,
          link: `/policy/${policy.id}`,
        },
      });

      // Send email notification (non-blocking)
      sendKBNotificationEmail({
        type: 'approval_request',
        recipientUserId: approverId,
        policyName: policy.name,
        policyNumber: policy.policy_number || undefined,
        policyId: policy.id,
        version: policy.current_version,
        organizationId: currentOrganization?.id || userProfile?.organization_id || '',
        senderName: [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || userProfile?.email || '',
        comment: approvalSubmitComment || undefined,
      });
    }
    // Save approval mode to policy content
    await updatePolicy.mutateAsync({
      id: policy.id,
      status: 'pending_approval',
      content: { ...(policy.content || {}), approval_mode: approvalMode },
    });
    setShowApprovalDialog(false);
    setSelectedApproverIds([]);
    setApprovalSubmitComment('');
    toast.success(`Submitted for approval to ${approverIds.length} approver(s) (${approvalMode === 'any_one' ? 'Any One' : 'All'} mode)`);
  };

  // Compute approval readiness (used in multiple places)
  const getApprovalStatus = () => {
    const approvedCount = approvals.filter(a => a.status === 'approved').length;
    const rejectedCount = approvals.filter(a => a.status === 'rejected').length;
    const pendingCount = approvals.filter(a => a.status === 'pending').length;
    const mode = (policy.content?.approval_mode as ApprovalMode) || 'any_one';
    
    let isReadyForPublish = false;
    if (approvals.length > 0 && rejectedCount === 0) {
      if (mode === 'any_one' && approvedCount > 0) isReadyForPublish = true;
      if (mode === 'all' && pendingCount === 0 && approvedCount > 0) isReadyForPublish = true;
    }
    
    return { approvedCount, rejectedCount, pendingCount, mode, isReadyForPublish };
  };

  const handleApprovalResponse = async (approvalId: string, status: 'approved' | 'rejected', comment?: string) => {
    await respondApproval.mutateAsync({ approvalId, status, comments: comment || approvalComment || undefined });
    
    if (status === 'approved') {
      // Don't auto-publish — let user click Publish when ready
      const savedMode: ApprovalMode = (policy.content?.approval_mode as ApprovalMode) || 'any_one';
      const remainingPending = approvals.filter(a => a.status === 'pending' && a.id !== approvalId);
      
      let readyForPublish = false;
      if (savedMode === 'any_one') {
        readyForPublish = true;
      } else {
        readyForPublish = remainingPending.length === 0;
      }
      
      if (readyForPublish) {
        toast.success('All approvals received — policy is ready for publish!');
      } else {
        toast.success('Approval recorded');
      }
    } else {
      await updatePolicy.mutateAsync({ id: policy.id, status: 'draft' });
      toast.info('Policy rejected — returned to Draft');
    }
    setApprovalComment('');
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
    navigate('/knowledge-base');
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !policy) return;
    setIsUploadingAttachment(true);
    try {
      const filePath = `policies/${policy.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await (await import('@/integrations/supabase/client')).supabase.storage
        .from('policy-attachments')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage
        .from('policy-attachments')
        .getPublicUrl(filePath);

      const newAttachment = {
        name: file.name,
        url: urlData.publicUrl,
        type: 'file' as const,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        show_in_pdf: true,
      };
      const updatedAttachments = [...(policy.attachments || []), newAttachment];
      await updatePolicy.mutateAsync({
        id: policy.id,
        attachments: updatedAttachments as any,
      });
      toast.success(`Attachment "${file.name}" uploaded`);
    } catch (err: any) {
      console.error('Attachment upload error:', err);
      toast.error('Failed to upload: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
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

  // Get linkable entities for current type
  const getLinkableEntities = () => {
    if (linkForm.linked_entity_type === 'form') {
      return (formsQuery.data || []).map(f => ({ id: f.id, label: f.name, badge: f.reference_id }));
    }
    if (linkForm.linked_entity_type === 'policy') {
      return (policiesForLink.data || []).map(p => ({ id: p.id, label: p.name, badge: p.policy_number }));
    }
    return [];
  };

  const generatePDF = async (mode: 'download' | 'preview' = 'download') => {
    const currentSectionOrder = getSectionOrder();

    const doc = new jsPDF();
    let yPos = 22;
    const pageHeight = doc.internal.pageSize.getHeight();

    const ensureSpace = (needed: number) => {
      if (yPos > pageHeight - needed) { doc.addPage(); yPos = 20; }
    };

    // Always print title first
    doc.setFontSize(18);
    doc.text(policy.name, 14, yPos);
    yPos += 10;

    // Section renderers
    const renderMetadata = () => {
      doc.setFontSize(10);
      doc.text(`${policy.policy_number || ''} | Status: ${policy.status} | Category: ${policy.category} | Priority: ${policy.priority || 'medium'} | Version: ${policy.current_version}`, 14, yPos);
      yPos += 6;
      doc.text(`Last Updated: ${format(new Date(policy.updated_at), 'PPpp')}`, 14, yPos);
      yPos += 6;
      if (policy.effective_date) { doc.text(`Effective: ${policy.effective_date}`, 14, yPos); yPos += 6; }
      if (policy.description) {
        yPos += 4;
        doc.setFontSize(12);
        doc.text('Description', 14, yPos);
        yPos += 6;
        doc.setFontSize(10);
        const descLines = doc.splitTextToSize(policy.description, 180);
        doc.text(descLines, 14, yPos);
        yPos += descLines.length * 5 + 4;
      }
    };

    const renderDocumentContent = async () => {
      const contentHtmlForExport = liveContentHtml ?? policy.content?.html;
      if (!contentHtmlForExport) return;
      yPos += 4;
      doc.setFontSize(12);
      doc.text('Document Content', 14, yPos);
      yPos += 8;

      const renderDiv = document.createElement('div');
      renderDiv.innerHTML = contentHtmlForExport;
      Object.assign(renderDiv.style, {
        position: 'absolute', left: '-9999px', top: '0', width: '720px',
        padding: '24px 32px', background: 'white',
        fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
        fontSize: '12px', lineHeight: '1.7', color: '#000',
      });
      document.body.appendChild(renderDiv);
      renderDiv.querySelectorAll('img').forEach((img) => { img.style.maxWidth = '100%'; img.style.height = 'auto'; img.setAttribute('crossorigin', 'anonymous'); });
      renderDiv.querySelectorAll('table').forEach((table) => { table.style.borderCollapse = 'collapse'; table.style.width = '100%'; });
      renderDiv.querySelectorAll('td, th').forEach((cell) => { (cell as HTMLElement).style.border = '1px solid #ccc'; (cell as HTMLElement).style.padding = '6px 10px'; (cell as HTMLElement).style.fontSize = '11px'; });
      renderDiv.querySelectorAll('th').forEach((th) => { (th as HTMLElement).style.backgroundColor = '#f3f4f6'; (th as HTMLElement).style.fontWeight = '600'; });
      renderDiv.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => { (h as HTMLElement).style.marginTop = '12px'; (h as HTMLElement).style.marginBottom = '6px'; (h as HTMLElement).style.color = '#111'; });
      renderDiv.querySelectorAll('blockquote').forEach((bq) => { (bq as HTMLElement).style.borderLeft = '3px solid #6366f1'; (bq as HTMLElement).style.paddingLeft = '12px'; (bq as HTMLElement).style.margin = '8px 0'; (bq as HTMLElement).style.color = '#374151'; });

      try {
        const canvas = await html2canvas(renderDiv, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
        document.body.removeChild(renderDiv);
        const imgData = canvas.toDataURL('image/png');
        const pageWidth = doc.internal.pageSize.getWidth() - 28;
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        const maxPageContent = pageHeight - 30;

        if (yPos + imgHeight <= maxPageContent) {
          doc.addImage(imgData, 'PNG', 14, yPos, pageWidth, imgHeight);
          yPos += imgHeight + 6;
        } else {
          let srcY = 0;
          while (srcY < canvas.height) {
            const availableHeight = (srcY === 0 ? maxPageContent - yPos : maxPageContent - 20);
            const sliceCanvasHeight = (availableHeight / pageWidth) * canvas.width;
            const actualSlice = Math.min(sliceCanvasHeight, canvas.height - srcY);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = actualSlice;
            const sliceCtx = sliceCanvas.getContext('2d');
            if (sliceCtx) {
              sliceCtx.drawImage(canvas, 0, srcY, canvas.width, actualSlice, 0, 0, canvas.width, actualSlice);
              const sliceImg = sliceCanvas.toDataURL('image/png');
              const sliceImgHeight = (actualSlice * pageWidth) / canvas.width;
              const startY = srcY === 0 ? yPos : 20;
              doc.addImage(sliceImg, 'PNG', 14, startY, pageWidth, sliceImgHeight);
              yPos = startY + sliceImgHeight + 6;
            }
            srcY += actualSlice;
            if (srcY < canvas.height) { doc.addPage(); yPos = 20; }
          }
        }
      } catch (err) {
        console.error('html2canvas failed, falling back to plain text:', err);
        document.body.removeChild(renderDiv);
        doc.setFontSize(10);
        const fallbackDiv = document.createElement('div');
        fallbackDiv.innerHTML = policy.content.html;
        const plainText = fallbackDiv.innerText || fallbackDiv.textContent || '';
        const contentLines = doc.splitTextToSize(plainText, 180);
        for (const line of contentLines) { ensureSpace(20); doc.text(line, 14, yPos); yPos += 5; }
      }
    };

    const renderCustomFields = () => {
      if (!policy.content?.custom_fields || !(policy.content.custom_fields as any[]).length) return;
      const fields = (policy.content.custom_fields as any[]).filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type));
      const vals = (policy.content?.custom_field_values as Record<string, any>) || {};
      if (fields.length === 0) return;
      const cols = (policy.content?.custom_field_columns as number) || 1;
      yPos += 8;
      ensureSpace(30);
      doc.setFontSize(13);
      doc.text('Custom Fields', 14, yPos);
      yPos += 8;
      const customRows = fields.sort((a: any, b: any) => a.order - b.order).map((field: any) => {
        const raw = vals[field.id];
        let display = '—';
        if (raw !== null && raw !== undefined && raw !== '') {
          if (Array.isArray(raw)) display = raw.map((v: string) => field.options?.find((o: any) => o.value === v)?.label || v).join(', ') || '—';
          else if (typeof raw === 'boolean') display = raw ? 'Yes' : 'No';
          else if ((field.type === 'select' || field.type === 'radio') && field.options) display = field.options.find((o: any) => o.value === raw)?.label || String(raw);
          else display = String(raw);
        }
        return [field.label, display];
      });

      if (cols > 1) {
        const rowsPerCol = Math.ceil(customRows.length / cols);
        const colWidth = (doc.internal.pageSize.getWidth() - 28) / cols;
        for (let c = 0; c < cols; c++) {
          const colRows = customRows.slice(c * rowsPerCol, (c + 1) * rowsPerCol);
          if (colRows.length > 0) {
            autoTable(doc, {
              head: [['Field', 'Value']],
              body: colRows,
              startY: yPos,
              margin: { left: 14 + c * colWidth },
              tableWidth: colWidth - 4,
              styles: { fontSize: 8 },
              headStyles: { fillColor: [60, 60, 60] },
            });
          }
        }
        yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
      } else {
        autoTable(doc, {
          head: [['Field', 'Value']],
          body: customRows,
          startY: yPos,
          margin: { left: 14 },
          styles: { fontSize: 9 },
          headStyles: { fillColor: [60, 60, 60] },
        });
        yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
      }
    };

    const renderDynamicFields = async () => {
      if (!policy.form_id) return;
      try {
        const displayFormat = dynamicFieldsFormat;
        const [formRes, fieldsRes, subsRes] = await Promise.all([
          supabase.from('forms').select('name').eq('id', policy.form_id).single(),
          supabase.from('form_fields').select('id, label, field_type, options, field_order, custom_config').eq('form_id', policy.form_id).order('field_order'),
          supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('form_id', policy.form_id).order('submitted_at', { ascending: true }),
        ]);
        const formName = formRes.data?.name || 'Linked Form';
        const allFields = (fieldsRes.data || []).filter(f => !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type));
        const selectedFieldIds = policy.content?.selected_field_ids as string[] | undefined;
        const selectedRecordIds = policy.content?.selected_record_ids as string[] | undefined;
        const fields = selectedFieldIds?.length ? allFields.filter(f => selectedFieldIds.includes(f.id)) : allFields;
        const allSubmissions = subsRes.data || [];
        const submissions = selectedRecordIds?.length ? allSubmissions.filter(s => selectedRecordIds.includes(s.id)) : allSubmissions;

        // Resolve cross-ref
        const crossRefFields = allFields.filter(f => ['cross-reference', 'child-cross-reference'].includes(f.field_type));
        const linkedIds = new Set<string>();
        for (const sub of submissions) {
          const data = (sub as any).submission_data || {};
          for (const cf of crossRefFields) {
            const val = data[cf.id];
            if (Array.isArray(val)) val.forEach((v: any) => { if (v?.id) linkedIds.add(v.id); });
            else if (val?.id) linkedIds.add(val.id);
          }
        }
        const linkedRecords: Record<string, any> = {};
        const linkedFieldLabels: Record<string, Record<string, string>> = {};
        if (linkedIds.size > 0) {
          const ids = Array.from(linkedIds);
          for (let i = 0; i < ids.length; i += 50) {
            const { data } = await supabase.from('form_submissions').select('id, submission_ref_id, submission_data, form_id').in('id', ids.slice(i, i + 50));
            if (data) data.forEach(r => { linkedRecords[r.id] = r; });
          }
          const formIds = [...new Set(Object.values(linkedRecords).map((r: any) => r.form_id))];
          for (const fid of formIds) {
            const { data: ff } = await supabase.from('form_fields').select('id, label, field_type').eq('form_id', fid).order('field_order');
            if (ff) {
              linkedFieldLabels[fid] = {};
              ff.filter(f => !['section','divider','heading','paragraph','spacer','page-break','child-cross-reference'].includes(f.field_type))
                .forEach(f => { linkedFieldLabels[fid][f.id] = f.label; });
            }
          }
        }

        const pdfResolveCrossRef = (value: any): string => {
          if (!value) return '—';
          const resolveOne = (v: any): string => {
            if (typeof v !== 'object' || !v) return String(v);
            const rec = linkedRecords[v.id];
            if (!rec) return v.submission_ref_id || v.id?.slice(0, 8) || JSON.stringify(v);
            const refId = rec.submission_ref_id || rec.id.slice(0, 8);
            const labels = linkedFieldLabels[rec.form_id] || {};
            const subData = rec.submission_data || {};
            const parts: string[] = [];
            for (const [fid, label] of Object.entries(labels).slice(0, 4)) {
              const val = subData[fid];
              if (val !== null && val !== undefined && val !== '' && typeof val !== 'object') parts.push(`${label}: ${val}`);
              if (parts.length >= 3) break;
            }
            return parts.length > 0 ? `${refId} — ${parts.join(' | ')}` : refId;
          };
          if (Array.isArray(value)) return value.map(resolveOne).filter(Boolean).join('; ') || '—';
          return resolveOne(value);
        };

        const pdfFmtVal = (val: any, fType: string, opts?: any) => {
          if (['cross-reference', 'child-cross-reference', 'dynamic-table'].includes(fType)) return pdfResolveCrossRef(val);
          return pdfFormatValue(val, fType, opts);
        };

        if (submissions.length > 0) {
          const recordNameFId = policy.content?.record_name_field_id as string | undefined;
          const cols = (policy.content?.dynamic_field_columns as number) || 1;
          yPos += 8;
          ensureSpace(30);
          doc.setFontSize(13);
          doc.text(`Dynamic Data — ${formName}`, 14, yPos);
          yPos += 8;

          submissions.forEach((sub: any, idx: number) => {
            const refId = sub.submission_ref_id || sub.id.slice(0, 8);
            const nameVal = recordNameFId ? (sub.submission_data || {})[recordNameFId] : null;
            const recordLabel = nameVal && typeof nameVal === 'string' && nameVal.trim() ? nameVal.trim() : `Record ${idx + 1}`;
            ensureSpace(25);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${recordLabel} — ${refId}`, 14, yPos);
            doc.setFont('helvetica', 'normal');
            yPos += 6;
            const data = sub.submission_data || {};

            if (displayFormat === 'table') {
              if (cols > 1) {
                // Multi-column table layout
                const allRows = fields.map((f: any) => [f.label, pdfFmtVal(data[f.id], f.field_type, f.options)]);
                const rowsPerCol = Math.ceil(allRows.length / cols);
                const colWidth = (doc.internal.pageSize.getWidth() - 28) / cols;
                for (let c = 0; c < cols; c++) {
                  const colRows = allRows.slice(c * rowsPerCol, (c + 1) * rowsPerCol);
                  if (colRows.length > 0) {
                    autoTable(doc, {
                      head: [['Field', 'Value']],
                      body: colRows,
                      startY: yPos,
                      margin: { left: 14 + c * colWidth },
                      tableWidth: colWidth - 4,
                      styles: { fontSize: 8 },
                      headStyles: { fillColor: [60, 60, 60] },
                    });
                  }
                }
                yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
              } else {
                const tableRows = fields.map((f: any) => [f.label, pdfFmtVal(data[f.id], f.field_type, f.options)]);
                autoTable(doc, { head: [['Field', 'Value']], body: tableRows, startY: yPos, margin: { left: 14 }, styles: { fontSize: 9 }, headStyles: { fillColor: [60, 60, 60] } });
                yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
              }
            } else {
              doc.setFontSize(10);
              fields.forEach((f: any) => {
                ensureSpace(16);
                doc.setFont('helvetica', 'bold');
                doc.text(f.label, 14, yPos);
                yPos += 5;
                doc.setFont('helvetica', 'normal');
                const val = pdfFmtVal(data[f.id], f.field_type, f.options);
                const valLines = doc.splitTextToSize(val, 180);
                for (const vl of valLines) { ensureSpace(12); doc.text(vl, 14, yPos); yPos += 5; }
                yPos += 2;
              });
            }
            yPos += 4;
          });
        }
      } catch (err) {
        console.error('Failed to fetch dynamic fields for PDF:', err);
      }
    };

    const renderAttachments = () => {
      const pdfAttachments = (policy.attachments || []).filter((att: any) => att.show_in_pdf !== false);
      if (pdfAttachments.length === 0) return;
      const lastY = (doc as any).lastAutoTable?.finalY || yPos;
      yPos = lastY + 10;
      if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.text('Attachments', 14, yPos);
      yPos += 6;
      doc.setFontSize(10);
      pdfAttachments.forEach((att: any) => {
        if (yPos > pageHeight - 15) { doc.addPage(); yPos = 20; }
        const label = `• ${att.name}`;
        doc.text(label, 14, yPos);
        if (att.url) {
          const labelWidth = doc.getTextWidth(label);
          doc.setTextColor(37, 99, 235);
          doc.textWithLink(' [Open / Download]', 14 + labelWidth, yPos, { url: att.url });
          doc.setTextColor(0, 0, 0);
        }
        yPos += 5;
      });
    };

    // Render sections in order
    for (const section of currentSectionOrder) {
      switch (section) {
        case 'metadata': renderMetadata(); break;
        case 'document_content': await renderDocumentContent(); break;
        case 'custom_fields': renderCustomFields(); break;
        case 'dynamic_fields': await renderDynamicFields(); break;
        case 'attachments': renderAttachments(); break;
      }
    }

    if (mode === 'preview') {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      // Use window.open for reliable new-tab opening
      const newTab = window.open(pdfUrl, '_blank');
      if (!newTab) {
        // Fallback if popup blocked
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      toast.success('PDF preview opened in new tab');
    } else {
      doc.save(`${policy.policy_number || policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${policy.current_version}.pdf`);
      toast.success('PDF exported');
    }
  };

  const exportToPDF = () => generatePDF('download');

  const generateVersionPDF = async (version: any, mode: 'download' | 'preview') => {
    const doc = new jsPDF();
    let yPos = 22;
    const pageHeight = doc.internal.pageSize.getHeight();
    const ensureSpace = (needed: number) => { if (yPos > pageHeight - needed) { doc.addPage(); yPos = 20; } };

    doc.setFontSize(18);
    doc.text(version.name, 14, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Version: v${version.version_number} | Category: ${version.category || policy.category}`, 14, yPos);
    yPos += 6;
    doc.text(`Changed: ${format(new Date(version.changed_at), 'PPpp')}`, 14, yPos);
    yPos += 6;
    if (version.change_summary) {
      doc.text(`Change Summary: ${version.change_summary}`, 14, yPos);
      yPos += 6;
    }
    doc.text(`Changed by: ${getUserName(version.changed_by)}`, 14, yPos);
    yPos += 8;

    if (version.description) {
      ensureSpace(20);
      doc.setFontSize(12);
      doc.text('Description', 14, yPos);
      yPos += 6;
      doc.setFontSize(10);
      const descLines = doc.splitTextToSize(version.description, 180);
      doc.text(descLines, 14, yPos);
      yPos += descLines.length * 5 + 4;
    }

    const versionHtml = version.content?.html;
    if (versionHtml) {
      ensureSpace(20);
      doc.setFontSize(12);
      doc.text('Policy Content', 14, yPos);
      yPos += 8;
      doc.setFontSize(10);

      const renderDiv = document.createElement('div');
      renderDiv.innerHTML = versionHtml;
      Object.assign(renderDiv.style, {
        position: 'absolute', left: '-9999px', top: '0', width: '720px',
        padding: '24px 32px', background: 'white',
        fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
        fontSize: '12px', lineHeight: '1.7', color: '#000',
      });
      document.body.appendChild(renderDiv);
      renderDiv.querySelectorAll('table').forEach(t => { t.style.borderCollapse = 'collapse'; t.style.width = '100%'; });
      renderDiv.querySelectorAll('td, th').forEach(c => { (c as HTMLElement).style.border = '1px solid #ccc'; (c as HTMLElement).style.padding = '6px 10px'; });
      renderDiv.querySelectorAll('th').forEach(th => { (th as HTMLElement).style.backgroundColor = '#f3f4f6'; (th as HTMLElement).style.fontWeight = '600'; });

      try {
        const canvas = await html2canvas(renderDiv, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
        document.body.removeChild(renderDiv);
        const imgData = canvas.toDataURL('image/png');
        const pageWidth = doc.internal.pageSize.getWidth() - 28;
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        if (yPos + imgHeight <= pageHeight - 30) {
          doc.addImage(imgData, 'PNG', 14, yPos, pageWidth, imgHeight);
          yPos += imgHeight + 6;
        } else {
          let srcY = 0;
          while (srcY < canvas.height) {
            const availH = (srcY === 0 ? pageHeight - 30 - yPos : pageHeight - 50);
            const sliceH = Math.min((availH / pageWidth) * canvas.width, canvas.height - srcY);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceH;
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
              const sliceImg = sliceCanvas.toDataURL('image/png');
              const sliceImgH = (sliceH * pageWidth) / canvas.width;
              doc.addImage(sliceImg, 'PNG', 14, srcY === 0 ? yPos : 20, pageWidth, sliceImgH);
              yPos = (srcY === 0 ? yPos : 20) + sliceImgH + 6;
            }
            srcY += sliceH;
            if (srcY < canvas.height) { doc.addPage(); yPos = 20; }
          }
        }
      } catch {
        document.body.removeChild(renderDiv);
        const td2 = document.createElement('div');
        td2.innerHTML = versionHtml;
        const plain = td2.innerText || td2.textContent || '';
        const lines = doc.splitTextToSize(plain, 180);
        for (const line of lines) { ensureSpace(12); doc.text(line, 14, yPos); yPos += 5; }
      }
    }

    // Attachments
    const vAttachments = (version.attachments || []).filter((a: any) => a.show_in_pdf !== false);
    if (vAttachments.length > 0) {
      ensureSpace(20);
      doc.setFontSize(12);
      doc.text('Attachments', 14, yPos);
      yPos += 6;
      doc.setFontSize(10);
      vAttachments.forEach((att: any) => {
        ensureSpace(10);
        doc.text(`• ${att.name}`, 14, yPos);
        yPos += 5;
      });
    }

    const fileName = `${policy.policy_number || policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${version.version_number}.pdf`;
    if (mode === 'preview') {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, '_blank');
      if (!tab) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
      toast.success('Version PDF preview opened');
    } else {
      doc.save(fileName);
      toast.success('Version PDF downloaded');
    }
  };

  const exportToDocx = async () => {
    const currentSectionOrder = getSectionOrder();
    const sections: any[] = [];

    // Title always first
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: policy.name, bold: true, size: 36, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    const addMetadata = () => {
      sections.push(new Paragraph({
        children: [new TextRun({ text: `${policy.policy_number || ''} | Status: ${policy.status} | Category: ${policy.category} | Version: v${policy.current_version}`, size: 20, color: '666666', font: 'Calibri' })],
        spacing: { after: 100 },
      }));
      sections.push(new Paragraph({
        children: [new TextRun({ text: `Last Updated: ${format(new Date(policy.updated_at), 'PPpp')}`, size: 20, color: '666666', font: 'Calibri' })],
        spacing: { after: 200 },
      }));
      if (policy.description) {
        sections.push(new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 24, font: 'Calibri' })], heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }));
        sections.push(new Paragraph({ children: [new TextRun({ text: policy.description, size: 22, font: 'Calibri' })], spacing: { after: 200 } }));
      }
    };

    const addDocumentContent = () => {
      const docxContentHtml = liveContentHtml ?? policy.content?.html;
      if (!docxContentHtml) return;
      sections.push(new Paragraph({ children: [new TextRun({ text: 'Document Content', bold: true, size: 24, font: 'Calibri' })], heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }));
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = docxContentHtml;
      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) sections.push(new Paragraph({ children: [new TextRun({ text, size: 22, font: 'Calibri' })], spacing: { after: 80 } }));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            const level = tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
            sections.push(new Paragraph({ children: [new TextRun({ text: el.textContent || '', bold: true, size: tag === 'h1' ? 32 : tag === 'h2' ? 28 : 24, font: 'Calibri' })], heading: level, spacing: { after: 120 } }));
          } else if (tag === 'p' || tag === 'div') {
            const text = el.textContent?.trim();
            if (text) sections.push(new Paragraph({ children: [new TextRun({ text, size: 22, font: 'Calibri' })], spacing: { after: 80 } }));
          } else if (tag === 'ul' || tag === 'ol') {
            el.querySelectorAll('li').forEach((li, idx) => {
              const bullet = tag === 'ul' ? '• ' : `${idx + 1}. `;
              sections.push(new Paragraph({ children: [new TextRun({ text: bullet + (li.textContent || ''), size: 22, font: 'Calibri' })], spacing: { after: 40 }, indent: { left: 400 } }));
            });
          } else if (tag === 'table') {
            const rows = el.querySelectorAll('tr');
            if (rows.length > 0) {
              const docxRows = Array.from(rows).map((tr, rIdx) => {
                const cells = tr.querySelectorAll('td, th');
                return new DocxTableRow({ children: Array.from(cells).map(cell => new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell.textContent || '', bold: cell.tagName.toLowerCase() === 'th' || rIdx === 0, size: 20, font: 'Calibri' })] })], width: { size: 100 / cells.length, type: WidthType.PERCENTAGE } })) });
              });
              sections.push(new DocxTable({ rows: docxRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
              sections.push(new Paragraph({ children: [], spacing: { after: 120 } }));
            }
          } else if (tag === 'blockquote') {
            sections.push(new Paragraph({ children: [new TextRun({ text: el.textContent || '', italics: true, size: 22, color: '374151', font: 'Calibri' })], indent: { left: 400 }, spacing: { after: 100 } }));
          } else {
            el.childNodes.forEach(child => processNode(child));
          }
        }
      };
      tempDiv.childNodes.forEach(child => processNode(child));
    };

    const addCustomFields = () => {
      if (!policy.content?.custom_fields || !(policy.content.custom_fields as any[]).length) return;
      const fields = (policy.content.custom_fields as any[]).filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type));
      const vals = (policy.content?.custom_field_values as Record<string, any>) || {};
      if (fields.length === 0) return;
      sections.push(new Paragraph({ children: [new TextRun({ text: 'Custom Fields', bold: true, size: 24, font: 'Calibri' })], heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      const docxRows = [
        new DocxTableRow({ children: [
          new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Field', bold: true, size: 20, font: 'Calibri' })] })], width: { size: 40, type: WidthType.PERCENTAGE } }),
          new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true, size: 20, font: 'Calibri' })] })], width: { size: 60, type: WidthType.PERCENTAGE } }),
        ] }),
        ...fields.sort((a: any, b: any) => a.order - b.order).map((field: any) => {
          const raw = vals[field.id];
          let display = '—';
          if (raw !== null && raw !== undefined && raw !== '') {
            if (Array.isArray(raw)) display = raw.map((v: string) => field.options?.find((o: any) => o.value === v)?.label || v).join(', ') || '—';
            else if (typeof raw === 'boolean') display = raw ? 'Yes' : 'No';
            else if ((field.type === 'select' || field.type === 'radio') && field.options) display = field.options.find((o: any) => o.value === raw)?.label || String(raw);
            else display = String(raw);
          }
          return new DocxTableRow({ children: [
            new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: field.label, bold: true, size: 20, font: 'Calibri' })] })] }),
            new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: display, size: 20, font: 'Calibri' })] })] }),
          ] });
        }),
      ];
      sections.push(new DocxTable({ rows: docxRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      sections.push(new Paragraph({ children: [], spacing: { after: 120 } }));
    };

    const addAttachments = () => {
      const pdfAttachments = (policy.attachments || []).filter((att: any) => att.show_in_pdf !== false);
      if (pdfAttachments.length === 0) return;
      sections.push(new Paragraph({ children: [new TextRun({ text: 'Attachments', bold: true, size: 24, font: 'Calibri' })], heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      pdfAttachments.forEach((att: any) => {
        sections.push(new Paragraph({ children: [new TextRun({ text: `• ${att.name}${att.url ? ' — ' + att.url : ''}`, size: 20, font: 'Calibri' })], spacing: { after: 40 } }));
      });
    };

    // Render in section order
    for (const section of currentSectionOrder) {
      switch (section) {
        case 'metadata': addMetadata(); break;
        case 'document_content': addDocumentContent(); break;
        case 'custom_fields': addCustomFields(); break;
        case 'attachments': addAttachments(); break;
        // dynamic_fields not supported in simple DOCX export (kept in original docx flow)
      }
    }

    const doc = new Document({
      sections: [{ children: sections }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${policy.policy_number || policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${policy.current_version}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('DOCX exported successfully');
  };

  // Shared helper: build OpenXML content paragraphs from policy data
  const buildOriginalDocxContentBlocks = async (): Promise<string[]> => {
    const cps: string[] = [];
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Separator
    cps.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>');

    // Inject HTML content
    const cHtml = liveContentHtml ?? policy.content?.html;
    if (cHtml) {
      const td = document.createElement('div');
      td.innerHTML = cHtml;

      const extractBlocks = (node: Node): string[] => {
        const b: string[] = [];
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent?.trim();
          if (t) b.push('<w:p><w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r></w:p>');
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            const sz = tag === 'h1' ? '32' : tag === 'h2' ? '28' : '24';
            b.push('<w:p><w:r><w:rPr><w:b/><w:sz w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + esc(el.textContent || '') + '</w:t></w:r></w:p>');
          } else if (tag === 'li') {
            b.push('<w:p><w:r><w:t xml:space="preserve">\u2022 ' + esc(el.textContent || '') + '</w:t></w:r></w:p>');
          } else if (['p', 'div'].includes(tag)) {
            const t = el.textContent?.trim();
            if (t) b.push('<w:p><w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r></w:p>');
          } else if (tag === 'table') {
            const rows = el.querySelectorAll('tr');
            if (rows.length > 0) {
              let tx = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' +
                '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
                '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
                '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
                '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
                '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
                '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
                '</w:tblBorders></w:tblPr>';
              rows.forEach(tr => {
                tx += '<w:tr>';
                tr.querySelectorAll('td,th').forEach(c => {
                  const isBold = c.tagName.toLowerCase() === 'th';
                  tx += '<w:tc><w:p><w:r>' + (isBold ? '<w:rPr><w:b/></w:rPr>' : '') +
                    '<w:t xml:space="preserve">' + esc(c.textContent || '') + '</w:t></w:r></w:p></w:tc>';
                });
                tx += '</w:tr>';
              });
              tx += '</w:tbl>';
              b.push(tx);
            }
          } else if (tag === 'blockquote') {
            b.push('<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">' + esc(el.textContent || '') + '</w:t></w:r></w:p>');
          } else if (tag === 'ul' || tag === 'ol') {
            el.childNodes.forEach(ch => b.push(...extractBlocks(ch)));
          } else {
            el.childNodes.forEach(ch => b.push(...extractBlocks(ch)));
          }
        }
        return b;
      };
      td.childNodes.forEach(ch => cps.push(...extractBlocks(ch)));
    }

    // Custom Fields Data in Original DOCX
    if (policy.content?.custom_fields && (policy.content.custom_fields as any[]).length > 0) {
      const fields = (policy.content.custom_fields as any[]).filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type));
      const vals = (policy.content?.custom_field_values as Record<string, any>) || {};
      if (fields.length > 0) {
        cps.push('<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">Custom Fields</w:t></w:r></w:p>');
        let tx = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' +
          '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
          '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
          '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
          '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
          '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
          '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
          '</w:tblBorders></w:tblPr>';
        tx += '<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E0E0E0"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Field</w:t></w:r></w:p></w:tc>' +
          '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E0E0E0"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Value</w:t></w:r></w:p></w:tc></w:tr>';
        fields.sort((a: any, b: any) => a.order - b.order).forEach((field: any) => {
          const raw = vals[field.id];
          let display = '\u2014';
          if (raw !== null && raw !== undefined && raw !== '') {
            if (Array.isArray(raw)) display = raw.map((v: string) => field.options?.find((o: any) => o.value === v)?.label || v).join(', ') || '\u2014';
            else if (typeof raw === 'boolean') display = raw ? 'Yes' : 'No';
            else if ((field.type === 'select' || field.type === 'radio') && field.options) display = field.options.find((o: any) => o.value === raw)?.label || String(raw);
            else display = String(raw);
          }
          tx += '<w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + esc(field.label) + '</w:t></w:r></w:p></w:tc>' +
            '<w:tc><w:p><w:r><w:t xml:space="preserve">' + esc(display) + '</w:t></w:r></w:p></w:tc></w:tr>';
        });
        tx += '</w:tbl>';
        cps.push(tx);
        cps.push('<w:p/>');
      }
    }

    // Inject dynamic form fields
    if (policy.form_id) {
      const [fR, sR] = await Promise.all([
        supabase.from('form_fields').select('id,label,field_type,options,field_order,custom_config').eq('form_id', policy.form_id).order('field_order'),
        supabase.from('form_submissions').select('id,submission_ref_id,submission_data').eq('form_id', policy.form_id).order('submitted_at', { ascending: true }),
      ]);
      const allFields = (fR.data || []).filter(f => !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type));
      const selectedIds = policy.content?.selected_field_ids as string[] | undefined;
      const selectedRecordIds = policy.content?.selected_record_ids as string[] | undefined;
      const fields = selectedIds?.length ? allFields.filter(f => selectedIds.includes(f.id)) : allFields;
      const allSubs = sR.data || [];
      const subs = selectedRecordIds?.length ? allSubs.filter(s => selectedRecordIds.includes(s.id)) : allSubs;

      // Resolve cross-ref linked records
      const crFields = allFields.filter(f => ['cross-reference', 'child-cross-reference'].includes(f.field_type));
      const linkedIds = new Set<string>();
      for (const s of subs) {
        const d = (s as any).submission_data || {};
        for (const cf of crFields) {
          const v = d[cf.id];
          if (Array.isArray(v)) v.forEach((x: any) => { if (x?.id) linkedIds.add(x.id); });
          else if (v?.id) linkedIds.add(v.id);
        }
      }
      const linkedRecords: Record<string, any> = {};
      const linkedFieldLabels: Record<string, Record<string, string>> = {};
      if (linkedIds.size > 0) {
        const ids = Array.from(linkedIds);
        for (let i = 0; i < ids.length; i += 50) {
          const { data } = await supabase.from('form_submissions').select('id,submission_ref_id,submission_data,form_id').in('id', ids.slice(i, i + 50));
          if (data) data.forEach(r => { linkedRecords[r.id] = r; });
        }
        const formIds = [...new Set(Object.values(linkedRecords).map((r: any) => r.form_id))];
        for (const fid of formIds) {
          const { data: ff } = await supabase.from('form_fields').select('id,label,field_type').eq('form_id', fid).order('field_order');
          if (ff) {
            linkedFieldLabels[fid] = {};
            ff.filter(f => !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break', 'child-cross-reference'].includes(f.field_type))
              .forEach(f => { linkedFieldLabels[fid][f.id] = f.label; });
          }
        }
      }

      const resolveCrossRef = (v: any): string => {
        if (!v) return '\u2014';
        const resolveOne = (x: any): string => {
          if (typeof x !== 'object' || !x) return String(x);
          const rec = linkedRecords[x.id];
          if (!rec) return x.submission_ref_id || x.id?.slice(0, 8) || JSON.stringify(x);
          const refId = rec.submission_ref_id || rec.id.slice(0, 8);
          const labels = linkedFieldLabels[rec.form_id] || {};
          const sd = rec.submission_data || {};
          const parts: string[] = [];
          for (const [fi, la] of Object.entries(labels).slice(0, 4)) {
            const fv = sd[fi];
            if (fv !== null && fv !== undefined && fv !== '' && typeof fv !== 'object') parts.push(la + ': ' + fv);
            if (parts.length >= 3) break;
          }
          return parts.length > 0 ? refId + ' \u2014 ' + parts.join(' | ') : refId;
        };
        if (Array.isArray(v)) return v.map(resolveOne).filter(Boolean).join('; ') || '\u2014';
        return resolveOne(v);
      };

      const formatVal = (val: any, fType: string, opts?: any) =>
        ['cross-reference', 'child-cross-reference', 'dynamic-table'].includes(fType) ? resolveCrossRef(val) : pdfFormatValue(val, fType, opts);

      if (subs.length > 0) {
        cps.push('<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">Dynamic Data</w:t></w:r></w:p>');
        const recordNameFId2 = policy.content?.record_name_field_id as string | undefined;
        subs.forEach((s: any, i: number) => {
          const refId = s.submission_ref_id || s.id.slice(0, 8);
          const nameVal2 = recordNameFId2 ? (s.submission_data || {})[recordNameFId2] : null;
          const recordLabel2 = nameVal2 && typeof nameVal2 === 'string' && nameVal2.trim() ? nameVal2.trim() : 'Record ' + (i + 1);
          cps.push('<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">' + esc(recordLabel2 + ' \u2014 ' + refId) + '</w:t></w:r></w:p>');
          const d = s.submission_data || {};

          let tx = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' +
            '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
            '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
            '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
            '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
            '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
            '</w:tblBorders></w:tblPr>';
          tx += '<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E0E0E0"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Field</w:t></w:r></w:p></w:tc>' +
            '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E0E0E0"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Value</w:t></w:r></w:p></w:tc></w:tr>';
          fields.forEach((f: any) => {
            tx += '<w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + esc(f.label || '') + '</w:t></w:r></w:p></w:tc>' +
              '<w:tc><w:p><w:r><w:t xml:space="preserve">' + esc(formatVal(d[f.id], f.field_type, f.options)) + '</w:t></w:r></w:p></w:tc></w:tr>';
          });
          tx += '</w:tbl>';
          cps.push(tx);
          cps.push('<w:p/>');
        });
      }
    }

    // Attachments
    const visibleAttachments = (policy.attachments || []).filter((att: any) => att.show_in_pdf !== false);
    if (visibleAttachments.length > 0) {
      cps.push('<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Attachments</w:t></w:r></w:p>');
      visibleAttachments.forEach((att: any) => {
        cps.push('<w:p><w:r><w:t xml:space="preserve">\u2022 ' + esc(att.name) + (att.url ? ' \u2014 ' + esc(att.url) : '') + '</w:t></w:r></w:p>');
      });
    }

    return cps;
  };

  const downloadOriginalDocxWithContent = async () => {
    if (!policy.content?.original_docx_url) return;
    try {
      toast.info('Preparing Original DOCX with content...');
      const resp = await fetch(policy.content.original_docx_url);
      if (!resp.ok) throw new Error('Failed to fetch original DOCX');
      const arrBuf = await resp.arrayBuffer();
      const zipDoc = new PizZip(arrBuf);
      const docXmlFile = zipDoc.file('word/document.xml');
      if (!docXmlFile) throw new Error('Invalid DOCX structure');
      let xmlContent = docXmlFile.asText();

      const cps = await buildOriginalDocxContentBlocks();

      if (cps.length > 0) {
        // Try multiple patterns to find insertion point
        const bodyClosePattern = /<\/w:body>/i;
        if (bodyClosePattern.test(xmlContent)) {
          xmlContent = xmlContent.replace(bodyClosePattern, cps.join('') + '</w:body>');
        } else {
          // Fallback: try sectPr before body close
          const sectPrPattern = /(<w:sectPr[^>]*>)/;
          if (sectPrPattern.test(xmlContent)) {
            xmlContent = xmlContent.replace(sectPrPattern, cps.join('') + '$1');
          }
        }
        zipDoc.file('word/document.xml', xmlContent);
      }

      const oBlob = zipDoc.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(oBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = policy.content.original_docx_name || `${policy.policy_number || policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_original.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Original DOCX with content downloaded');
    } catch (err: any) {
      console.error('Failed to generate original DOCX with content:', err);
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    }
  };

  const downloadOriginalPdfWithContent = async () => {
    if (!policy.content?.original_docx_url) return;
    try {
      toast.info('Preparing Original PDF with content...');
      
      // Step 1: Generate the DOCX with content (same as downloadOriginalDocxWithContent but as blob)
      const resp = await fetch(policy.content.original_docx_url);
      if (!resp.ok) throw new Error('Failed to fetch original DOCX');
      const arrBuf = await resp.arrayBuffer();
      const zipDoc = new PizZip(arrBuf);
      const docXmlFile = zipDoc.file('word/document.xml');
      if (!docXmlFile) throw new Error('Invalid DOCX structure');
      let xmlContent = docXmlFile.asText();

      const cps = await buildOriginalDocxContentBlocks();
      if (cps.length > 0) {
        const bodyClosePattern = /<\/w:body>/i;
        if (bodyClosePattern.test(xmlContent)) {
          xmlContent = xmlContent.replace(bodyClosePattern, cps.join('') + '</w:body>');
        } else {
          const sectPrPattern = /(<w:sectPr[^>]*>)/;
          if (sectPrPattern.test(xmlContent)) {
            xmlContent = xmlContent.replace(sectPrPattern, cps.join('') + '$1');
          }
        }
        zipDoc.file('word/document.xml', xmlContent);
      }

      const docxBlob = zipDoc.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      // Step 2: Render DOCX with docx-preview for high-fidelity output (preserves headers, footers, styles, colors)
      const { renderAsync } = await import('docx-preview');
      const renderContainer = document.createElement('div');
      Object.assign(renderContainer.style, {
        position: 'absolute',
        left: '-9999px',
        top: '0',
        width: '794px', // A4 width in pixels at 96dpi
        background: 'white',
        overflow: 'hidden',
      });
      document.body.appendChild(renderContainer);

      const docxArrayBuffer = await docxBlob.arrayBuffer();
      await renderAsync(docxArrayBuffer, renderContainer, undefined, {
        className: 'docx-preview-pdf',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        experimental: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
      });

      // Wait for images/fonts to load
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(renderContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
      });
      document.body.removeChild(renderContainer);

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth() - 28;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxPageContent = pageHeight - 30;
      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      if (imgHeight <= maxPageContent) {
        pdf.addImage(imgData, 'PNG', 14, 14, pageWidth, imgHeight);
      } else {
        let srcY = 0;
        const srcWidth = canvas.width;
        const srcHeight = canvas.height;
        let firstPage = true;

        while (srcY < srcHeight) {
          if (!firstPage) pdf.addPage();
          const startY = firstPage ? 14 : 14;
          const availableHeight = maxPageContent - startY + 6;
          const sliceCanvasHeight = (availableHeight / pageWidth) * srcWidth;
          const actualSlice = Math.min(sliceCanvasHeight, srcHeight - srcY);

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = srcWidth;
          sliceCanvas.height = actualSlice;
          const sliceCtx = sliceCanvas.getContext('2d');
          if (sliceCtx) {
            sliceCtx.drawImage(canvas, 0, srcY, srcWidth, actualSlice, 0, 0, srcWidth, actualSlice);
            const sliceImg = sliceCanvas.toDataURL('image/png');
            const sliceImgHeight = (actualSlice * pageWidth) / srcWidth;
            pdf.addImage(sliceImg, 'PNG', 14, startY, pageWidth, sliceImgHeight);
          }

          srcY += actualSlice;
          firstPage = false;
        }
      }

      pdf.save(`${policy.policy_number || policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_original_v${policy.current_version}.pdf`);
      toast.success('Original PDF with content downloaded');
    } catch (err: any) {
      console.error('Failed to generate original PDF with content:', err);
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    }
  };

  const pdfFormatValue = (value: any, fieldType: string, options?: any): string => {
    if (value === null || value === undefined || value === '') return '—';
    // Handle cross-reference fields
    if (['cross-reference', 'child-cross-reference', 'dynamic-table'].includes(fieldType)) {
      if (Array.isArray(value)) {
        return value.map(v => {
          if (typeof v === 'object' && v !== null) {
            const refId = v.submission_ref_id || v.id?.slice(0, 8) || '';
            const parts: string[] = [];
            if (refId) parts.push(refId);
            if (v.displayData) parts.push(String(v.displayData));
            else if (v.name) parts.push(v.name);
            else if (v.label) parts.push(v.label);
            else if (v.submission_data && typeof v.submission_data === 'object') {
              const vals = Object.values(v.submission_data).filter(
                (x: any) => x !== null && x !== undefined && x !== '' && typeof x !== 'object'
              ).slice(0, 3);
              if (vals.length > 0) parts.push(...vals.map(String));
            }
            return parts.length > 0 ? parts.join(' — ') : JSON.stringify(v);
          }
          return String(v);
        }).filter(Boolean).join(', ') || '—';
      }
      if (typeof value === 'object' && value !== null) {
        const refId = value.submission_ref_id || value.id?.slice(0, 8) || '';
        const parts: string[] = [];
        if (refId) parts.push(refId);
        if (value.displayData) parts.push(String(value.displayData));
        else if (value.name) parts.push(value.name);
        else if (value.label) parts.push(value.label);
        return parts.length > 0 ? parts.join(' — ') : JSON.stringify(value);
      }
      return String(value);
    }
    if (['select', 'radio', 'checkbox', 'dropdown'].includes(fieldType) && options) {
      const arr = Array.isArray(options) ? options : [];
      if (Array.isArray(value)) {
        return value.map(v => { const o = arr.find((x: any) => x.value === v || x.id === v || x.label === v); return o?.label || v; }).join(', ') || '—';
      }
      const o = arr.find((x: any) => x.value === value || x.id === value || x.label === value);
      if (o?.label) return o.label;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
      if (fieldType === 'address') return [value.street, value.city, value.state, value.postal, value.country].filter(Boolean).join(', ');
      if (value.submission_ref_id) return value.submission_ref_id;
      if (value.label) return value.label;
      if (value.name) return value.name;
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return value.map(v => typeof v === 'object' ? (v?.submission_ref_id || v?.label || JSON.stringify(v)) : String(v)).join(', ');
    if (fieldType === 'date' || fieldType === 'datetime') { try { return new Date(value).toLocaleDateString(); } catch { return String(value); } }
    return String(value);
  };

  const statusDef = POLICY_STATUSES.find(s => s.value === policy.status);
  const priorityDef = POLICY_PRIORITIES.find(p => p.value === (policy.priority || 'medium'));
  const isOverdueReview = policy.next_review_date && isPast(new Date(policy.next_review_date));

  // Folder-level access control (view/edit/admin based on knowledge_base_folder_access)
  const { canEdit, canAdmin, isLoading: permLoading } = useKnowledgeBasePermission(policy.folder_id);
  const isDesignatedApprover = (approvalId: string) => {
    const approval = approvals.find(a => a.id === approvalId);
    return approval?.approver_id === user?.id;
  };
  const hasAnyPendingApprovalForMe = approvals.some(a => a.status === 'pending' && a.approver_id === user?.id);

  const getUserName = (userId: string) => {
    const u = usersQuery.data?.find(u => u.id === userId);
    if (u) return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
    return userId.slice(0, 8) + '...';
  };

  return (
    <div className="flex-1 overflow-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <span>{policy.description || 'No description'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Users className="h-3 w-3" />
              <span>Owner: <span className="font-medium text-foreground">{getUserName(policy.created_by)}</span></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {policy.content?.original_docx_url && (
                <DropdownMenuItem onClick={downloadOriginalDocxWithContent}>
                  <FileDown className="h-4 w-4 mr-2" /> Download Original DOCX (with Content)
                </DropdownMenuItem>
              )}
              {policy.content?.original_docx_url && (
                <DropdownMenuItem onClick={downloadOriginalPdfWithContent}>
                  <FileDown className="h-4 w-4 mr-2" /> Download Original PDF (with Content)
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={exportToPDF}>
                <FileDown className="h-4 w-4 mr-2" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToDocx}>
                <FileDown className="h-4 w-4 mr-2" /> Export as DOCX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && policy.status === 'draft' && (
            <>
              <Button variant="outline" size="sm" onClick={() => clonePolicy.mutateAsync(policy.id)}>
                <FileText className="h-4 w-4 mr-1" /> Clone
              </Button>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              {/* <Button size="sm" onClick={() => setShowApprovalDialog(true)}>
                <Send className="h-4 w-4 mr-1" /> Submit for Approval
              </Button> */}
              <Button size="sm" variant="default" onClick={async () => {
                await updatePolicy.mutateAsync({
                  id: policy.id,
                  status: 'published',
                  published_at: new Date().toISOString(),
                });
                if (policy.review_cycle_days && policy.review_cycle_days > 0) {
                  const reviewDate = new Date();
                  reviewDate.setDate(reviewDate.getDate() + policy.review_cycle_days);
                  await createReviewCycle.mutateAsync({
                    policy_id: policy.id,
                    review_date: reviewDate.toISOString().split('T')[0],
                    status: 'scheduled',
                  });
                }
                toast.success('Document published successfully');
              }}>
                <CheckCircle className="h-4 w-4 mr-1" /> Publish
              </Button>
            </>
          )}
          {policy.status === 'pending_approval' && (() => {
            const { approvedCount, rejectedCount, pendingCount, mode, isReadyForPublish } = getApprovalStatus();
            const label = rejectedCount > 0
              ? 'Rejected'
              : isReadyForPublish
                ? 'Ready for Publish'
                : approvedCount > 0 && pendingCount > 0
                  ? `${approvedCount}/${approvals.length} Approved`
                  : 'Awaiting Approval';
            const variant = rejectedCount > 0 ? 'destructive' as const : isReadyForPublish ? 'default' as const : 'outline' as const;
            const Icon = rejectedCount > 0 ? AlertOctagon : isReadyForPublish ? CheckCircle : approvedCount > 0 ? CheckCircle : Clock;
            return (
              <>
                <Badge variant={variant} className="gap-1 text-sm py-1 px-3">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Badge>
                {isReadyForPublish && canEdit && (
                  <Button size="sm" variant="default" onClick={async () => {
                    await updatePolicy.mutateAsync({
                      id: policy.id,
                      status: 'published',
                      published_at: new Date().toISOString(),
                    });
                    if (policy.review_cycle_days && policy.review_cycle_days > 0) {
                      const reviewDate = new Date();
                      reviewDate.setDate(reviewDate.getDate() + policy.review_cycle_days);
                      await createReviewCycle.mutateAsync({
                        policy_id: policy.id,
                        review_date: reviewDate.toISOString().split('T')[0],
                        status: 'scheduled',
                      });
                    }
                    toast.success('Document published successfully');
                  }}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Publish
                  </Button>
                )}
              </>
            );
          })()}
          {canEdit && policy.status === 'published' && (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                await updatePolicy.mutateAsync({ id: policy.id, status: 'draft' });
                toast.success('Document moved back to draft');
              }}>
                <RotateCcw className="h-4 w-4 mr-1" /> Back to Draft
              </Button>
              <Button variant="outline" size="sm" onClick={retirePolicy}>
                <Archive className="h-4 w-4 mr-1" /> Retire
              </Button>
            </>
          )}
          {canEdit && policy.status === 'retired' && (
            <Button variant="outline" size="sm" onClick={async () => {
              await updatePolicy.mutateAsync({ id: policy.id, status: 'draft' });
              toast.success('Document moved back to draft');
            }}>
              <Edit className="h-4 w-4 mr-1" /> Reopen as Draft
            </Button>
          )}
          {canAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this document and all its versions. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-sm">Edit Document</CardTitle>
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
              <div className="col-span-2">
                <Label>Policy Content</Label>
                <TiptapEditor
                  content={editForm.content_html || ''}
                  onChange={(html) => setEditForm((p: any) => ({ ...p, content_html: html }))}
                  placeholder="Write the full policy content..."
                  className="min-h-[150px]"
                />
              </div>

              {/* Add / Edit Custom Fields */}
              <div className="col-span-2">
                <Label className="mb-2 block">Custom Fields</Label>
                <PolicyCustomFieldsBuilder
                  fields={editForm.custom_fields || []}
                  onFieldsChange={(fields) => setEditForm((p: any) => ({ ...p, custom_fields: fields }))}
                />
              </div>

              {/* Editable Custom Field Values */}
              {(editForm.custom_fields || []).length > 0 && (
                <div className="col-span-2">
                  <Label className="mb-2 block">Custom Field Values</Label>
                  <PolicyCustomFieldsRenderer
                    fields={editForm.custom_fields}
                    values={editForm.custom_field_values || {}}
                    onChange={(vals) => setEditForm((p: any) => ({ ...p, custom_field_values: vals }))}
                    readOnly={false}
                  />
                </div>
              )}

              <div className="col-span-2">
                <Label>Change Summary</Label>
                <Input value={changeSummary} onChange={e => setChangeSummary(e.target.value)} placeholder="What changed?" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={() => setShowSaveConfirmDialog(true)} disabled={updatePolicy.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save Changes
              </Button>
            </div>

            {/* Save Confirmation Dialog */}
            <AlertDialog open={showSaveConfirmDialog} onOpenChange={setShowSaveConfirmDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save Document Changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a new version (v{(policy.current_version || 0) + 1}) of this document. The current version will be saved to version history.
                    {changeSummary && (
                      <span className="block mt-2 text-foreground font-medium">Change summary: "{changeSummary}"</span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={saveChanges} disabled={updatePolicy.isPending}>
                    {updatePolicy.isPending ? 'Saving...' : 'Confirm & Save'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="content">
        <TabsList className="flex-wrap">
          <TabsTrigger value="content" className="gap-1">
            <BookOpen className="h-3.5 w-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Approvals ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1">
            <History className="h-3.5 w-3.5" /> Versions ({versions.length})
          </TabsTrigger>
        </TabsList>

        {/* Content Tab - Draggable sections */}
        <TabsContent value="content" className="mt-4 space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Drag sections to reorder. Export will follow this order.</p>
          <DragDropContext onDragEnd={handleSectionDragEnd}>
            <Droppable droppableId="content-sections">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                  {sectionOrder.map((sectionId, index) => (
                    <Draggable key={sectionId} draggableId={sectionId} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30 rounded-lg' : ''}`}
                        >
                          {sectionId === 'metadata' && (
                            <Card>
                              <CardHeader className="flex flex-row items-center gap-2 py-3 px-4">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <CardTitle className="text-sm flex-1">Dates & Metadata</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm px-4 pb-4 pt-0">
                                <DetailRow label="Created" value={format(new Date(policy.created_at), 'PPpp')} />
                                <DetailRow label="Last Updated" value={format(new Date(policy.updated_at), 'PPpp')} />
                                {policy.effective_date && <DetailRow label="Effective Date" value={policy.effective_date} />}
                                {policy.expiry_date && <DetailRow label="Expiry Date" value={policy.expiry_date} />}
                                {policy.next_review_date && <DetailRow label="Next Review" value={policy.next_review_date} />}
                                {policy.published_at && <DetailRow label="Published" value={format(new Date(policy.published_at), 'PPpp')} />}
                                <DetailRow label="Doc Number" value={policy.policy_number || '—'} />
                                <DetailRow label="Priority" value={<Badge className={priorityDef?.color}>{priorityDef?.label}</Badge>} />
                                <DetailRow label="Owner" value={getUserName(policy.created_by)} />
                                <DetailRow label="Version" value={`v${policy.current_version}`} />
                              </CardContent>
                            </Card>
                          )}

                          {sectionId === 'document_content' && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-semibold text-foreground">Document Content</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setContentExpanded(!contentExpanded)}
                                  className="gap-1 text-xs ml-auto"
                                >
                                  {contentExpanded ? <><EyeOff className="h-3.5 w-3.5" /> Collapse</> : <><Eye className="h-3.5 w-3.5" /> Expand</>}
                                </Button>
                              </div>
                              {contentExpanded && (
                                <>
                                  {(liveContentHtml ?? policy.content?.html) ? (
                                    <div className="border rounded-lg overflow-hidden bg-white">
                                      <iframe
                                        title="Document Content Preview"
                                        srcDoc={`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    font-family: 'Segoe UI', 'Calibri', Arial, Helvetica, sans-serif;
    font-size: 13px; line-height: 1.7; color: #1a1a1a;
    padding: 32px 40px; margin: 0; background: #fff;
  }
  h1, h2, h3, h4, h5, h6 { color: #111; margin-top: 1.2em; margin-bottom: 0.4em; }
  h1 { font-size: 1.8em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
  h2 { font-size: 1.4em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
  h3 { font-size: 1.2em; }
  p { margin: 0.5em 0; }
  ul, ol { padding-left: 1.8em; margin: 0.5em 0; }
  li { margin: 0.2em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 12px; }
  th { background: #f3f4f6; font-weight: 600; }
  tr:nth-child(even) { background: #f9fafb; }
  img { max-width: 100%; height: auto; margin: 0.5em 0; }
  blockquote { border-left: 3px solid #6366f1; padding: 8px 16px; margin: 1em 0; background: #f5f3ff; color: #374151; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  a { color: #4f46e5; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
  strong { font-weight: 600; }
</style>
</head>
<body>${(liveContentHtml ?? policy.content?.html ?? '').replace(/\x60/g, '&#96;')}</body>
</html>`}
                                        className="w-full border-0"
                                        style={{ minHeight: '500px', height: '70vh' }}
                                        onLoad={(e) => {
                                          const iframe = e.target as HTMLIFrameElement;
                                          if (iframe.contentDocument?.body) {
                                            const h = iframe.contentDocument.body.scrollHeight + 40;
                                            iframe.style.height = Math.max(400, Math.min(h, 2000)) + 'px';
                                          }
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
                                      No content has been added yet. Click "Edit" to add content.
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {sectionId === 'custom_fields' && policy.content?.custom_fields && (policy.content.custom_fields as any[]).length > 0 && (() => {
                            const fields = (policy.content.custom_fields as any[]).filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type));
                            const vals = (policy.content?.custom_field_values as Record<string, any>) || {};
                            if (fields.length === 0) return null;
                            return (
                              <Card>
                                <CardHeader className="flex flex-row items-center gap-2 py-3 px-4">
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <CardTitle className="text-sm flex-1">Custom Fields Data</CardTitle>
                                  <Select
                                    value={String(customFieldColumns)}
                                    onValueChange={async v => {
                                      const cols = Number(v);
                                      setCustomFieldColumns(cols);
                                      await updatePolicy.mutateAsync({
                                        id: policy.id,
                                        content: { ...(policy.content || {}), custom_field_columns: cols },
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-[120px] h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1">1 Column</SelectItem>
                                      <SelectItem value="2">2 Columns</SelectItem>
                                      <SelectItem value="3">3 Columns</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <span className="text-[10px] text-muted-foreground">Drag to reorder</span>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0">
                                  <DragDropContext onDragEnd={handleCustomFieldDragEnd}>
                                    <Droppable droppableId="custom-fields-list">
                                      {(cfProvided) => (
                                        <div ref={cfProvided.innerRef} {...cfProvided.droppableProps}>
                                          {customFieldColumns > 1 ? (
                                            <div className={`grid gap-3 ${customFieldColumns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                              {fields.sort((a: any, b: any) => a.order - b.order).map((field: any, fIdx: number) => {
                                                const raw = vals[field.id];
                                                let display = '—';
                                                if (raw !== null && raw !== undefined && raw !== '') {
                                                  if (Array.isArray(raw)) {
                                                    const opts = field.options || [];
                                                    display = raw.map((v: string) => opts.find((o: any) => o.value === v)?.label || v).join(', ') || '—';
                                                  } else if (typeof raw === 'boolean') {
                                                    display = raw ? 'Yes' : 'No';
                                                  } else if (field.type === 'rating') {
                                                    display = '★'.repeat(Number(raw));
                                                  } else if ((field.type === 'select' || field.type === 'radio') && field.options) {
                                                    display = field.options.find((o: any) => o.value === raw)?.label || String(raw);
                                                  } else {
                                                    display = String(raw);
                                                  }
                                                }
                                                return (
                                                  <Draggable key={field.id} draggableId={`cf-${field.id}`} index={fIdx}>
                                                    {(cfDrag, cfSnap) => (
                                                      <div
                                                        ref={cfDrag.innerRef}
                                                        {...cfDrag.draggableProps}
                                                        className={`p-3 border rounded-md ${cfSnap.isDragging ? 'bg-primary/5 shadow' : 'bg-muted/20'}`}
                                                      >
                                                        <div className="flex items-center gap-1 mb-1">
                                                          <div {...cfDrag.dragHandleProps}>
                                                            <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                                                          </div>
                                                          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
                                                        </div>
                                                        <p className="text-sm font-medium">{display}</p>
                                                      </div>
                                                    )}
                                                  </Draggable>
                                                );
                                              })}
                                              {cfProvided.placeholder}
                                            </div>
                                          ) : (
                                          <table className="w-full text-sm border-collapse">
                                            <thead>
                                              <tr className="border-b bg-muted/50">
                                                <th className="w-8"></th>
                                                <th className="text-left p-2 font-medium text-muted-foreground">Field</th>
                                                <th className="text-left p-2 font-medium text-muted-foreground">Value</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {fields.sort((a: any, b: any) => a.order - b.order).map((field: any, fIdx: number) => {
                                                const raw = vals[field.id];
                                                let display = '—';
                                                if (raw !== null && raw !== undefined && raw !== '') {
                                                  if (Array.isArray(raw)) {
                                                    const opts = field.options || [];
                                                    display = raw.map((v: string) => opts.find((o: any) => o.value === v)?.label || v).join(', ') || '—';
                                                  } else if (typeof raw === 'boolean') {
                                                    display = raw ? 'Yes' : 'No';
                                                  } else if (field.type === 'rating') {
                                                    display = '★'.repeat(Number(raw));
                                                  } else if ((field.type === 'select' || field.type === 'radio') && field.options) {
                                                    display = field.options.find((o: any) => o.value === raw)?.label || String(raw);
                                                  } else {
                                                    display = String(raw);
                                                  }
                                                }
                                                return (
                                                  <Draggable key={field.id} draggableId={`cf-${field.id}`} index={fIdx}>
                                                    {(cfDrag, cfSnap) => (
                                                      <tr
                                                        ref={cfDrag.innerRef}
                                                        {...cfDrag.draggableProps}
                                                        className={`border-b ${cfSnap.isDragging ? 'bg-primary/5 shadow' : ''}`}
                                                      >
                                                        <td className="p-1 w-8" {...cfDrag.dragHandleProps}>
                                                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                                                        </td>
                                                        <td className="p-2 font-medium">{field.label}</td>
                                                        <td className="p-2">{display}</td>
                                                      </tr>
                                                    )}
                                                  </Draggable>
                                                );
                                              })}
                                              {cfProvided.placeholder}
                                            </tbody>
                                          </table>
                                          )}
                                        </div>
                                      )}
                                    </Droppable>
                                  </DragDropContext>
                                </CardContent>
                              </Card>
                            );
                          })()}

                          {sectionId === 'dynamic_fields' && policy.form_id && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground flex-1">Dynamic Fields Display</span>
                                <Select
                                  value={String(dynamicFieldColumns)}
                                  onValueChange={async v => {
                                    const cols = Number(v);
                                    setDynamicFieldColumns(cols);
                                    await updatePolicy.mutateAsync({
                                      id: policy.id,
                                      content: { ...(policy.content || {}), dynamic_field_columns: cols },
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[120px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 Column</SelectItem>
                                    <SelectItem value="2">2 Columns</SelectItem>
                                    <SelectItem value="3">3 Columns</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={dynamicFieldsFormat}
                                  onValueChange={v => setDynamicFieldsFormat(v as 'table' | 'field-value')}
                                >
                                  <SelectTrigger className="w-[150px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="table">Tabular Format</SelectItem>
                                    <SelectItem value="field-value">Field & Value</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <PolicyDynamicFieldsRenderer
                                formId={policy.form_id}
                                displayFormat={dynamicFieldsFormat}
                                selectedFieldIds={policy.content?.selected_field_ids as string[] | undefined}
                                selectedRecordIds={policy.content?.selected_record_ids as string[] | undefined}
                                recordNameFieldId={policy.content?.record_name_field_id as string | undefined}
                                exportColumns={dynamicFieldColumns}
                                recordComments={(policy.content?.record_comments as Record<string, any>) || {}}
                                onAddComment={canEdit ? async (recordId, comment) => {
                                  const existing = (policy.content?.record_comments as Record<string, any[]>) || {};
                                  const updated = { ...existing, [recordId]: [...(existing[recordId] || []), comment] };
                                  await updatePolicy.mutateAsync({
                                    id: policy.id,
                                    content: { ...(policy.content || {}), record_comments: updated },
                                  });
                                } : undefined}
                                currentUserName={getUserName(user?.id || '')}
                              />
                            </div>
                          )}

                          {sectionId === 'attachments' && (
                            <Card>
                              <CardHeader className="flex flex-row items-center gap-2 py-3 px-4">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <CardTitle className="text-sm flex-1">Attachments</CardTitle>
                                {canEdit && (
                                  <div>
                                    <input
                                      ref={attachmentInputRef}
                                      type="file"
                                      className="hidden"
                                      onChange={handleAttachmentUpload}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => attachmentInputRef.current?.click()}
                                      disabled={isUploadingAttachment}
                                    >
                                      {isUploadingAttachment ? (
                                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading...</>
                                      ) : (
                                        <><Upload className="h-4 w-4 mr-1" /> Upload</>
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </CardHeader>
                              <CardContent className="px-4 pb-4 pt-0">
                                {(!policy.attachments || policy.attachments.length === 0) ? (
                                  <p className="text-sm text-muted-foreground">No attachments.{canEdit ? ' Click "Upload" to add files.' : ''}</p>
                                ) : (
                                  <div className="space-y-2">
                                    {policy.attachments.map((att: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md border">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="flex-1 truncate">{att.name}</span>
                                        {att.size && <span className="text-xs text-muted-foreground shrink-0">{(att.size / 1024).toFixed(1)} KB</span>}
                                        {canEdit && (
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Include in PDF export">
                                              <span>PDF</span>
                                              <Switch
                                                checked={att.show_in_pdf !== false}
                                                onCheckedChange={async (checked) => {
                                                  const updated = [...policy.attachments];
                                                  updated[i] = { ...updated[i], show_in_pdf: checked };
                                                  await updatePolicy.mutateAsync({ id: policy.id, attachments: updated as any });
                                                }}
                                                className="scale-75"
                                              />
                                            </label>
                                          </div>
                                        )}
                                        {att.url && (
                                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                                            <Download className="h-3.5 w-3.5" />
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}

                          {/* For sections that don't match (custom_fields with no data, dynamic_fields with no form), render nothing but keep draggable */}
                          {sectionId === 'custom_fields' && (!policy.content?.custom_fields || (policy.content.custom_fields as any[]).filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type)).length === 0) && null}
                          {sectionId === 'dynamic_fields' && !policy.form_id && null}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Approval Flow</p>
                {policy.status === 'draft' && (
                  <Button size="sm" onClick={() => setShowApprovalDialog(true)}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Submit for Approval
                  </Button>
                )}
              </div>
              <PolicyApprovalFlow
                approvals={approvals}
                policyStatus={policy.status}
                approvalMode={(policy.content?.approval_mode as ApprovalMode) || 'any_one'}
                currentUserId={user?.id}
                getUserName={getUserName}
                onApprove={(id, comment) => handleApprovalResponse(id, 'approved', comment)}
                onReject={(id, comment) => handleApprovalResponse(id, 'rejected', comment)}
                isPending={respondApproval.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reviews Tab - with inner Pre/Post sub-tabs */}
        <TabsContent value="reviews" className="mt-4">
          <Tabs defaultValue="pre-review">
            <TabsList>
              <TabsTrigger value="pre-review" className="gap-1">
                <Eye className="h-3.5 w-3.5" /> Pre-Review
              </TabsTrigger>
              <TabsTrigger value="post-review" className="gap-1">
                <Shield className="h-3.5 w-3.5" /> Post-Review
              </TabsTrigger>
            </TabsList>

            {/* Pre-Review Sub-Tab */}
            <TabsContent value="pre-review" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" /> Pre-Reviewers
                  </CardTitle>
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setShowPreReviewDialog(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Assign Pre-Reviewers
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {(() => {
                    const preReviewers = (policy.content?.pre_reviewers as Array<{ id: string; type: 'user' | 'group'; comment?: string; status?: string; reviewed_at?: string; review_comment?: string }>) || [];
                    if (preReviewers.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-4">No pre-reviewers assigned. Pre-reviewers can review the document before it goes for approval.</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {preReviewers.map((r, i) => {
                          const name = r.type === 'user' ? getUserName(r.id) : (groupsQuery.data?.find(g => g.id === r.id)?.name || r.id.slice(0, 8));
                          const commentKey = `pre-${i}`;
                          return (
                            <div key={i} className={`p-3 rounded-md border space-y-2 ${r.status === 'reviewed' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-muted'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {r.status === 'reviewed' ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                                  <Badge variant="outline" className="text-[10px]">{r.type === 'user' ? 'User' : 'Group'}</Badge>
                                  <span className="text-sm font-medium">{name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={r.status === 'reviewed' ? 'default' : 'secondary'} className="text-[10px]">
                                    {r.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                                  </Badge>
                                  {r.reviewed_at && <span className="text-xs text-muted-foreground">{format(new Date(r.reviewed_at), 'MMM d, yyyy HH:mm')}</span>}
                                </div>
                              </div>
                              {r.review_comment && (
                                <div className="text-xs bg-background/60 rounded p-2 border">
                                  <span className="font-medium">Review Comment:</span> {r.review_comment}
                                </div>
                              )}
                              {r.comment && (
                                <div className="text-xs text-muted-foreground italic">Assignment note: "{r.comment}"</div>
                              )}
                              {r.status !== 'reviewed' && r.type === 'user' && r.id === user?.id && (
                                <div className="space-y-2 pt-1" onClick={e => e.stopPropagation()}>
                                  <Textarea
                                    placeholder="Add your review comment..."
                                    value={reviewCommentMap[commentKey] || ''}
                                    onChange={e => setReviewCommentMap(prev => ({ ...prev, [commentKey]: e.target.value }))}
                                    className="text-sm min-h-[60px] bg-background"
                                    rows={2}
                                  />
                                  <Button size="sm" onClick={async () => {
                                    const updated = [...preReviewers];
                                    updated[i] = { ...updated[i], status: 'reviewed', reviewed_at: new Date().toISOString(), review_comment: reviewCommentMap[commentKey] || '' };
                                    await updatePolicy.mutateAsync({
                                      id: policy.id,
                                      content: { ...(policy.content || {}), pre_reviewers: updated },
                                    });
                                    setReviewCommentMap(prev => { const n = { ...prev }; delete n[commentKey]; return n; });
                                    toast.success('Pre-review completed');
                                  }}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Submit Review
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" /> Review Cycles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PolicyReviewFlow
                    reviewCycles={reviewCycles}
                    policyStatus={policy.status}
                    currentUserId={user?.id}
                    getUserName={getUserName}
                    onCompleteReview={async (cycleId, findings, outcome) => {
                      await completeReviewCycle.mutateAsync({ cycleId, findings, outcome });
                      if (outcome !== 'retire' && policy.review_cycle_days) {
                        const nextDate = new Date();
                        nextDate.setDate(nextDate.getDate() + policy.review_cycle_days);
                        await createReviewCycle.mutateAsync({
                          policy_id: policy.id,
                          review_date: nextDate.toISOString().split('T')[0],
                          status: 'scheduled',
                        });
                      }
                    }}
                    isPending={completeReviewCycle.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Post-Review Sub-Tab */}
            <TabsContent value="post-review" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Post-Reviewers
                  </CardTitle>
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setShowPostReviewDialog(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Assign Post-Reviewers
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {(() => {
                    const postReviewers = (policy.content?.post_reviewers as Array<{ id: string; type: 'user' | 'group'; comment?: string; status?: string; reviewed_at?: string; review_comment?: string }>) || [];
                    if (postReviewers.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-4">No post-reviewers assigned. Post-reviewers validate the document after it has been published.</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {postReviewers.map((r, i) => {
                          const name = r.type === 'user' ? getUserName(r.id) : (groupsQuery.data?.find(g => g.id === r.id)?.name || r.id.slice(0, 8));
                          const commentKey = `post-${i}`;
                          return (
                            <div key={i} className={`p-3 rounded-md border space-y-2 ${r.status === 'reviewed' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-muted'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {r.status === 'reviewed' ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                                  <Badge variant="outline" className="text-[10px]">{r.type === 'user' ? 'User' : 'Group'}</Badge>
                                  <span className="text-sm font-medium">{name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={r.status === 'reviewed' ? 'default' : 'secondary'} className="text-[10px]">
                                    {r.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                                  </Badge>
                                  {r.reviewed_at && <span className="text-xs text-muted-foreground">{format(new Date(r.reviewed_at), 'MMM d, yyyy HH:mm')}</span>}
                                </div>
                              </div>
                              {r.review_comment && (
                                <div className="text-xs bg-background/60 rounded p-2 border">
                                  <span className="font-medium">Review Comment:</span> {r.review_comment}
                                </div>
                              )}
                              {r.comment && (
                                <div className="text-xs text-muted-foreground italic">Assignment note: "{r.comment}"</div>
                              )}
                              {r.status !== 'reviewed' && r.type === 'user' && r.id === user?.id && (
                                <div className="space-y-2 pt-1" onClick={e => e.stopPropagation()}>
                                  <Textarea
                                    placeholder="Add your review comment..."
                                    value={reviewCommentMap[commentKey] || ''}
                                    onChange={e => setReviewCommentMap(prev => ({ ...prev, [commentKey]: e.target.value }))}
                                    className="text-sm min-h-[60px] bg-background"
                                    rows={2}
                                  />
                                  <Button size="sm" onClick={async () => {
                                    const updated = [...postReviewers];
                                    updated[i] = { ...updated[i], status: 'reviewed', reviewed_at: new Date().toISOString(), review_comment: reviewCommentMap[commentKey] || '' };
                                    await updatePolicy.mutateAsync({
                                      id: policy.id,
                                      content: { ...(policy.content || {}), post_reviewers: updated },
                                    });
                                    setReviewCommentMap(prev => { const n = { ...prev }; delete n[commentKey]; return n; });
                                    toast.success('Post-review completed');
                                  }}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Submit Review
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" /> Review Cycles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PolicyReviewFlow
                    reviewCycles={reviewCycles}
                    policyStatus={policy.status}
                    currentUserId={user?.id}
                    getUserName={getUserName}
                    onCompleteReview={async (cycleId, findings, outcome) => {
                      await completeReviewCycle.mutateAsync({ cycleId, findings, outcome });
                      if (outcome !== 'retire' && policy.review_cycle_days) {
                        const nextDate = new Date();
                        nextDate.setDate(nextDate.getDate() + policy.review_cycle_days);
                        await createReviewCycle.mutateAsync({
                          policy_id: policy.id,
                          review_date: nextDate.toISOString().split('T')[0],
                          status: 'scheduled',
                        });
                      }
                    }}
                    isPending={completeReviewCycle.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions" className="mt-4 space-y-4">
          {/* Version Diff */}
          {versions.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-4">Compare Versions</p>
                <PolicyVersionDiff
                  versions={versions}
                  currentContent={policy.content}
                  currentVersion={policy.current_version}
                  policyName={policy.name}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium mb-4">Version History</p>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No versions yet. Versions are created when you edit and save changes.</p>
              ) : (
                <div className="space-y-3">
                  {versions.map(v => (
                    <div key={v.id} className="p-3 rounded-md border space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">v{v.version_number}</Badge>
                          <span className="text-sm font-medium">{v.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{format(new Date(v.changed_at), 'MMM d, yyyy HH:mm')}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => generateVersionPDF(v, 'preview')}>
                                <FileText className="h-4 w-4 mr-2" /> Preview PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generateVersionPDF(v, 'download')}>
                                <FileDown className="h-4 w-4 mr-2" /> Download PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {v.change_summary && <p className="text-xs text-muted-foreground">{v.change_summary}</p>}
                      <p className="text-xs text-muted-foreground">Changed by: {getUserName(v.changed_by)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Submit for Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Approval Mode */}
            <div>
              <Label className="mb-2 block">Approval Mode *</Label>
              <RadioGroup value={approvalMode} onValueChange={(v) => setApprovalMode(v as ApprovalMode)} className="space-y-2">
                <div className="flex items-start gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/50" onClick={() => setApprovalMode('any_one')}>
                  <RadioGroupItem value="any_one" id="mode_any" className="mt-0.5" />
                  <div>
                    <label htmlFor="mode_any" className="text-sm font-medium cursor-pointer">Any One Approves</label>
                    <p className="text-xs text-muted-foreground">First approval will publish the policy</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/50" onClick={() => setApprovalMode('all')}>
                  <RadioGroupItem value="all" id="mode_all" className="mt-0.5" />
                  <div>
                    <label htmlFor="mode_all" className="text-sm font-medium cursor-pointer">All Must Approve</label>
                    <p className="text-xs text-muted-foreground">Every approver must approve before publishing</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Select Approver(s) — Users *</Label>
              <p className="text-xs text-muted-foreground mb-2">Choose users or groups who should approve this policy.</p>
              <div className="border rounded-md max-h-[160px] overflow-y-auto">
                {(usersQuery.data || []).filter(u => u.id !== user?.id).map(u => {
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
                  const isSelected = selectedApproverIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => {
                        setSelectedApproverIds(prev =>
                          isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        );
                      }}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{u.role}</Badge>
                    </div>
                  );
                })}
                {(usersQuery.data || []).filter(u => u.id !== user?.id).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No other users available</p>
                )}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Select Approver Groups</Label>
              <div className="border rounded-md max-h-[120px] overflow-y-auto">
                {(groupsQuery.data || []).map(g => {
                  const isSelected = selectedApproverIds.includes(`group:${g.id}`);
                  return (
                    <div key={g.id} className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedApproverIds(prev => isSelected ? prev.filter(id => id !== `group:${g.id}`) : [...prev, `group:${g.id}`])}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm font-medium">{g.name}</span>
                      <Badge variant="outline" className="text-[10px]">Group</Badge>
                    </div>
                  );
                })}
                {(groupsQuery.data || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No groups available</p>}
              </div>
              {selectedApproverIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{selectedApproverIds.length} approver(s) selected</p>
              )}
            </div>
            <div>
              <Label>Comment (optional)</Label>
              <Textarea
                value={approvalSubmitComment}
                onChange={e => setApprovalSubmitComment(e.target.value)}
                placeholder="Add a note for the approver(s)..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitForApproval} disabled={selectedApproverIds.length === 0 || submitApproval.isPending}>
              {submitApproval.isPending ? 'Submitting...' : `Submit to ${selectedApproverIds.length} Approver(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Linkage Dialog - Simplified */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>What do you want to link?</Label>
              <Select
                value={linkForm.linked_entity_type}
                onValueChange={v => setLinkForm(p => ({ ...p, linked_entity_type: v as any, linked_entity_id: '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="form">Form</SelectItem>
                  <SelectItem value="policy">Another Policy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select {linkForm.linked_entity_type === 'form' ? 'Form' : 'Policy'}</Label>
              {getLinkableEntities().length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No {linkForm.linked_entity_type === 'form' ? 'forms' : 'policies'} available</p>
              ) : (
                <Select value={linkForm.linked_entity_id} onValueChange={v => setLinkForm(p => ({ ...p, linked_entity_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={`Choose a ${linkForm.linked_entity_type}...`} /></SelectTrigger>
                  <SelectContent>
                    {getLinkableEntities().map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2">
                          {e.label}
                          {e.badge && <Badge variant="outline" className="text-[10px] py-0">{e.badge}</Badge>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={linkForm.link_description} onChange={e => setLinkForm(p => ({ ...p, link_description: e.target.value }))} placeholder="e.g., Related compliance form" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateLinkage} disabled={!linkForm.linked_entity_id || createLinkage.isPending}>
              {createLinkage.isPending ? 'Linking...' : 'Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Review Assignment Dialog */}
      <Dialog open={showPreReviewDialog} onOpenChange={setShowPreReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Pre-Reviewers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Select Users</Label>
              <div className="border rounded-md max-h-[180px] overflow-y-auto">
                {(usersQuery.data || []).filter(u => u.id !== user?.id).map(u => {
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
                  const isSelected = preReviewerIds.includes(`user:${u.id}`);
                  return (
                    <div key={u.id} className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => setPreReviewerIds(prev => isSelected ? prev.filter(id => id !== `user:${u.id}`) : [...prev, `user:${u.id}`])}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">User</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Select Groups</Label>
              <div className="border rounded-md max-h-[120px] overflow-y-auto">
                {(groupsQuery.data || []).map(g => {
                  const isSelected = preReviewerIds.includes(`group:${g.id}`);
                  return (
                    <div key={g.id} className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => setPreReviewerIds(prev => isSelected ? prev.filter(id => id !== `group:${g.id}`) : [...prev, `group:${g.id}`])}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm font-medium">{g.name}</span>
                      <Badge variant="outline" className="text-[10px]">Group</Badge>
                    </div>
                  );
                })}
                {(groupsQuery.data || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No groups available</p>}
              </div>
            </div>
            <div>
              <Label>Comment (optional)</Label>
              <Textarea value={preReviewComment} onChange={e => setPreReviewComment(e.target.value)} rows={2} placeholder="Add a note..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreReviewDialog(false)}>Cancel</Button>
            <Button disabled={preReviewerIds.length === 0} onClick={async () => {
              const existing = (policy.content?.pre_reviewers as any[]) || [];
              const newReviewers = preReviewerIds.map(key => {
                const [type, id] = key.split(':');
                return { id, type, status: 'pending', comment: preReviewComment || undefined };
              });
              // Deduplicate: skip already-assigned reviewers
              const existingKeys = new Set(existing.map((r: any) => `${r.type}:${r.id}`));
              const uniqueNew = newReviewers.filter(r => !existingKeys.has(`${r.type}:${r.id}`));
              await updatePolicy.mutateAsync({
                id: policy.id,
                content: { ...(policy.content || {}), pre_reviewers: [...existing, ...uniqueNew] },
              });
              // Send notifications to user-type reviewers
              const senderName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || userProfile?.email || '';
              const orgId = currentOrganization?.id || userProfile?.organization_id || '';
              for (const r of uniqueNew) {
                if (r.type === 'user') {
                  await supabase.from('notifications').insert({
                    user_id: r.id,
                    type: 'policy_review_request',
                    title: 'Pre-Review Requested',
                    message: `You have been assigned as a pre-reviewer for policy "${policy.name}" (${policy.policy_number || 'Draft'}).`,
                    data: { policy_id: policy.id, review_type: 'pre', link: `/policy/${policy.id}` },
                  });
                  sendKBNotificationEmail({
                    type: 'review_request',
                    recipientUserId: r.id,
                    policyName: policy.name,
                    policyNumber: policy.policy_number || undefined,
                    policyId: policy.id,
                    organizationId: orgId,
                    senderName,
                    reviewType: 'pre',
                    comment: preReviewComment || undefined,
                  });
                } else if (r.type === 'group') {
                  // Notify all group members
                  const { data: members } = await supabase.rpc('get_group_members', { _group_id: r.id });
                  if (members) {
                    for (const m of members.filter((m: any) => m.member_type === 'user')) {
                      await supabase.from('notifications').insert({
                        user_id: m.member_id,
                        type: 'policy_review_request',
                        title: 'Pre-Review Requested',
                        message: `Your group has been assigned as a pre-reviewer for policy "${policy.name}".`,
                        data: { policy_id: policy.id, review_type: 'pre', link: `/policy/${policy.id}` },
                      });
                      sendKBNotificationEmail({
                        type: 'review_request',
                        recipientUserId: m.member_id,
                        policyName: policy.name,
                        policyNumber: policy.policy_number || undefined,
                        policyId: policy.id,
                        organizationId: orgId,
                        senderName,
                        reviewType: 'pre',
                        comment: preReviewComment || undefined,
                      });
                    }
                  }
                }
              }
              setShowPreReviewDialog(false);
              setPreReviewerIds([]);
              setPreReviewComment('');
              toast.success(`${uniqueNew.length} pre-reviewer(s) assigned`);
            }}>
              Assign {preReviewerIds.length} Reviewer(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Review Assignment Dialog */}
      <Dialog open={showPostReviewDialog} onOpenChange={setShowPostReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Post-Reviewers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Select Users</Label>
              <div className="border rounded-md max-h-[180px] overflow-y-auto">
                {(usersQuery.data || []).filter(u => u.id !== user?.id).map(u => {
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
                  const isSelected = postReviewerIds.includes(`user:${u.id}`);
                  return (
                    <div key={u.id} className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => setPostReviewerIds(prev => isSelected ? prev.filter(id => id !== `user:${u.id}`) : [...prev, `user:${u.id}`])}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">User</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Select Groups</Label>
              <div className="border rounded-md max-h-[120px] overflow-y-auto">
                {(groupsQuery.data || []).map(g => {
                  const isSelected = postReviewerIds.includes(`group:${g.id}`);
                  return (
                    <div key={g.id} className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => setPostReviewerIds(prev => isSelected ? prev.filter(id => id !== `group:${g.id}`) : [...prev, `group:${g.id}`])}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm font-medium">{g.name}</span>
                      <Badge variant="outline" className="text-[10px]">Group</Badge>
                    </div>
                  );
                })}
                {(groupsQuery.data || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No groups available</p>}
              </div>
            </div>
            <div>
              <Label>Comment (optional)</Label>
              <Textarea value={postReviewComment} onChange={e => setPostReviewComment(e.target.value)} rows={2} placeholder="Add a note..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPostReviewDialog(false)}>Cancel</Button>
            <Button disabled={postReviewerIds.length === 0} onClick={async () => {
              const existing = (policy.content?.post_reviewers as any[]) || [];
              const newReviewers = postReviewerIds.map(key => {
                const [type, id] = key.split(':');
                return { id, type, status: 'pending', comment: postReviewComment || undefined };
              });
              const existingKeys = new Set(existing.map((r: any) => `${r.type}:${r.id}`));
              const uniqueNew = newReviewers.filter(r => !existingKeys.has(`${r.type}:${r.id}`));
              await updatePolicy.mutateAsync({
                id: policy.id,
                content: { ...(policy.content || {}), post_reviewers: [...existing, ...uniqueNew] },
              });
              // Send notifications to user-type reviewers
              const senderName2 = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || userProfile?.email || '';
              const orgId2 = currentOrganization?.id || userProfile?.organization_id || '';
              for (const r of uniqueNew) {
                if (r.type === 'user') {
                  await supabase.from('notifications').insert({
                    user_id: r.id,
                    type: 'policy_review_request',
                    title: 'Post-Review Requested',
                    message: `You have been assigned as a post-reviewer for policy "${policy.name}" (${policy.policy_number || 'Draft'}).`,
                    data: { policy_id: policy.id, review_type: 'post', link: `/policy/${policy.id}` },
                  });
                  sendKBNotificationEmail({
                    type: 'review_request',
                    recipientUserId: r.id,
                    policyName: policy.name,
                    policyNumber: policy.policy_number || undefined,
                    policyId: policy.id,
                    organizationId: orgId2,
                    senderName: senderName2,
                    reviewType: 'post',
                    comment: postReviewComment || undefined,
                  });
                } else if (r.type === 'group') {
                  const { data: members } = await supabase.rpc('get_group_members', { _group_id: r.id });
                  if (members) {
                    for (const m of members.filter((m: any) => m.member_type === 'user')) {
                      await supabase.from('notifications').insert({
                        user_id: m.member_id,
                        type: 'policy_review_request',
                        title: 'Post-Review Requested',
                        message: `Your group has been assigned as a post-reviewer for policy "${policy.name}".`,
                        data: { policy_id: policy.id, review_type: 'post', link: `/policy/${policy.id}` },
                      });
                      sendKBNotificationEmail({
                        type: 'review_request',
                        recipientUserId: m.member_id,
                        policyName: policy.name,
                        policyNumber: policy.policy_number || undefined,
                        policyId: policy.id,
                        organizationId: orgId2,
                        senderName: senderName2,
                        reviewType: 'post',
                        comment: postReviewComment || undefined,
                      });
                    }
                  }
                }
              }
              setShowPostReviewDialog(false);
              setPostReviewerIds([]);
              setPostReviewComment('');
              toast.success(`${uniqueNew.length} post-reviewer(s) assigned`);
            }}>
              Assign {postReviewerIds.length} Reviewer(s)
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
