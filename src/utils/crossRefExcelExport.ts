import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface FieldMeta {
  id: string;
  label: string;
  fieldType: string;
  options?: any;
  customConfig?: any;
}

function formatCellValue(value: any, fieldType: string, options?: any): string {
  if (value === null || value === undefined || value === '') return '';
  if ((fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'dropdown') && options) {
    const opts = Array.isArray(options) ? options : [];
    if (Array.isArray(value)) return value.map((v) => { const opt = opts.find((o: any) => o.value === v || o.id === v); return opt?.label || v; }).join(', ');
    const opt = opts.find((o: any) => o.value === value || o.id === value);
    return opt?.label || String(value);
  }
  if (typeof value === 'object') {
    if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value);
  }
  if (fieldType === 'date' || fieldType === 'datetime') { try { return new Date(value).toLocaleDateString(); } catch { return String(value); } }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function extractRefIds(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.map(v => {
    if (typeof v === 'string') return v;
    if (v?.submission_ref_id) return v.submission_ref_id;
    if (v?.id) return v.id;
    return null;
  }).filter(Boolean) as string[];
  return [];
}

async function getFormFields(formId: string): Promise<FieldMeta[]> {
  const { data } = await supabase
    .from('form_fields')
    .select('id, label, field_type, options, custom_config')
    .eq('form_id', formId)
    .order('field_order');
  return (data || []).map(f => ({
    id: f.id,
    label: f.label,
    fieldType: f.field_type,
    options: f.options,
    customConfig: typeof f.custom_config === 'string' ? JSON.parse(f.custom_config) : f.custom_config,
  }));
}

async function getFormName(formId: string): Promise<string> {
  const { data } = await supabase.from('forms').select('name').eq('id', formId).single();
  return data?.name || 'Unknown Form';
}

// Cache for form fields to avoid re-fetching
const fieldCache = new Map<string, FieldMeta[]>();
const nameCache = new Map<string, string>();

async function getCachedFields(formId: string): Promise<FieldMeta[]> {
  if (!fieldCache.has(formId)) {
    fieldCache.set(formId, await getFormFields(formId));
  }
  return fieldCache.get(formId)!;
}

async function getCachedFormName(formId: string): Promise<string> {
  if (!nameCache.has(formId)) {
    nameCache.set(formId, await getFormName(formId));
  }
  return nameCache.get(formId)!;
}

/**
 * Flat row for the worksheet — every row uses the same columns.
 * We use fixed structural columns + dynamic field columns prefixed with form name for clarity.
 */
interface SheetRow {
  hierarchy: string;       // visual tree indicator
  formName: string;        // which form this record belongs to
  refId: string;           // submission_ref_id
  linkedVia: string;       // which cross-ref field linked to this
  fieldValues: Record<string, string>; // "FormName > FieldLabel" → value
}

async function collectRows(
  submissions: any[],
  formId: string,
  depth: number,
  linkedVia: string,
  rows: SheetRow[],
  allFieldKeys: string[],
  maxDepth: number = 3,
): Promise<void> {
  if (depth > maxDepth || submissions.length === 0) return;

  const fields = await getCachedFields(formId);
  const formName = await getCachedFormName(formId);
  const regularFields = fields.filter(f => !['section', 'divider', 'description', 'child-cross-reference', 'cross-reference'].includes(f.fieldType));
  const crossRefFields = fields.filter(f => f.fieldType === 'cross-reference');

  // Register field keys
  for (const f of regularFields) {
    const key = `${formName} > ${f.label}`;
    if (!allFieldKeys.includes(key)) allFieldKeys.push(key);
  }

  const depthArrow = depth === 0 ? '' : '│  '.repeat(depth - 1) + '├─ ';

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    const submissionData = (sub.submission_data as Record<string, any>) || {};
    const isLast = i === submissions.length - 1;
    const prefix = depth === 0 ? '' : '│  '.repeat(depth - 1) + (isLast ? '└─ ' : '├─ ');

    const fieldValues: Record<string, string> = {};
    for (const f of regularFields) {
      const key = `${formName} > ${f.label}`;
      fieldValues[key] = formatCellValue(submissionData[f.id], f.fieldType, f.options);
    }

    rows.push({
      hierarchy: `${prefix}${formName}`,
      formName,
      refId: sub.submission_ref_id || sub.id?.slice(0, 8) || '',
      linkedVia: linkedVia || (depth === 0 ? 'Parent Record' : ''),
      fieldValues,
    });

    // Process nested cross-refs
    for (const crField of crossRefFields) {
      const refIds = extractRefIds(submissionData[crField.id]);
      if (refIds.length === 0) continue;

      const targetFormId = crField.customConfig?.targetFormId;
      if (!targetFormId) continue;

      const { data: linkedSubs } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data')
        .eq('form_id', targetFormId)
        .in('submission_ref_id', refIds);

      if (linkedSubs && linkedSubs.length > 0) {
        await collectRows(linkedSubs, targetFormId, depth + 1, crField.label, rows, allFieldKeys, maxDepth);
      }
    }
  }
}

export async function exportCrossRefHierarchyToExcel(
  parentSubmissions: any[],
  parentFormId: string,
  parentFormName: string,
): Promise<void> {
  // Clear caches
  fieldCache.clear();
  nameCache.clear();

  const rows: SheetRow[] = [];
  const allFieldKeys: string[] = [];

  await collectRows(parentSubmissions, parentFormId, 0, '', rows, allFieldKeys);

  if (rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No data found']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Export');
    XLSX.writeFile(wb, `${parentFormName}-hierarchy.xlsx`);
    return;
  }

  // Build header row
  const fixedHeaders = ['Hierarchy', 'Form', 'Reference ID', 'Linked Via'];
  const allHeaders = [...fixedHeaders, ...allFieldKeys];

  // Build data rows
  const dataRows = rows.map(r => {
    const arr: string[] = [
      r.hierarchy,
      r.formName,
      r.refId,
      r.linkedVia,
    ];
    for (const key of allFieldKeys) {
      arr.push(r.fieldValues[key] || '');
    }
    return arr;
  });

  const wsData = [allHeaders, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns based on content
  ws['!cols'] = allHeaders.map((header, colIdx) => {
    let maxLen = header.length;
    for (const row of dataRows) {
      const cellLen = (row[colIdx] || '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, parentFormName.slice(0, 31));
  XLSX.writeFile(wb, `${parentFormName}-hierarchy.xlsx`);
}
