import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

// ── Types ──

interface SmartTemplateField {
  id: string;
  label: string;
  field_type: string;
}

interface SmartTemplateSubmission {
  id: string;
  submission_ref_id?: string;
  submitted_at: string;
  submitted_by_email?: string;
  submission_data: Record<string, any>;
}

export interface SmartTemplateOptions {
  templateBuffer: ArrayBuffer;
  formName: string;
  fields: SmartTemplateField[];
  submissions: SmartTemplateSubmission[];
  returnBlob?: boolean;
}

// ── Helpers ──

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Build a label → field ID lookup map.
 * Normalizes labels to lowercase for case-insensitive matching.
 */
function buildLabelToIdMap(fields: SmartTemplateField[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const field of fields) {
    map.set(field.label.toLowerCase(), field.id);
  }
  return map;
}

/**
 * Build the data context for a single submission.
 * Creates entries keyed by both field label and field ID so either
 * placeholder style works in the template.
 */
function buildSubmissionContext(
  submission: SmartTemplateSubmission,
  fields: SmartTemplateField[],
): Record<string, string> {
  const ctx: Record<string, string> = {};

  // Add metadata fields
  ctx['Record_ID'] = submission.submission_ref_id || submission.id.slice(0, 8);
  ctx['Submitted_At'] = submission.submitted_at ? formatDate(submission.submitted_at) : '—';
  ctx['Submitted_By'] = submission.submitted_by_email || '—';

  // Add form field values keyed by label (with spaces replaced by underscores)
  for (const field of fields) {
    const rawValue = submission.submission_data?.[field.id];
    const formattedValue = formatFieldValue(rawValue);

    // Tag key: replace spaces with underscores for template compatibility
    const tagKey = field.label.replace(/\s+/g, '_');
    ctx[tagKey] = formattedValue;

    // Also add with field ID as key (fallback)
    ctx[field.id] = formattedValue;
  }

  return ctx;
}

/**
 * Generate a document from a smart template with {placeholder} replacement.
 *
 * The template can use:
 * - {Field_Label} for individual field values (spaces → underscores)
 * - {#records}...{/records} loop for repeating per record
 * - {Record_ID}, {Submitted_At}, {Submitted_By} for metadata
 *
 * If no {#records} loop is found, a single merged context is used
 * (first submission's data).
 */
export async function generateFromSmartTemplate(
  options: SmartTemplateOptions,
): Promise<Blob> {
  const { templateBuffer, formName, fields, submissions, returnBlob } = options;

  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  // Build the records array for loop-based templates
  const records = submissions.map((sub) => buildSubmissionContext(sub, fields));

  // Build the top-level context
  const data: Record<string, any> = {
    // Form-level metadata
    Form_Name: formName,
    Total_Records: String(submissions.length),
    Generated_Date: formatDate(new Date().toISOString()),

    // Records array for {#records}...{/records} loops
    records,
  };

  // Also flatten the first record's data at the top level
  // so single-record templates work without loops
  if (records.length > 0) {
    Object.assign(data, records[0]);
  }

  doc.render(data);

  const out = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  if (returnBlob) {
    return out;
  }

  const filename = `${formName.replace(/[^a-zA-Z0-9]/g, '_')}_SmartDoc_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(out, filename);
  return out;
}

/**
 * Extract all placeholders from a template buffer.
 * Useful for showing which tags are used in the uploaded template.
 */
export function extractTemplateTags(templateBuffer: ArrayBuffer): string[] {
  try {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
    });

    // Use getFullText to extract all text and find tags
    const text = doc.getFullText();
    const tagRegex = /\{([^#/}][^}]*)\}/g;
    const tags = new Set<string>();
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
      tags.add(match[1]);
    }
    return Array.from(tags);
  } catch {
    return [];
  }
}

/**
 * Generate available placeholder tags from fields.
 * Returns objects with tag and label for display in the UI.
 */
export function getAvailableTags(
  fields: SmartTemplateField[],
): { tag: string; label: string; category: 'field' | 'meta' }[] {
  const tags: { tag: string; label: string; category: 'field' | 'meta' }[] = [];

  // Metadata tags
  tags.push(
    { tag: '{Record_ID}', label: 'Record Reference ID', category: 'meta' },
    { tag: '{Submitted_At}', label: 'Submission Date/Time', category: 'meta' },
    { tag: '{Submitted_By}', label: 'Submitted By Email', category: 'meta' },
    { tag: '{Form_Name}', label: 'Form Name', category: 'meta' },
    { tag: '{Total_Records}', label: 'Total Record Count', category: 'meta' },
    { tag: '{Generated_Date}', label: 'Document Generation Date', category: 'meta' },
  );

  // Field tags
  for (const field of fields) {
    const tagKey = field.label.replace(/\s+/g, '_');
    tags.push({
      tag: `{${tagKey}}`,
      label: field.label,
      category: 'field',
    });
  }

  return tags;
}
