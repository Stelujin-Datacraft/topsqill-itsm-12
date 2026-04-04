import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export async function generatePolicyPreviewBlob(policy: any): Promise<string> {
  const doc = new jsPDF();
  let yPos = 22;
  const pageHeight = doc.internal.pageSize.getHeight();

  const ensureSpace = (needed: number) => {
    if (yPos > pageHeight - needed) {
      doc.addPage();
      yPos = 20;
    }
  };

  // ---------------- TITLE ----------------
  doc.setFontSize(18);
  doc.text(policy.name || 'Untitled Document', 14, yPos);
  yPos += 10;

  // ---------------- METADATA ----------------
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
    const lines = doc.splitTextToSize(policy.description, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 5 + 4;
  }

  // ---------------- HTML CONTENT ----------------
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
        position: 'absolute',
        left: '-9999px',
        width: '720px',
        padding: '24px 32px',
        background: 'white',
        fontFamily: "'Segoe UI', Arial",
        fontSize: '12px',
        lineHeight: '1.7',
      });

      document.body.appendChild(renderDiv);

      renderDiv.querySelectorAll('table').forEach(t => {
        t.style.borderCollapse = 'collapse';
        t.style.width = '100%';
      });

      renderDiv.querySelectorAll('td, th').forEach(c => {
        (c as HTMLElement).style.border = '1px solid #ccc';
        (c as HTMLElement).style.padding = '6px 10px';
      });

      const canvas = await html2canvas(renderDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fff'
      });

      document.body.removeChild(renderDiv);

      const imgData = canvas.toDataURL('image/png');
      const pageWidth = doc.internal.pageSize.getWidth() - 28;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      const maxHeight = pageHeight - 30;

      if (yPos + imgHeight <= maxHeight) {
        doc.addImage(imgData, 'PNG', 14, yPos, pageWidth, imgHeight);
        yPos += imgHeight + 6;
      } else {
        let srcY = 0;

        while (srcY < canvas.height) {
          const availableHeight = srcY === 0 ? maxHeight - yPos : maxHeight - 20;
          const sliceHeight = (availableHeight / pageWidth) * canvas.width;

          const actual = Math.min(sliceHeight, canvas.height - srcY);

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = actual;

          const ctx = sliceCanvas.getContext('2d');
          ctx?.drawImage(canvas, 0, srcY, canvas.width, actual, 0, 0, canvas.width, actual);

          const img = sliceCanvas.toDataURL('image/png');
          const imgH = (actual * pageWidth) / canvas.width;

          const startY = srcY === 0 ? yPos : 20;

          doc.addImage(img, 'PNG', 14, startY, pageWidth, imgH);
          yPos = startY + imgH + 6;

          srcY += actual;

          if (srcY < canvas.height) {
            doc.addPage();
            yPos = 20;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ---------------- CUSTOM FIELDS (FIXED) ----------------
  if (policy.content?.custom_fields?.length) {
    const fields = policy.content.custom_fields.filter(
      (f: any) => !['header', 'description', 'horizontal-line'].includes(f.type)
    );

    const vals = policy.content.custom_field_values || {};

    if (fields.length) {
      yPos += 8;
      ensureSpace(30);

      doc.setFontSize(13);
      doc.text('Custom Fields', 14, yPos);
      yPos += 8;

      const rows = fields
        .sort((a: any, b: any) => a.order - b.order)
        .map((f: any) => {
          const val = vals[f.id];

          let display = '—';
          if (val !== null && val !== undefined && val !== '') {
            if (Array.isArray(val)) display = val.join(', ');
            else if (typeof val === 'boolean') display = val ? 'Yes' : 'No';
            else display = String(val);
          }

          return [f.label, display];
        });

      const cols = policy.content?.custom_field_columns || 1;

      if (cols > 1) {
        const rowsPerCol = Math.ceil(rows.length / cols);
        const colWidth = (doc.internal.pageSize.getWidth() - 28) / cols;

        for (let i = 0; i < cols; i++) {
          const slice = rows.slice(i * rowsPerCol, (i + 1) * rowsPerCol);

          if (slice.length) {
            autoTable(doc, {
              head: [['Field', 'Value']],
              body: slice,
              startY: yPos,
              margin: { left: 14 + i * colWidth },
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
          body: rows,
          startY: yPos,
          margin: { left: 14 },
          styles: { fontSize: 9 },
          headStyles: { fillColor: [60, 60, 60] },
        });

        yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
      }
    }
  }

  // ---------------- DYNAMIC FIELDS (FIXED) ----------------
  // Dynamic Fields (FIXED: selected fields + selected records + correct layout)
  if (policy.form_id) {
    try {
      const [fieldsRes, subsRes] = await Promise.all([
        supabase
          .from('form_fields')
          .select('id, label, field_type, options, field_order')
          .eq('form_id', policy.form_id)
          .order('field_order'),

        supabase
          .from('form_submissions')
          .select('id, submission_ref_id, submission_data')
          .eq('form_id', policy.form_id)
          .order('submitted_at', { ascending: true }),
      ]);

      const allFields = (fieldsRes.data || []).filter(
        f => !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type)
      );

      // ✅ SELECTED fields
      const selectedFieldIds = policy.content?.selected_field_ids as string[] | undefined;
      const fields = selectedFieldIds?.length
        ? allFields.filter(f => selectedFieldIds.includes(f.id))
        : allFields;

      // ✅ SELECTED records
      const selectedRecordIds = policy.content?.selected_record_ids as string[] | undefined;
      const allSubs = subsRes.data || [];
      const submissions = selectedRecordIds?.length
        ? allSubs.filter(s => selectedRecordIds.includes(s.id))
        : allSubs;

      if (submissions.length > 0 && fields.length > 0) {
        yPos += 8;
        ensureSpace(30);

        doc.setFontSize(13);
        doc.text('Dynamic Data', 14, yPos);
        yPos += 8;

        const recordNameFieldId = policy.content?.record_name_field_id as string | undefined;

        submissions.forEach((sub: any, idx: number) => {
          const data = sub.submission_data || {};
          const refId = sub.submission_ref_id || sub.id.slice(0, 8);

          // ✅ record title
          const recordName = recordNameFieldId
            ? data[recordNameFieldId]
            : null;

          const label =
            recordName && typeof recordName === 'string' && recordName.trim()
              ? recordName
              : `Record ${idx + 1}`;

          ensureSpace(25);

          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`${label} — ${refId}`, 14, yPos);

          doc.setFont('helvetica', 'normal');
          yPos += 6;

          // ✅ FIELD-VALUE TABLE (THIS IS WHAT YOU WANT)
          const rows = fields.map((f: any) => {
            const val = data[f.id];

            let display = '—';
            if (val !== null && val !== undefined && val !== '') {
              if (Array.isArray(val)) display = val.join(', ');
              else if (typeof val === 'boolean') display = val ? 'Yes' : 'No';
              else if (typeof val === 'object') display = JSON.stringify(val);
              else display = String(val);
            }

            return [f.label, display];
          });

          autoTable(doc, {
            head: [['Field', 'Value']],
            body: rows,
            startY: yPos,
            margin: { left: 14 },
            styles: { fontSize: 9 },
            headStyles: { fillColor: [60, 60, 60] },
            columnStyles: {
              0: { fontStyle: 'bold', cellWidth: 60 },
              1: { cellWidth: 'auto' },
            },
          });

          yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 10;
        });
      }
    } catch (err) {
      console.error('Dynamic fields preview error:', err);
    }
  }

  // ---------------- FINAL ----------------
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}