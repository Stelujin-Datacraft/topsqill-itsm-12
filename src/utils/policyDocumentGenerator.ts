import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  PageBreak,
} from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

// ── Types ──

interface PolicyField {
  id: string;
  label: string;
  field_type: string;
}

interface PolicySubmission {
  id: string;
  submission_ref_id?: string;
  submitted_at: string;
  submitted_by_email?: string;
  submission_data: Record<string, any>;
}

export interface PolicyDocumentOptions {
  formName: string;
  formDescription?: string;
  fields: PolicyField[];
  submissions: PolicySubmission[];
}

export interface PolicyTemplateOptions extends PolicyDocumentOptions {
  templateBuffer: ArrayBuffer;
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

// ── Build policy content (shared between default & template) ──

function buildPolicyRecordsContent(
  fields: PolicyField[],
  submissions: PolicySubmission[],
): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [];

  submissions.forEach((submission, index) => {
    const refId = submission.submission_ref_id || submission.id.slice(0, 8);

    if (index > 0) {
      items.push(new Paragraph({ spacing: { before: 300 }, children: [] }));
    }

    items.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: 'cccccc' } },
        children: [
          new TextRun({ text: `Policy ${index + 1}: `, bold: true, size: 26, color: '1a1a2e', font: 'Calibri' }),
          new TextRun({ text: refId, size: 26, color: '555555', font: 'Calibri' }),
        ],
      }),
    );

    const metaItems: string[] = [];
    if (submission.submitted_at) metaItems.push(`Submitted: ${formatDate(submission.submitted_at)}`);
    if (submission.submitted_by_email) metaItems.push(`By: ${submission.submitted_by_email}`);

    if (metaItems.length > 0) {
      items.push(
        new Paragraph({
          spacing: { after: 150 },
          children: [new TextRun({ text: metaItems.join('  |  '), size: 18, color: '888888', italics: true, font: 'Calibri' })],
        }),
      );
    }

    const recordTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: fields.map(field => {
        const value = formatFieldValue(submission.submission_data?.[field.id]);
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: 'f7f7fa' },
              children: [
                new Paragraph({
                  spacing: { before: 50, after: 50 },
                  children: [new TextRun({ text: field.label, bold: true, size: 20, font: 'Calibri', color: '333333' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 50, after: 50 },
                  children: [new TextRun({ text: value, size: 20, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        });
      }),
    });

    items.push(recordTable);
  });

  return items;
}

// ── Default policy document generator ──

export async function generatePolicyDocument(options: PolicyDocumentOptions) {
  const { formName, formDescription, fields, submissions } = options;
  const now = new Date();

  const summaryRows = [
    ['Form Name', formName],
    ['Description', formDescription || 'N/A'],
    ['Total Policies', String(submissions.length)],
    ['Total Fields', String(fields.length)],
    ['Generated On', formatDate(now.toISOString())],
  ];

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: summaryRows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: 'f0f0f5' },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: value, size: 20, font: 'Calibri' })],
              }),
            ],
          }),
        ],
      }),
    ),
  });

  const docChildren: (Paragraph | Table)[] = [];

  // Title page
  docChildren.push(
    new Paragraph({ spacing: { before: 4000 }, alignment: AlignmentType.CENTER, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: formName, bold: true, size: 56, color: '1a1a2e', font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: 'Policy Document', size: 36, color: '444444', font: 'Calibri', italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a1a2e' } },
      children: [],
    }),
  );

  if (formDescription) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: formDescription, size: 24, color: '666666', font: 'Calibri' })],
      }),
    );
  }

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 600 },
      children: [new TextRun({ text: `Generated on: ${formatDate(now.toISOString())}`, size: 20, color: '888888', font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: `Total Policies: ${submissions.length}`, size: 20, color: '888888', font: 'Calibri' })],
    }),
  );

  // Introduction
  docChildren.push(new Paragraph({ children: [new PageBreak()] }));
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1, spacing: { after: 300 },
      children: [new TextRun({ text: '1. Introduction', bold: true, size: 32, color: '1a1a2e', font: 'Calibri' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: `This document contains all policies submitted under "${formName}". Each policy is presented with its complete field data for reference, compliance, and audit purposes.`,
        size: 22, font: 'Calibri',
      })],
    }),
  );

  // Summary
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 300 },
      children: [new TextRun({ text: '2. Document Summary', bold: true, size: 32, color: '1a1a2e', font: 'Calibri' })],
    }),
    summaryTable,
  );

  // Policies heading
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1, spacing: { before: 600, after: 300 },
      children: [new TextRun({ text: '3. Policies', bold: true, size: 32, color: '1a1a2e', font: 'Calibri' })],
    }),
  );

  // Policy records
  docChildren.push(...buildPolicyRecordsContent(fields, submissions));

  // Footer
  docChildren.push(
    new Paragraph({
      spacing: { before: 800 },
      border: { top: { style: BorderStyle.SINGLE, size: 3, color: 'cccccc' } },
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 200 },
      children: [new TextRun({ text: '— End of Document —', size: 20, color: '999999', italics: true, font: 'Calibri' })],
    }),
  );

  const doc = new Document({
    creator: 'TopSqill BPM',
    title: `${formName} - Policy Document`,
    description: formDescription || `Policy document for ${formName}`,
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: docChildren }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${formName.replace(/[^a-zA-Z0-9]/g, '_')}_Policy_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, filename);
}

// ── Template-based policy document generator ──

export async function generatePolicyFromTemplate(options: PolicyTemplateOptions) {
  const { templateBuffer, formName, formDescription, fields, submissions } = options;

  // 1. Generate the policy data section as a standalone doc
  const policyChildren: (Paragraph | Table)[] = [];

  // Add a separator & heading
  policyChildren.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1, spacing: { after: 300 },
      children: [new TextRun({ text: 'Policies', bold: true, size: 32, color: '1a1a2e', font: 'Calibri' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: `The following policies are submitted under "${formName}". Total: ${submissions.length} policies.`,
        size: 22, font: 'Calibri',
      })],
    }),
  );

  policyChildren.push(...buildPolicyRecordsContent(fields, submissions));

  // Footer
  policyChildren.push(
    new Paragraph({
      spacing: { before: 800 },
      border: { top: { style: BorderStyle.SINGLE, size: 3, color: 'cccccc' } },
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 200 },
      children: [new TextRun({ text: '— End of Document —', size: 20, color: '999999', italics: true, font: 'Calibri' })],
    }),
  );

  const policyDoc = new Document({
    creator: 'TopSqill BPM',
    title: `${formName} - Policy Document`,
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: policyChildren }],
  });

  const policyBlob = await Packer.toBlob(policyDoc);

  // 2. Read both documents as zip
  const templateZip = await JSZip.loadAsync(templateBuffer);
  const policyBuffer = await policyBlob.arrayBuffer();
  const policyZip = await JSZip.loadAsync(policyBuffer);

  // 3. Extract document.xml from both
  const templateDocXml = await templateZip.file('word/document.xml')?.async('string');
  const policyDocXml = await policyZip.file('word/document.xml')?.async('string');

  if (!templateDocXml || !policyDocXml) {
    throw new Error('Invalid document format');
  }

  // 4. Extract body content from policy doc (between <w:body> and </w:body>)
  const policyBodyMatch = policyDocXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!policyBodyMatch) throw new Error('Could not parse policy document body');

  let policyBodyContent = policyBodyMatch[1];
  // Remove the sectPr from policy content (section properties) as template has its own
  policyBodyContent = policyBodyContent.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, '');

  // 5. Insert policy content before the closing </w:body> of the template
  // Find the last sectPr in template to preserve it
  const templateSectPrMatch = templateDocXml.match(/(<w:sectPr[\s\S]*?<\/w:sectPr>)\s*<\/w:body>/);

  let mergedDocXml: string;
  if (templateSectPrMatch) {
    // Insert policy content before the sectPr
    mergedDocXml = templateDocXml.replace(
      templateSectPrMatch[0],
      policyBodyContent + templateSectPrMatch[0],
    );
  } else {
    // No sectPr found, just insert before </w:body>
    mergedDocXml = templateDocXml.replace('</w:body>', policyBodyContent + '</w:body>');
  }

  // 6. Update the template zip with merged content
  templateZip.file('word/document.xml', mergedDocXml);

  // 7. Generate and save
  const mergedBlob = await templateZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const filename = `${formName.replace(/[^a-zA-Z0-9]/g, '_')}_Policy_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(mergedBlob, filename);
}
