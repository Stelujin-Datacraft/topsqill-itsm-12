import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Generate a PDF blob from a policy object (client-side).
 * Returns a blob URL suitable for <iframe> or window.open.
 */
export async function generatePolicyPreviewBlob(policy: any): Promise<string> {
  const doc = new jsPDF();
  let yPos = 22;
  const pageHeight = doc.internal.pageSize.getHeight();

  const ensureSpace = (needed: number) => {
    if (yPos > pageHeight - needed) { doc.addPage(); yPos = 20; }
  };

  // Title
  doc.setFontSize(18);
  doc.text(policy.name || 'Untitled Document', 14, yPos);
  yPos += 10;

  // Metadata
  doc.setFontSize(10);
  const metaParts = [
    policy.policy_number,
    `Status: ${policy.status || 'draft'}`,
    `Category: ${policy.category || '—'}`,
    `Priority: ${policy.priority || 'medium'}`,
    `Version: ${policy.current_version || 1}`,
  ].filter(Boolean).join(' | ');
  doc.text(metaParts, 14, yPos);
  yPos += 6;

  if (policy.updated_at) {
    doc.text(`Last Updated: ${format(new Date(policy.updated_at), 'PPpp')}`, 14, yPos);
    yPos += 6;
  }
  if (policy.effective_date) {
    doc.text(`Effective: ${policy.effective_date}`, 14, yPos);
    yPos += 6;
  }
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

  // Document Content (HTML → image)
  const contentHtml = policy.content?.html;
  if (contentHtml) {
    yPos += 4;
    doc.setFontSize(12);
    doc.text('Document Content', 14, yPos);
    yPos += 8;

    try {
      const renderDiv = document.createElement('div');
      renderDiv.innerHTML = contentHtml;
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
      doc.setFontSize(10);
      const fallbackDiv = document.createElement('div');
      fallbackDiv.innerHTML = contentHtml;
      const plainText = fallbackDiv.innerText || fallbackDiv.textContent || '';
      const contentLines = doc.splitTextToSize(plainText, 180);
      for (const line of contentLines) { ensureSpace(20); doc.text(line, 14, yPos); yPos += 5; }
    }
  }

  // Custom Fields
  if (policy.content?.custom_fields && (policy.content.custom_fields as any[]).length > 0) {
    const fields = (policy.content.custom_fields as any[]).filter((f: any) => !['header', 'description', 'horizontal-line'].includes(f.type));
    const vals = (policy.content?.custom_field_values as Record<string, any>) || {};
    if (fields.length > 0) {
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
  }

  // Dynamic Fields (from linked form)
  if (policy.form_id) {
    try {
      const [fieldsRes, subsRes] = await Promise.all([
        supabase.from('form_fields').select('id, label, field_type, options, field_order').eq('form_id', policy.form_id).order('field_order'),
        supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('form_id', policy.form_id).order('submitted_at', { ascending: true }),
      ]);
      const allFields = (fieldsRes.data || []).filter(f => !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type));
      const selectedFieldIds = policy.content?.selected_field_ids as string[] | undefined;
      const selectedRecordIds = policy.content?.selected_record_ids as string[] | undefined;
      const fields = selectedFieldIds?.length ? allFields.filter(f => selectedFieldIds.includes(f.id)) : allFields;
      const allSubmissions = subsRes.data || [];
      const submissions = selectedRecordIds?.length ? allSubmissions.filter(s => selectedRecordIds.includes(s.id)) : allSubmissions;

      if (submissions.length > 0 && fields.length > 0) {
        yPos += 8;
        ensureSpace(30);
        doc.setFontSize(13);
        doc.text('Dynamic Fields (Linked Records)', 14, yPos);
        yPos += 8;

        const displayFormat = policy.content?.dynamic_fields_display || 'table';

        if (displayFormat === 'table') {
          const head = fields.map(f => f.label);
          const body = submissions.map((sub: any) => {
            const data = sub.submission_data || {};
            return fields.map(f => {
              const val = data[f.id];
              if (val === null || val === undefined || val === '') return '—';
              if (typeof val === 'object') return JSON.stringify(val);
              return String(val);
            });
          });
          autoTable(doc, {
            head: [head],
            body,
            startY: yPos,
            margin: { left: 14 },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [60, 60, 60] },
          });
          yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
        } else {
          // field-value format
          submissions.forEach((sub: any, idx: number) => {
            ensureSpace(20);
            doc.setFontSize(10);
            doc.setFont(undefined as any, 'bold');
            doc.text(`Record ${idx + 1} (${sub.submission_ref_id || sub.id.slice(0, 8)})`, 14, yPos);
            doc.setFont(undefined as any, 'normal');
            yPos += 6;
            const data = sub.submission_data || {};
            const rows = fields.map(f => {
              const val = data[f.id];
              let display = '—';
              if (val !== null && val !== undefined && val !== '') {
                if (typeof val === 'object') display = JSON.stringify(val);
                else display = String(val);
              }
              return [f.label, display];
            });
            autoTable(doc, {
              body: rows,
              startY: yPos,
              margin: { left: 14 },
              styles: { fontSize: 8 },
              columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
            });
            yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch dynamic fields for preview PDF:', err);
    }
  }

  // Generate blob URL
  const pdfBlob = doc.output('blob');
  return URL.createObjectURL(pdfBlob);
}
