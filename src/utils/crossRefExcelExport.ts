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

interface ExcelRow {
  [key: string]: string;
}

/**
 * Recursively builds hierarchical rows for Excel export.
 * Each depth level is indented with a prefix in the first column.
 */
async function buildHierarchicalRows(
  submissions: any[],
  formId: string,
  depth: number,
  parentLabel: string,
  allRows: ExcelRow[],
  maxDepth: number = 3
): Promise<void> {
  if (depth > maxDepth) return;

  const fields = await getFormFields(formId);
  const regularFields = fields.filter(f => !['section', 'divider', 'description', 'child-cross-reference'].includes(f.fieldType));
  const crossRefFields = fields.filter(f => f.fieldType === 'cross-reference');

  const indent = '    '.repeat(depth);
  const levelPrefix = depth === 0 ? '' : `${'→'.repeat(depth)} `;

  for (const sub of submissions) {
    const submissionData = (sub.submission_data as Record<string, any>) || {};
    const row: ExcelRow = {};

    // Level indicator
    row['Level'] = `${indent}${levelPrefix}${depth === 0 ? 'Parent' : `Linked (Level ${depth})`}`;
    row['Reference ID'] = sub.submission_ref_id || sub.id?.slice(0, 8) || '';
    if (parentLabel && depth > 0) {
      row['Linked From'] = parentLabel;
    }

    // Add all regular field values
    for (const field of regularFields) {
      const colName = depth > 0 ? `${indent}${field.label}` : field.label;
      row[colName] = formatCellValue(submissionData[field.id], field.fieldType, field.options);
    }

    allRows.push(row);

    // Process cross-reference fields recursively
    for (const crField of crossRefFields) {
      const value = submissionData[crField.id];
      const refIds = extractRefIds(value);
      if (refIds.length === 0) continue;

      const targetFormId = crField.customConfig?.targetFormId;
      if (!targetFormId) continue;

      const targetFormName = await getFormName(targetFormId);

      // Add a separator row for the linked section
      const sepRow: ExcelRow = {};
      sepRow['Level'] = `${'    '.repeat(depth + 1)}┌─ ${crField.label} → ${targetFormName} (${refIds.length} records)`;
      allRows.push(sepRow);

      // Fetch linked submissions
      const { data: linkedSubs } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data')
        .eq('form_id', targetFormId)
        .in('submission_ref_id', refIds);

      if (linkedSubs && linkedSubs.length > 0) {
        await buildHierarchicalRows(linkedSubs, targetFormId, depth + 1, crField.label, allRows, maxDepth);
      }

      // End separator
      const endRow: ExcelRow = {};
      endRow['Level'] = `${'    '.repeat(depth + 1)}└─ End ${crField.label}`;
      allRows.push(endRow);
    }
  }
}

export async function exportCrossRefHierarchyToExcel(
  parentSubmissions: any[],
  parentFormId: string,
  parentFormName: string,
): Promise<void> {
  const allRows: ExcelRow[] = [];

  await buildHierarchicalRows(parentSubmissions, parentFormId, 0, '', allRows);

  if (allRows.length === 0) {
    allRows.push({ Level: 'No data found' });
  }

  // Collect all unique column names preserving order
  const colSet = new Set<string>();
  for (const row of allRows) {
    for (const key of Object.keys(row)) {
      colSet.add(key);
    }
  }
  const columns = Array.from(colSet);

  // Build worksheet data
  const wsData = [columns, ...allRows.map(row => columns.map(col => row[col] || ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns
  ws['!cols'] = columns.map(col => ({
    wch: Math.min(Math.max(col.length, 12), 40),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, parentFormName.slice(0, 31));
  XLSX.writeFile(wb, `${parentFormName}-hierarchy.xlsx`);
}
