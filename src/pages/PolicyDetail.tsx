import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import PizZip from 'pizzip';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Save, Send, Archive, History, Link2, CheckCircle, Clock, FileText, Download, Plus, UserCheck, AlertOctagon, CalendarClock, Shield, BookOpen, Upload, Loader2, Star, FileDown, Users } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import { PolicyDynamicFieldsRenderer } from '@/components/policies/PolicyDynamicFieldsRenderer';
import { PolicyRatingsTab } from '@/components/policies/PolicyRatingsTab';
import { PolicyCustomFieldsRenderer } from '@/components/policies/PolicyCustomFieldsRenderer';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const PolicyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const { policies, updatePolicy, deletePolicy, createVersion, createReviewCycle } = usePolicies();
  const { versions, linkages, approvals, acknowledgments, exceptions, reviewCycles, isLoading, createLinkage, submitApproval, respondApproval, acknowledgePolicy, requestException, respondException } = usePolicyDetail(id);
  
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
  const [liveContentHtml, setLiveContentHtml] = useState<string | null>(null);
  const [contentDirty, setContentDirty] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);

  // Approval dialog state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedApproverIds, setSelectedApproverIds] = useState<string[]>([]);
  const [approvalSubmitComment, setApprovalSubmitComment] = useState('');
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(
    (policy?.content?.approval_mode as ApprovalMode) || 'any_one'
  );

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

    const { content_html, effective_date, expiry_date, ...restEditForm } = editForm;
    // Merge content_html into existing content to preserve original_docx_url, selected_field_ids, etc.
    const updatedContent = {
      ...(policy.content || {}),
      ...(content_html ? { html: content_html } : {}),
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

    const contentHtmlForExport = liveContentHtml ?? policy.content?.html;
    if (contentHtmlForExport) {
      yPos += 4;
      doc.setFontSize(12);
      doc.text('Policy Content', 14, yPos);
      yPos += 8;

      // Render styled HTML to canvas for design-preserving PDF
      const renderDiv = document.createElement('div');
      renderDiv.innerHTML = contentHtmlForExport;
      Object.assign(renderDiv.style, {
        position: 'absolute',
        left: '-9999px',
        top: '0',
        width: '720px',
        padding: '24px 32px',
        background: 'white',
        fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
        fontSize: '12px',
        lineHeight: '1.7',
        color: '#000',
      });
      document.body.appendChild(renderDiv);

      // Preserve images (logos, headers) with proper sizing
      renderDiv.querySelectorAll('img').forEach((img) => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'inline-block';
        img.setAttribute('crossorigin', 'anonymous');
      });
      // Style tables for better rendering
      renderDiv.querySelectorAll('table').forEach((table) => {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.marginTop = '8px';
        table.style.marginBottom = '8px';
      });
      renderDiv.querySelectorAll('td, th').forEach((cell) => {
        (cell as HTMLElement).style.border = '1px solid #ccc';
        (cell as HTMLElement).style.padding = '6px 10px';
        (cell as HTMLElement).style.fontSize = '11px';
      });
      renderDiv.querySelectorAll('th').forEach((th) => {
        (th as HTMLElement).style.backgroundColor = '#f3f4f6';
        (th as HTMLElement).style.fontWeight = '600';
      });
      // Preserve heading styles
      renderDiv.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        (h as HTMLElement).style.marginTop = '12px';
        (h as HTMLElement).style.marginBottom = '6px';
        (h as HTMLElement).style.color = '#111';
      });
      // Preserve blockquote styling
      renderDiv.querySelectorAll('blockquote').forEach((bq) => {
        (bq as HTMLElement).style.borderLeft = '3px solid #6366f1';
        (bq as HTMLElement).style.paddingLeft = '12px';
        (bq as HTMLElement).style.margin = '8px 0';
        (bq as HTMLElement).style.color = '#374151';
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
          supabase.from('form_fields').select('id, label, field_type, options, field_order, custom_config').eq('form_id', policy.form_id).order('field_order'),
          supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('form_id', policy.form_id).order('submitted_at', { ascending: true }),
        ]);

        const formName = formRes.data?.name || 'Linked Form';
        const allFields = (fieldsRes.data || []).filter(f =>
          !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type)
        );
        const selectedFieldIds = policy.content?.selected_field_ids as string[] | undefined;
        const selectedRecordIds = policy.content?.selected_record_ids as string[] | undefined;
        const fields = selectedFieldIds?.length ? allFields.filter(f => selectedFieldIds.includes(f.id)) : allFields;
        const allSubmissions = subsRes.data || [];
        const submissions = selectedRecordIds?.length ? allSubmissions.filter(s => selectedRecordIds.includes(s.id)) : allSubmissions;

        // Resolve cross-ref linked records for PDF
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
              if (val !== null && val !== undefined && val !== '' && typeof val !== 'object') {
                parts.push(`${label}: ${val}`);
              }
              if (parts.length >= 3) break;
            }
            return parts.length > 0 ? `${refId} — ${parts.join(' | ')}` : refId;
          };
          if (Array.isArray(value)) return value.map(resolveOne).filter(Boolean).join('; ') || '—';
          return resolveOne(value);
        };

        const pdfFmtVal = (val: any, fType: string, opts?: any) => {
          if (['cross-reference', 'child-cross-reference', 'dynamic-table'].includes(fType)) {
            return pdfResolveCrossRef(val);
          }
          return pdfFormatValue(val, fType, opts);
        };

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
                pdfFmtVal(data[f.id], f.field_type, f.options),
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
                const val = pdfFmtVal(data[f.id], f.field_type, f.options);
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
    const sections: any[] = [];

    // Title
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: policy.name, bold: true, size: 36, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    // Metadata line
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${policy.policy_number || ''} | Status: ${policy.status} | Category: ${policy.category} | Version: v${policy.current_version}`, size: 20, color: '666666', font: 'Calibri' }),
        ],
        spacing: { after: 100 },
      })
    );
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Last Updated: ${format(new Date(policy.updated_at), 'PPpp')}`, size: 20, color: '666666', font: 'Calibri' }),
        ],
        spacing: { after: 200 },
      })
    );

    if (policy.description) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Description', bold: true, size: 24, font: 'Calibri' })],
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
        })
      );
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: policy.description, size: 22, font: 'Calibri' })],
          spacing: { after: 200 },
        })
      );
    }

    // Content - convert HTML to simple paragraphs
    const docxContentHtml = liveContentHtml ?? policy.content?.html;
    if (docxContentHtml) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Policy Content', bold: true, size: 24, font: 'Calibri' })],
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
        })
      );

      // Parse HTML to extract text blocks
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = docxContentHtml;

      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            sections.push(new Paragraph({
              children: [new TextRun({ text, size: 22, font: 'Calibri' })],
              spacing: { after: 80 },
            }));
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();

          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            const level = tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
            sections.push(new Paragraph({
              children: [new TextRun({ text: el.textContent || '', bold: true, size: tag === 'h1' ? 32 : tag === 'h2' ? 28 : 24, font: 'Calibri' })],
              heading: level,
              spacing: { after: 120 },
            }));
          } else if (tag === 'p' || tag === 'div') {
            const text = el.textContent?.trim();
            if (text) {
              sections.push(new Paragraph({
                children: [new TextRun({ text, size: 22, font: 'Calibri' })],
                spacing: { after: 80 },
              }));
            }
          } else if (tag === 'ul' || tag === 'ol') {
            el.querySelectorAll('li').forEach((li, idx) => {
              const bullet = tag === 'ul' ? '• ' : `${idx + 1}. `;
              sections.push(new Paragraph({
                children: [new TextRun({ text: bullet + (li.textContent || ''), size: 22, font: 'Calibri' })],
                spacing: { after: 40 },
                indent: { left: 400 },
              }));
            });
          } else if (tag === 'table') {
            const rows = el.querySelectorAll('tr');
            if (rows.length > 0) {
              const docxRows = Array.from(rows).map((tr, rIdx) => {
                const cells = tr.querySelectorAll('td, th');
                return new DocxTableRow({
                  children: Array.from(cells).map(cell => new DocxTableCell({
                    children: [new Paragraph({
                      children: [new TextRun({
                        text: cell.textContent || '',
                        bold: cell.tagName.toLowerCase() === 'th' || rIdx === 0,
                        size: 20,
                        font: 'Calibri',
                      })],
                    })],
                    width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
                  })),
                });
              });
              sections.push(new DocxTable({ rows: docxRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
              sections.push(new Paragraph({ children: [], spacing: { after: 120 } }));
            }
          } else if (tag === 'blockquote') {
            sections.push(new Paragraph({
              children: [new TextRun({ text: el.textContent || '', italics: true, size: 22, color: '374151', font: 'Calibri' })],
              indent: { left: 400 },
              spacing: { after: 100 },
            }));
          } else {
            // Recurse for other elements
            el.childNodes.forEach(child => processNode(child));
          }
        }
      };

      tempDiv.childNodes.forEach(child => processNode(child));
    }

    // Attachments
    const pdfAttachments = (policy.attachments || []).filter((att: any) => att.show_in_pdf !== false);
    if (pdfAttachments.length > 0) {
      sections.push(new Paragraph({
        children: [new TextRun({ text: 'Attachments', bold: true, size: 24, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }));
      pdfAttachments.forEach((att: any) => {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${att.name}${att.url ? ' — ' + att.url : ''}`, size: 20, font: 'Calibri' })],
          spacing: { after: 40 },
        }));
      });
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
        subs.forEach((s: any, i: number) => {
          const refId = s.submission_ref_id || s.id.slice(0, 8);
          cps.push('<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">' + esc('Record ' + (i + 1) + ' \u2014 ' + refId) + '</w:t></w:r></w:p>');
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
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button size="sm" onClick={() => setShowApprovalDialog(true)}>
                <Send className="h-4 w-4 mr-1" /> Submit for Approval
              </Button>
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
                toast.success('Policy published successfully');
              }}>
                <CheckCircle className="h-4 w-4 mr-1" /> Publish
              </Button>
            </>
          )}
          {policy.status === 'pending_approval' && (
            <Badge variant="outline" className="gap-1 text-sm py-1 px-3">
              <Clock className="h-3.5 w-3.5" /> Awaiting Approval
            </Badge>
          )}
          {canEdit && policy.status === 'published' && (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={retirePolicy}>
                <Archive className="h-4 w-4 mr-1" /> Retire
              </Button>
            </>
          )}
          {canEdit && policy.status === 'retired' && (
            <Button variant="outline" size="sm" onClick={async () => {
              await updatePolicy.mutateAsync({ id: policy.id, status: 'draft' });
              toast.success('Policy moved back to draft');
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
              <Button onClick={() => setShowSaveConfirmDialog(true)} disabled={updatePolicy.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save Changes
              </Button>
            </div>

            {/* Save Confirmation Dialog */}
            <AlertDialog open={showSaveConfirmDialog} onOpenChange={setShowSaveConfirmDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save Policy Changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a new version (v{(policy.current_version || 0) + 1}) of this policy. The current version will be saved to version history.
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
      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="content" className="gap-1">
            <BookOpen className="h-3.5 w-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Approvals ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1">
            <History className="h-3.5 w-3.5" /> Versions ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="linkages" className="gap-1">
            <Link2 className="h-3.5 w-3.5" /> Linkages ({linkages.length})
          </TabsTrigger>
          <TabsTrigger value="ratings" className="gap-1">
            <Star className="h-3.5 w-3.5" /> Ratings
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
                <DetailRow label="Owner" value={getUserName(policy.created_by)} />
                <DetailRow label="Version" value={`v${policy.current_version}`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Dates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <DetailRow label="Created" value={format(new Date(policy.created_at), 'PPpp')} />
                <DetailRow label="Last Updated" value={format(new Date(policy.updated_at), 'PPpp')} />
              </CardContent>
            </Card>
          </div>

          {/* Custom Fields in Details Tab */}
          {policy.content?.custom_fields && (policy.content.custom_fields as any[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Custom Fields</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(() => {
                  const fields = policy.content.custom_fields as any[];
                  const vals = (policy.content.custom_field_values as Record<string, any>) || {};
                  const sorted = [...fields].sort((a: any, b: any) => a.order - b.order);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                      {sorted.filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type)).map((field: any) => {
                        const raw = vals[field.id];
                        let display = '—';
                        if (raw !== null && raw !== undefined && raw !== '') {
                          if (Array.isArray(raw)) {
                            const opts = field.options || [];
                            display = raw.map((v: string) => {
                              const opt = opts.find((o: any) => o.value === v);
                              return opt?.label || v;
                            }).join(', ') || '—';
                          } else if (typeof raw === 'boolean') {
                            display = raw ? 'Yes' : 'No';
                          } else if ((field.type === 'select' || field.type === 'radio') && field.options) {
                            const opt = field.options.find((o: any) => o.value === raw);
                            display = opt?.label || String(raw);
                          } else if (field.type === 'rating') {
                            display = '★'.repeat(Number(raw));
                          } else {
                            display = String(raw);
                          }
                        }
                        return (
                          <DetailRow key={field.id} label={field.label} value={display} />
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Attachments</CardTitle>
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
                      <><Upload className="h-4 w-4 mr-1" /> Upload Attachment</>
                    )}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {(!policy.attachments || policy.attachments.length === 0) ? (
                <p className="text-sm text-muted-foreground">No attachments.{canEdit ? ' Click "Upload Attachment" to add files.' : ''}</p>
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
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Policy Content</CardTitle>
            </CardHeader>
            <CardContent>
              {(liveContentHtml ?? policy.content?.html) ? (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    title="Policy Content Preview"
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
                selectedRecordIds={policy.content?.selected_record_ids as string[] | undefined}
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

        {/* Versions Tab */}
        <TabsContent value="versions" className="mt-4">
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

        {/* Acknowledgments Tab hidden */}

        {/* Exceptions Tab hidden */}

        {/* Linkages Tab */}
        <TabsContent value="linkages" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Policy Linkages</p>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setShowLinkDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Link
                  </Button>
                )}
              </div>
              {linkages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No linkages. Link this policy to forms, incidents, or other policies.</p>
              ) : (
                <div className="space-y-2">
                  {linkages.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline" className="capitalize">{l.linked_entity_type}</Badge>
                        <span className="text-sm">{l.link_description || l.linked_entity_id.slice(0, 8)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ratings Tab */}
        <TabsContent value="ratings" className="mt-4">
          <PolicyRatingsTab policyId={policy.id} getUserName={getUserName} />
        </TabsContent>
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
