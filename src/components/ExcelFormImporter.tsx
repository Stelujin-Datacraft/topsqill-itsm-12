import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Upload, Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ParsedField {
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string;
  tooltip?: string;
  makeUnique?: boolean;
  weightage?: number;
  validation?: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

interface ExcelFormImporterProps {
  onImport: (form: {
    name: string;
    description: string;
    fields: Array<{
      label: string;
      type: string;
      required: boolean;
      placeholder?: string;
      options?: Array<{ label: string; value: string }>;
      validation?: any;
    }>;
  }) => void;
}

const VALID_FIELD_TYPES = new Set([
  'header', 'description', 'section-break', 'horizontal-line', 'full-width-container',
  'rich-text', 'record-table', 'matrix-grid',
  'text', 'textarea', 'number', 'date', 'time', 'datetime',
  'select', 'multi-select', 'radio', 'checkbox', 'toggle-switch',
  'slider', 'rating', 'file', 'image', 'color',
  'country', 'phone', 'address', 'currency', 'email', 'url',
  'ip-address', 'barcode', 'user-picker', 'group-picker',
  'approval', 'signature', 'tags', 'dynamic-dropdown',
  'cross-reference', 'child-cross-reference', 'calculated', 'conditional-section',
  'geo-location', 'workflow-trigger', 'submission-access', 'query-field'
]);

const TYPE_ALIASES: Record<string, string> = {
  'string': 'text',
  'textbox': 'text',
  'input': 'text',
  'text-area': 'textarea',
  'multiline': 'textarea',
  'int': 'number',
  'integer': 'number',
  'float': 'number',
  'decimal': 'number',
  'numeric': 'number',
  'dropdown': 'select',
  'combo': 'select',
  'combobox': 'select',
  'multiselect': 'multi-select',
  'multi select': 'multi-select',
  'checkbox-group': 'checkbox',
  'check': 'checkbox',
  'bool': 'checkbox',
  'boolean': 'checkbox',
  'toggle': 'toggle-switch',
  'switch': 'toggle-switch',
  'radio-button': 'radio',
  'radio-group': 'radio',
  'datepicker': 'date',
  'date-picker': 'date',
  'timepicker': 'time',
  'time-picker': 'time',
  'datetime-picker': 'datetime',
  'date-time': 'datetime',
  'upload': 'file',
  'attachment': 'file',
  'picture': 'image',
  'photo': 'image',
  'star': 'rating',
  'stars': 'rating',
  'divider': 'horizontal-line',
  'separator': 'horizontal-line',
  'heading': 'header',
  'title': 'header',
  'paragraph': 'description',
  'label': 'description',
  'telephone': 'phone',
  'mobile': 'phone',
  'money': 'currency',
  'link': 'url',
  'website': 'url',
  'location': 'geo-location',
  'gps': 'geo-location',
  'map': 'geo-location',
  'sign': 'signature',
  'tag': 'tags',
};

const OPTION_FIELDS = new Set(['select', 'multi-select', 'radio', 'checkbox']);

const SAMPLE_ROWS_FOR_GUIDE = [
  ['Personal Information', 'header', '', '', '', '', '', '', ''],
  ['Complete all details', 'description', '', '', '', '', '', '', ''],
  ['Section - Identity', 'section-break', '', '', '', '', '', '', ''],
  ['Full Name', 'text', 'yes', 'Enter your full name', '', '', 'Legal name', 'yes', '10'],
  ['Email Address', 'email', 'yes', 'employee@company.com', '', '', 'Work email', 'yes', '10'],
  ['Phone Number', 'phone', 'no', '+1 555 000 0000', '', '', 'With country code', '', '5'],
  ['Age', 'number', 'no', 'e.g. 29', '', '', '', '', '3'],
  ['Bio', 'textarea', 'no', 'Tell us about yourself', '', '', '', '', '2'],
  ['Date of Birth', 'date', 'yes', '', '', '', '', '', '4'],
  ['Shift Start', 'time', 'no', '', '', '09:00', '', '', '2'],
  ['Join Date Time', 'datetime', 'no', '', '', '', '', '', '2'],
  ['Department', 'select', 'yes', 'Select dept', 'HR,Engineering,Sales', '', 'Choose one', 'yes', '8'],
  ['Skills', 'multi-select', 'no', '', 'Excel,SQL,Leadership', '', 'Choose multiple', '', '6'],
  ['Employment Type', 'radio', 'yes', '', 'Full Time,Part Time,Contract', '', '', '', '5'],
  ['Policy Agreement', 'checkbox', 'yes', '', 'NDA,Code of Conduct', '', 'Tick applicable', '', '4'],
  ['Night Shift', 'toggle-switch', 'no', '', '', 'no', '', '', '2'],
  ['Experience', 'slider', 'no', '', '', '3', '0-10 range', '', '3'],
  ['Self Rating', 'rating', 'no', '', '', '', '1-5 stars', '', '2'],
  ['Resume', 'file', 'no', '', '', '', 'PDF or DOCX', '', '1'],
  ['Profile Photo', 'image', 'no', '', '', '', 'JPEG/PNG', '', '1'],
  ['Address', 'address', 'no', 'Full address', '', '', '', '', '3'],
  ['Country', 'country', 'no', '', '', '', '', '', '2'],
  ['Portfolio URL', 'url', 'no', 'https://example.com', '', '', '', '', '2'],
  ['Salary', 'currency', 'no', '', '', '', 'Annual USD', '', '4'],
  ['Skill Tags', 'tags', 'no', '', '', '', 'Enter to add', '', '2'],
  ['Office Location', 'geo-location', 'no', '', '', '', 'Pin on map', '', '2'],
  ['Device IP', 'ip-address', 'no', '192.168.1.10', '', '', '', '', '1'],
  ['Barcode', 'barcode', 'no', '', '', '', '', '', '1'],
  ['Signature', 'signature', 'yes', '', '', '', 'Sign here', '', '1'],
  ['Related Record', 'cross-reference', 'no', '', '', '', '', '', '1'],
  ['Access', 'submission-access', 'no', '', '', '', '', '', '1'],
  ['Query', 'query-field', 'no', '', '', '', '', '', '1'],
  ['Divider', 'horizontal-line', '', '', '', '', '', '', ''],
];

const HEADER_ALIASES: Record<string, string[]> = {
  label: ['field label', 'label', 'field name', 'name', 'title'],
  type: ['field type', 'type', 'input type'],
  required: ['required', 'mandatory', 'is required'],
  placeholder: ['placeholder', 'hint', 'help text placeholder'],
  options: ['options', 'choices', 'values', 'option list'],
  default: ['default value', 'default', 'initial value'],
  tooltip: ['tooltip', 'help text', 'description'],
  unique: ['make field unique', 'field unique', 'is unique', 'unique'],
  weightage: ['field weightage', 'weightage', 'weight', 'field weight'],
};

const normalizeColumnName = (value: any): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const findColumnIndex = (headerRow: any[], aliases: string[]): number => {
  const normalizedHeaders = headerRow.map((cell) => normalizeColumnName(cell));
  const normalizedAliases = aliases.map((a) => normalizeColumnName(a));

  for (const alias of normalizedAliases) {
    const exactIdx = normalizedHeaders.findIndex((h) => h === alias);
    if (exactIdx >= 0) return exactIdx;
  }

  for (const alias of normalizedAliases) {
    const startsWithIdx = normalizedHeaders.findIndex((h) => h.startsWith(alias));
    if (startsWithIdx >= 0) return startsWithIdx;
  }

  for (const alias of normalizedAliases) {
    const containsIdx = normalizedHeaders.findIndex((h) => h.includes(alias) || alias.includes(h));
    if (containsIdx >= 0) return containsIdx;
  }

  return -1;
};

function resolveFieldType(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  if (VALID_FIELD_TYPES.has(normalized)) return normalized;
  return TYPE_ALIASES[normalized] || 'text';
}

function parseOptions(raw: string | undefined): Array<{ label: string; value: string }> | undefined {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return undefined;
  // Support both comma and pipe delimiters
  const delimiter = raw.includes('|') ? '|' : ',';
  return raw.split(delimiter).map(o => o.trim()).filter(Boolean).map(o => ({
    label: o,
    value: o.toLowerCase().replace(/\s+/g, '_'),
  }));
}

function parseBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  const str = String(val).toLowerCase().trim();
  return ['yes', 'true', '1', 'y'].includes(str);
}

function generateTemplate() {
  const wb = XLSX.utils.book_new();

  const acceptedHeaders = [
    'Field Label',
    'Field Type',
    'Required',
    'Placeholder',
    'Options',
    'Default Value',
    'Tooltip',
    'Make Field Unique',
    'Field Weightage',
  ];

  const SAMPLE_ROWS = [
    ['Personal Information', 'header', '—', '—', '—', '—', '—', '—', '—'],
    ['Complete all details', 'description', '—', '—', '—', '—', '—', '—', '—'],
    ['Section - Identity', 'section-break', '—', '—', '—', '—', '—', '—', '—'],
    ['Full Name', 'text', 'yes', 'Enter your full name', '—', '—', 'Legal name', 'yes', '10'],
    ['Email Address', 'email', 'yes', 'employee@company.com', '—', '—', 'Work email', 'yes', '10'],
    ['Phone Number', 'phone', 'no', '+1 555 000 0000', '—', '—', 'With country code', '—', '5'],
    ['Age', 'number', 'no', 'e.g. 29', '—', '—', '—', '—', '3'],
    ['Bio', 'textarea', 'no', 'Tell us about yourself', '—', '—', '—', '—', '2'],
    ['Date of Birth', 'date', 'yes', '—', '—', '—', '—', '—', '4'],
    ['Shift Start', 'time', 'no', '—', '—', '09:00', '—', '—', '2'],
    ['Join Date Time', 'datetime', 'no', '—', '—', '—', '—', '—', '2'],
    ['Department', 'select', 'yes', 'Select dept', 'HR,Engineering,Sales', '—', 'Choose one', 'yes', '8'],
    ['Skills', 'multi-select', 'no', '—', 'Excel,SQL,Leadership', '—', 'Choose multiple', '—', '6'],
    ['Employment Type', 'radio', 'yes', '—', 'Full Time,Part Time,Contract', '—', '—', '—', '5'],
    ['Policy Agreement', 'checkbox', 'yes', '—', 'NDA,Code of Conduct', '—', 'Tick applicable', '—', '4'],
    ['Night Shift', 'toggle-switch', 'no', '—', '—', 'no', '—', '—', '2'],
    ['Experience', 'slider', 'no', '—', '—', '3', '0-10 range', '—', '3'],
    ['Self Rating', 'rating', 'no', '—', '—', '—', '1-5 stars', '—', '2'],
    ['Resume', 'file', 'no', '—', '—', '—', 'PDF or DOCX', '—', '1'],
    ['Profile Photo', 'image', 'no', '—', '—', '—', 'JPEG/PNG', '—', '1'],
    ['Address', 'address', 'no', 'Full address', '—', '—', '—', '—', '3'],
    ['Country', 'country', 'no', '—', '—', '—', '—', '—', '2'],
    ['Portfolio URL', 'url', 'no', 'https://example.com', '—', '—', '—', '—', '2'],
    ['Salary', 'currency', 'no', '—', '—', '—', 'Annual USD', '—', '4'],
    ['Skill Tags', 'tags', 'no', '—', '—', '—', 'Enter to add', '—', '2'],
    ['Office Location', 'geo-location', 'no', '—', '—', '—', 'Pin on map', '—', '2'],
    ['Device IP', 'ip-address', 'no', '192.168.1.10', '—', '—', '—', '—', '1'],
    ['Barcode', 'barcode', 'no', '—', '—', '—', '—', '—', '1'],
    ['Signature', 'signature', 'yes', '—', '—', '—', 'Sign here', '—', '1'],
    ['Related Record', 'cross-reference', 'no', '—', '—', '—', '—', '—', '1'],
    ['Access', 'submission-access', 'no', '—', '—', '—', '—', '—', '1'],
    ['Query', 'query-field', 'no', '—', '—', '—', '—', '—', '1'],
    ['Divider', 'horizontal-line', '—', '—', '—', '—', '—', '—', '—'],
  ];
  const formFieldsData = [
    acceptedHeaders,
    ...SAMPLE_ROWS,
  ];

  const wsFields = XLSX.utils.aoa_to_sheet(formFieldsData);
  wsFields['!cols'] = [
    { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 28 }, { wch: 42 },
    { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsFields, 'Form Fields');

  const typesData = [
    ['Valid Field Types', 'Aliases'],
    ['text', 'string, textbox, input'],
    ['textarea', 'text-area, multiline'],
    ['number', 'int, integer, float, decimal, numeric'],
    ['email', ''],
    ['phone', 'telephone, mobile'],
    ['date', 'datepicker, date-picker'],
    ['time', 'timepicker, time-picker'],
    ['datetime', 'datetime-picker, date-time'],
    ['select', 'dropdown, combo, combobox'],
    ['multi-select', 'multiselect, multi select'],
    ['radio', 'radio-button, radio-group'],
    ['checkbox', 'check, bool, boolean, checkbox-group'],
    ['toggle-switch', 'toggle, switch'],
    ['slider', ''],
    ['rating', 'star, stars'],
    ['file', 'upload, attachment'],
    ['image', 'picture, photo'],
    ['signature', 'sign'],
    ['tags', 'tag'],
    ['url', 'link, website'],
    ['currency', 'money'],
    ['country', ''],
    ['address', ''],
    ['geo-location', 'location, gps, map'],
    ['header', 'heading, title'],
    ['description', 'paragraph'],
    ['section-break', ''],
    ['horizontal-line', 'divider, separator'],
    ['barcode', ''],
  ];

  XLSX.writeFile(wb, `Form_Import_Template_${Date.now()}.xlsx`);
  toast.success('New sample template downloaded');
}

export function ExcelFormImporter({ onImport }: ExcelFormImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedFields, setParsedFields] = useState<ParsedField[]>([]);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      // Try to find "Form Fields" sheet, otherwise use first sheet
      const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('form')) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) {
        toast.error('Excel file must have at least 2 rows (header + data)');
        setIsProcessing(false);
        return;
      }

      // Check if Row 1 contains form metadata (Form Name: ...)
      let fieldStartRow = 0;
      const firstCell = String(rows[0]?.[0] || '').toLowerCase();

      if (firstCell.includes('form name') || firstCell.includes('form_name')) {
        setFormName(String(rows[0]?.[1] || 'Imported Form'));
        const descIdx = rows[0].findIndex((c: any) => String(c).toLowerCase().includes('description'));
        if (descIdx >= 0 && rows[0][descIdx + 1]) {
          setFormDescription(String(rows[0][descIdx + 1]));
        }
        fieldStartRow = 1; // headers are on row 2
      }

      // Find header row
      const headerRow = rows[fieldStartRow];
      if (!headerRow) {
        toast.error('Could not find column headers');
        setIsProcessing(false);
        return;
      }

      const colMap: Record<string, number> = {};
      (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>).forEach((fieldKey) => {
        const idx = findColumnIndex(headerRow, HEADER_ALIASES[fieldKey]);
        if (idx >= 0) {
          colMap[fieldKey] = idx;
        }
      });

      if (colMap['label'] === undefined) {
        const visibleHeaders = headerRow
          .map((cell: any) => String(cell ?? '').trim())
          .filter(Boolean)
          .join(', ');

        toast.error(
          `Could not find \"Field Label\" column. Use headers like: Field Label, Field Type, Placeholder, Options, Default Value, Tooltip, Make Field Unique, Field Weightage. Found: ${visibleHeaders || 'no headers'}`
        );
        setIsProcessing(false);
        return;
      }

      const LAYOUT_TYPES = new Set(['header', 'description', 'section-break', 'horizontal-line', 'full-width-container']);
      const dataRows = rows.slice(fieldStartRow + 1).filter(row => {
        if (!row) return false;
        const hasLabel = row[colMap['label']] && String(row[colMap['label']]).trim();
        const rawType = colMap['type'] !== undefined ? String(row[colMap['type']] || '').trim().toLowerCase() : '';
        const resolvedType = rawType ? resolveFieldType(rawType) : '';
        // Keep row if it has a label OR if it's a layout type (which may not need a label)
        return hasLabel || LAYOUT_TYPES.has(resolvedType);
      });

      const fields: ParsedField[] = dataRows.map((row) => {
        const errors: string[] = [];
        const rawLabel = String(row[colMap['label']] || '').trim();
        const rawType = String(row[colMap['type']] || 'text').trim();
        const resolvedType = resolveFieldType(rawType);

        if (!rawLabel) errors.push('Label is empty');

        const options = parseOptions(row[colMap['options']] !== undefined ? String(row[colMap['options']]) : undefined);

        if (OPTION_FIELDS.has(resolvedType) && (!options || options.length === 0)) {
          errors.push(`"${resolvedType}" requires options`);
        }

        return {
          label: rawLabel,
          type: resolvedType,
          required: colMap['required'] !== undefined ? parseBoolean(row[colMap['required']]) : false,
          placeholder: colMap['placeholder'] !== undefined ? String(row[colMap['placeholder']] || '') : undefined,
          options: options,
          defaultValue: colMap['default'] !== undefined ? String(row[colMap['default']] || '') : undefined,
          tooltip: colMap['tooltip'] !== undefined ? String(row[colMap['tooltip']] || '') : undefined,
          makeUnique: colMap['unique'] !== undefined ? parseBoolean(row[colMap['unique']]) : false,
          weightage: colMap['weightage'] !== undefined ? (Number(row[colMap['weightage']]) || 0) : 0,
          isValid: errors.length === 0,
          errors,
        };
      });

      setParsedFields(fields);

      if (!formName) {
        // Derive form name from filename
        setFormName(file.name.replace(/\.(xlsx?|csv)$/i, '').replace(/[_-]/g, ' '));
      }

      const validCount = fields.filter(f => f.isValid).length;
      toast.success(`Parsed ${fields.length} fields (${validCount} valid)`);
    } catch (err) {
      console.error('Excel parse error:', err);
      toast.error('Failed to parse Excel file. Please check the format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    const validFields = parsedFields.filter(f => f.isValid);
    if (validFields.length === 0) {
      toast.error('No valid fields to import');
      return;
    }

    onImport({
      name: formName || 'Imported Form',
      description: formDescription || '',
      fields: validFields.map(f => ({
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder || undefined,
        options: f.options,
        validation: undefined,
      })),
    });

    setIsOpen(false);
    resetState();
  };

  const resetState = () => {
    setParsedFields([]);
    setFormName('');
    setFormDescription('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedFields.filter(f => f.isValid).length;
  const invalidCount = parsedFields.filter(f => !f.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Import from Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">        <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Import Form from Excel
        </DialogTitle>
        <DialogDescription>
          Upload an Excel file to create a form with all fields automatically.
        </DialogDescription>
      </DialogHeader>

        <div className="space-y-4">
          {/* Actions row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowGuide(v => !v)} className="gap-2">
              {showGuide ? <AlertCircle className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
              {showGuide ? 'Hide Guide' : 'View Template Guide'}
            </Button>
            <Button variant="outline" size="sm" onClick={generateTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Download Sample Excel
            </Button>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-form-upload"
              />
              <Button
                variant="default"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Upload Excel File</>
                )}
              </Button>
              {fileName && (
                <span className="ml-2 text-xs text-muted-foreground">{fileName}</span>
              )}
            </div>
          </div>

          {/* Inline Template Guide */}
          {showGuide && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Excel Template Guide</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Exact upload-ready format. Use this header row as-is:
                </p>
                <code className="text-[11px] rounded bg-muted px-2 py-1 block break-words">
                  Field Label | Field Type | Required | Placeholder | Options | Default Value | Tooltip | Make Field Unique | Field Weightage
                </code>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="px-4 pb-3 overflow-x-auto">
                    <p className="text-xs font-semibold mb-1.5">Sample Rows (all supported field types)</p>
                    <div className="min-w-[900px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Field Label</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Field Type</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Required</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Placeholder</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Options</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Default Value</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Tooltip</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Make Field Unique</TableHead>
                            <TableHead className="text-xs py-1 whitespace-nowrap">Field Weightage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {SAMPLE_ROWS_FOR_GUIDE.map((row, i) => (
                            <TableRow key={i}>
                              {row.map((cell, j) => (
                                <TableCell key={j} className="text-xs py-1 text-muted-foreground whitespace-nowrap">
                                  {cell || '—'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="px-4 pb-3">
                    <p className="text-xs font-semibold mb-1.5">Friendly Aliases</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(TYPE_ALIASES).slice(0, 20).map(([alias, target]) => (
                        <Badge key={alias} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {alias} → {target}
                        </Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">...and more</span>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {parsedFields.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{formName || 'Imported Form'}</span>
                  <div className="flex gap-1.5">
                    <Badge variant="secondary">{validCount} valid</Badge>
                    {invalidCount > 0 && (
                      <Badge variant="destructive">{invalidCount} errors</Badge>
                    )}
                  </div>
                </CardTitle>
                {formDescription && (
                  <p className="text-sm text-muted-foreground">{formDescription}</p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8 whitespace-nowrap">#</TableHead>
                            <TableHead className="whitespace-nowrap">Field Label</TableHead>
                            <TableHead className="whitespace-nowrap">Field Type</TableHead>
                            <TableHead className="whitespace-nowrap">Required</TableHead>
                            <TableHead className="whitespace-nowrap">Placeholder</TableHead>
                            <TableHead className="whitespace-nowrap">Options</TableHead>
                            <TableHead className="whitespace-nowrap">Default</TableHead>
                            <TableHead className="whitespace-nowrap">Tooltip</TableHead>
                            <TableHead className="whitespace-nowrap">Make Field Unique</TableHead>
                            <TableHead className="whitespace-nowrap">Field Weightage</TableHead>
                            <TableHead className="w-10 whitespace-nowrap">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedFields.map((field, idx) => (
                            <TableRow key={idx} className={!field.isValid ? 'bg-destructive/5' : ''}>
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-medium text-sm whitespace-nowrap">{field.label}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs whitespace-nowrap">{field.type}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {field.required ? <Badge variant="secondary" className="text-xs">Yes</Badge> : 'No'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                {field.placeholder || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                                {field.options?.map(o => o.label).join(', ') || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {field.defaultValue || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                {field.tooltip || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {field.makeUnique ? <Badge variant="secondary" className="text-xs">Yes</Badge> : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {field.weightage ? field.weightage : '—'}
                              </TableCell>
                              <TableCell>
                                {field.isValid ? (
                                  <Check className="h-4 w-4 text-primary" />
                                ) : (
                                  <span title={field.errors.join(', ')}>
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Apply button */}
          {parsedFields.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { resetState(); }}>
                Clear
              </Button>
              <Button onClick={handleApply} disabled={validCount === 0}>
                <Check className="h-4 w-4 mr-2" />
                Create Form ({validCount} fields)
              </Button>
            </div>
          )}

          {/* Help text when no file uploaded */}
          {/* Help text when no file uploaded */}
          {parsedFields.length === 0 && !isProcessing && !showGuide && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium mb-1">
                Upload an Excel file or download the template first
              </p>
              <p className="text-xs">
                The template includes instructions, example fields, and a complete list of valid field types.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
