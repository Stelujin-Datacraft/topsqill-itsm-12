import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Save, Send, Archive, History, Link2, CheckCircle, Clock, FileText, Download, Plus, UserCheck, AlertOctagon, CalendarClock, Shield, BookOpen, Upload, Loader2 } from 'lucide-react';
import { PolicyDynamicFieldsRenderer } from '@/components/policies/PolicyDynamicFieldsRenderer';
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
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import { POLICY_CATEGORIES, POLICY_STATUSES, POLICY_PRIORITIES, REVIEW_CYCLE_OPTIONS } from '@/types/policy';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TiptapEditor } from '@/components/ui/tiptap-editor';

const PolicyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const { policies, updatePolicy, deletePolicy, createVersion, createReviewCycle } = usePolicies();
  const { versions, linkages, approvals, isLoading, createLinkage, submitApproval, respondApproval } = usePolicyDetail(id);
  
  const policy = policies.find(p => p.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [changeSummary, setChangeSummary] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkForm, setLinkForm] = useState({ linked_entity_type: 'form' as const, linked_entity_id: '', link_description: '' });
  const [approvalComment, setApprovalComment] = useState('');
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [dynamicFieldsFormat, setDynamicFieldsFormat] = useState<'table' | 'field-value'>(
    (policies.find(p => p.id === id)?.content?.dynamic_fields_display as 'table' | 'field-value') || 'table'
  );

  // Approval dialog state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedApproverIds, setSelectedApproverIds] = useState<string[]>([]);
  const [approvalSubmitComment, setApprovalSubmitComment] = useState('');

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
      content_html: policy.content?.html || '',
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

    const { content_html, ...restEditForm } = editForm;
    await updatePolicy.mutateAsync({
      id: policy.id,
      ...restEditForm,
      content: content_html ? { html: content_html } : policy.content,
      next_review_date,
      current_version: policy.current_version + 1,
    });

    setIsEditing(false);
    setChangeSummary('');
  };

  const handleSubmitForApproval = async () => {
    if (selectedApproverIds.length === 0) {
      toast.error('Please select at least one approver');
      return;
    }
    // Create one approval record per selected approver
    for (const approverId of selectedApproverIds) {
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
    }
    await updatePolicy.mutateAsync({ id: policy.id, status: 'pending_approval' });
    setShowApprovalDialog(false);
    setSelectedApproverIds([]);
    setApprovalSubmitComment('');
    toast.success(`Submitted for approval to ${selectedApproverIds.length} approver(s)`);
  };

  const handleApprovalResponse = async (approvalId: string, status: 'approved' | 'rejected') => {
    await respondApproval.mutateAsync({ approvalId, status, comments: approvalComment || undefined });
    if (status === 'approved') {
      const pendingApprovals = approvals.filter(a => a.status === 'pending' && a.id !== approvalId);
      if (pendingApprovals.length === 0) {
        const publishedAt = new Date().toISOString();
        await updatePolicy.mutateAsync({ id: policy.id, status: 'published', published_at: publishedAt });
        if (policy.review_cycle_days && policy.review_cycle_days > 0) {
          const reviewDate = new Date();
          reviewDate.setDate(reviewDate.getDate() + policy.review_cycle_days);
          await createReviewCycle.mutateAsync({
            policy_id: policy.id,
            review_date: reviewDate.toISOString().split('T')[0],
            status: 'scheduled',
          });
        }
      }
    } else {
      await updatePolicy.mutateAsync({ id: policy.id, status: 'draft' });
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
    navigate('/policies');
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

    const doc = new jsPDF();
    let yPos = 22;
    const pageHeight = doc.internal.pageSize.getHeight();

    const ensureSpace = (needed: number) => {
      if (yPos > pageHeight - needed) { doc.addPage(); yPos = 20; }
    };

    doc.setFontSize(18);
    doc.text(policy.name, 14, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`${policy.policy_number || ''} | Status: ${policy.status} | Category: ${policy.category} | Priority: ${policy.priority || 'medium'} | Version: ${policy.current_version}`, 14, yPos);
    yPos += 6;
    doc.text(`Last Updated: ${format(new Date(policy.updated_at), 'PPpp')}`, 14, yPos);
    yPos += 6;
    if (policy.effective_date) { doc.text(`Effective: ${policy.effective_date}`, 14, yPos); yPos += 6; }
    if (policy.compliance_standard) { doc.text(`Compliance: ${policy.compliance_standard} ${policy.compliance_reference || ''}`, 14, yPos); yPos += 6; }

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

    if (policy.content?.html) {
      yPos += 4;
      doc.setFontSize(12);
      doc.text('Policy Content', 14, yPos);
      yPos += 8;

      // Render styled HTML to canvas for design-preserving PDF
      const renderDiv = document.createElement('div');
      renderDiv.innerHTML = policy.content.html;
      Object.assign(renderDiv.style, {
        position: 'absolute',
        left: '-9999px',
        top: '0',
        width: '720px',
        padding: '20px',
        background: 'white',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '12px',
        lineHeight: '1.6',
        color: '#000',
      });
      // Style images to fit within the render width
      document.body.appendChild(renderDiv);
      renderDiv.querySelectorAll('img').forEach((img) => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      });
      // Style tables for better rendering
      renderDiv.querySelectorAll('table').forEach((table) => {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
      });
      renderDiv.querySelectorAll('td, th').forEach((cell) => {
        (cell as HTMLElement).style.border = '1px solid #ccc';
        (cell as HTMLElement).style.padding = '4px 8px';
      });

      try {
        const canvas = await html2canvas(renderDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
        });
        document.body.removeChild(renderDiv);

        const imgData = canvas.toDataURL('image/png');
        const pageWidth = doc.internal.pageSize.getWidth() - 28; // 14px margin each side
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        const maxPageContent = pageHeight - 30;

        // If the rendered content fits on remaining space, add it
        if (yPos + imgHeight <= maxPageContent) {
          doc.addImage(imgData, 'PNG', 14, yPos, pageWidth, imgHeight);
          yPos += imgHeight + 6;
        } else {
          // Split across pages by slicing the canvas
          let srcY = 0;
          const srcWidth = canvas.width;
          const srcHeight = canvas.height;

          while (srcY < srcHeight) {
            const availableHeight = (srcY === 0 ? maxPageContent - yPos : maxPageContent - 20);
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
              const startY = srcY === 0 ? yPos : 20;
              doc.addImage(sliceImg, 'PNG', 14, startY, pageWidth, sliceImgHeight);
              yPos = startY + sliceImgHeight + 6;
            }

            srcY += actualSlice;
            if (srcY < srcHeight) {
              doc.addPage();
              yPos = 20;
            }
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
        for (const line of contentLines) {
          ensureSpace(20);
          doc.text(line, 14, yPos);
          yPos += 5;
        }
      }
    }

    // Dynamic Fields from linked form
    if (policy.form_id) {
      try {
        const displayFormat = dynamicFieldsFormat;
        const [formRes, fieldsRes, subsRes] = await Promise.all([
          supabase.from('forms').select('name').eq('id', policy.form_id).single(),
          supabase.from('form_fields').select('id, label, field_type, options, field_order').eq('form_id', policy.form_id).order('field_order'),
          supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('form_id', policy.form_id).order('submitted_at', { ascending: true }),
        ]);

        const formName = formRes.data?.name || 'Linked Form';
        const allFields = (fieldsRes.data || []).filter(f =>
          !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type)
        );
        // Only use selected fields if specified
        const selectedFieldIds = policy.content?.selected_field_ids as string[] | undefined;
        const fields = selectedFieldIds?.length ? allFields.filter(f => selectedFieldIds.includes(f.id)) : allFields;
        const submissions = subsRes.data || [];

        if (submissions.length > 0) {
          yPos += 8;
          ensureSpace(30);
          doc.setFontSize(13);
          doc.text(`Dynamic Data — ${formName}`, 14, yPos);
          yPos += 8;

          submissions.forEach((sub: any, idx: number) => {
            const refId = sub.submission_ref_id || sub.id.slice(0, 8);
            const sectionTitle = `Policy ${idx + 1} — ${refId}`;
            ensureSpace(25);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(sectionTitle, 14, yPos);
            doc.setFont('helvetica', 'normal');
            yPos += 6;

            const data = sub.submission_data || {};

            if (displayFormat === 'table') {
              const tableRows = fields.map((f: any) => [
                f.label,
                pdfFormatValue(data[f.id], f.field_type, f.options),
              ]);
              autoTable(doc, {
                head: [['Field', 'Value']],
                body: tableRows,
                startY: yPos,
                margin: { left: 14 },
                styles: { fontSize: 9 },
                headStyles: { fillColor: [60, 60, 60] },
              });
              yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
            } else {
              doc.setFontSize(10);
              fields.forEach((f: any) => {
                ensureSpace(16);
                doc.setFont('helvetica', 'bold');
                doc.text(f.label, 14, yPos);
                yPos += 5;
                doc.setFont('helvetica', 'normal');
                const val = pdfFormatValue(data[f.id], f.field_type, f.options);
                const valLines = doc.splitTextToSize(val, 180);
                for (const vl of valLines) {
                  ensureSpace(12);
                  doc.text(vl, 14, yPos);
                  yPos += 5;
                }
                yPos += 2;
              });
            }
            yPos += 4;
          });
        }
      } catch (err) {
        console.error('Failed to fetch dynamic fields for PDF:', err);
      }
    }

    // Attachments list with clickable links
    const pdfAttachments = (policy.attachments || []).filter((att: any) => att.show_in_pdf !== false);
    if (pdfAttachments.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY || yPos + 10;
      let attY = lastY + 10;
      if (attY > pageHeight - 30) { doc.addPage(); attY = 20; }
      doc.setFontSize(12);
      doc.text('Attachments', 14, attY);
      attY += 6;
      doc.setFontSize(10);
      pdfAttachments.forEach((att: any) => {
        if (attY > pageHeight - 15) { doc.addPage(); attY = 20; }
        const label = `• ${att.name}`;
        doc.text(label, 14, attY);
        if (att.url) {
          const labelWidth = doc.getTextWidth(label);
          doc.setTextColor(37, 99, 235);
          doc.textWithLink(' [Open / Download]', 14 + labelWidth, attY, { url: att.url });
          doc.setTextColor(0, 0, 0);
        }
        attY += 5;
      });
    }

    if (mode === 'preview') {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('PDF preview opened in new tab');
    } else {
      doc.save(`${policy.policy_number || policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${policy.current_version}.pdf`);
      toast.success('PDF exported');
    }
  };

  const exportToPDF = () => generatePDF('download');

  const pdfFormatValue = (value: any, fieldType: string, options?: any): string => {
    if (value === null || value === undefined || value === '') return '—';
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
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return value.join(', ');
    if (fieldType === 'date' || fieldType === 'datetime') { try { return new Date(value).toLocaleDateString(); } catch { return String(value); } }
    return String(value);
  };

  const statusDef = POLICY_STATUSES.find(s => s.value === policy.status);
  const priorityDef = POLICY_PRIORITIES.find(p => p.value === (policy.priority || 'medium'));
  const isOverdueReview = policy.next_review_date && isPast(new Date(policy.next_review_date));

  // Role-based access
  const isAdmin = userProfile?.role === 'admin';
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
          {isAdmin && policy.status === 'draft' && (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button size="sm" onClick={() => setShowApprovalDialog(true)}>
                <Send className="h-4 w-4 mr-1" /> Submit for Approval
              </Button>
            </>
          )}
          {policy.status === 'pending_approval' && (
            <Badge variant="outline" className="gap-1 text-sm py-1 px-3">
              <Clock className="h-3.5 w-3.5" /> Awaiting Approval
            </Badge>
          )}
          {isAdmin && policy.status === 'published' && (
            <Button variant="outline" size="sm" onClick={retirePolicy}>
              <Archive className="h-4 w-4 mr-1" /> Retire
            </Button>
          )}
          {isAdmin && (
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
          )}
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
              <div className="col-span-2">
                <Label>Policy Content</Label>
                <TiptapEditor
                  content={editForm.content_html || ''}
                  onChange={(html) => setEditForm((p: any) => ({ ...p, content_html: html }))}
                  placeholder="Write the full policy content..."
                  className="min-h-[150px]"
                />
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
          <TabsTrigger value="content" className="gap-1">
            <BookOpen className="h-3.5 w-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Approvals ({approvals.length})
          </TabsTrigger>
          {/* Linkages tab hidden for now */}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Attachments</CardTitle>
              {isAdmin && (
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
                      <><Upload className="h-4 w-4 mr-1" /> Upload Attachment</>
                    )}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {(!policy.attachments || policy.attachments.length === 0) ? (
                <p className="text-sm text-muted-foreground">No attachments.{isAdmin ? ' Click "Upload Attachment" to add files.' : ''}</p>
              ) : (
                <div className="space-y-2">
                  {policy.attachments.map((att: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md border">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{att.name}</span>
                      {att.size && <span className="text-xs text-muted-foreground shrink-0">{(att.size / 1024).toFixed(1)} KB</span>}
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer" title="Include in PDF export">
                            <span className="hidden sm:inline">PDF</span>
                            <input
                              type="checkbox"
                              checked={att.show_in_pdf !== false}
                              onChange={async () => {
                                const updated = [...policy.attachments];
                                updated[i] = { ...updated[i], show_in_pdf: !(att.show_in_pdf !== false) };
                                await updatePolicy.mutateAsync({ id: policy.id, attachments: updated as any });
                              }}
                              className="h-3.5 w-3.5 rounded border-muted-foreground accent-primary cursor-pointer"
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
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Policy Content</CardTitle>
            </CardHeader>
            <CardContent>
              {policy.content?.html ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: policy.content.html }}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No content has been added yet. Click "Edit" to add policy content.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Dynamic Fields from Linked Form */}
          {policy.form_id && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Dynamic Fields Display</span>
                <Select
                  value={dynamicFieldsFormat}
                  onValueChange={v => setDynamicFieldsFormat(v as 'table' | 'field-value')}
                >
                  <SelectTrigger className="w-[200px] h-8 text-xs">
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
              />
            </div>
          )}
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Approval History</p>
                <Button variant="outline" size="sm" onClick={() => generatePDF('preview')}>
                  <FileText className="h-4 w-4 mr-1" /> Preview Policy PDF
                </Button>
              </div>
              {approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No approval history</p>
              ) : (
                <div className="space-y-3">
                  {approvals.map(a => (
                    <div key={a.id} className="p-3 rounded-md border space-y-2">
                      <div className="flex items-start gap-3">
                        {a.status === 'approved' && <CheckCircle className="h-5 w-5 text-primary mt-0.5" />}
                        {a.status === 'pending' && <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />}
                        {a.status === 'rejected' && <AlertOctagon className="h-5 w-5 text-destructive mt-0.5" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm capitalize font-medium">{a.status}</span>
                            <Badge variant="outline">v{a.version_number}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Approver: <span className="font-medium text-foreground">{getUserName(a.approver_id)}</span>
                          </div>
                          {a.comments && <div className="text-xs text-muted-foreground mt-1 italic">"{a.comments}"</div>}
                        </div>
                        <div className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'MMM d, yyyy HH:mm')}</div>
                      </div>
                      {a.status === 'pending' && a.approver_id === user?.id ? (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Textarea
                            placeholder="Add comment (required for rejection, optional for approval)"
                            value={approvalComment}
                            onChange={e => setApprovalComment(e.target.value)}
                            className="flex-1 text-sm min-h-[60px]"
                            rows={2}
                          />
                          <div className="flex flex-col gap-1">
                            <Button size="sm" variant="default" onClick={() => handleApprovalResponse(a.id, 'approved')} disabled={respondApproval.isPending}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleApprovalResponse(a.id, 'rejected')} disabled={respondApproval.isPending || !approvalComment.trim()}>
                              <AlertOctagon className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ) : a.status === 'pending' ? (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground italic">Awaiting response from designated approver</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linkages Tab - hidden for now */}
      </Tabs>

      {/* Submit for Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Approver(s) *</Label>
              <p className="text-xs text-muted-foreground mb-2">Choose who should approve this policy before it can be published.</p>
              <div className="border rounded-md max-h-[200px] overflow-y-auto">
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
