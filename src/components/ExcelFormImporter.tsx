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

  // Instructions sheet
  const instructionsData = [
    ['Excel Form Import Template - Instructions'],
    [''],
    ['How to use this template:'],
    ['1. Go to the "Form Fields" sheet'],
    ['2. Fill in your field details starting from Row 2'],
    ['3. Save the file and upload it in the app'],
    [''],
    ['Column Descriptions:'],
    ['Column', 'Description', 'Required?', 'Example'],
    ['Field Label', 'Display name of the field', 'Yes', 'Full Name'],
    ['Field Type', 'Type of input (see "Valid Types" sheet)', 'Yes', 'text'],
    ['Required', 'Whether field is mandatory (yes/no)', 'No (default: no)', 'yes'],
    ['Placeholder', 'Hint text shown inside the field', 'No', 'Enter your full name'],
    ['Options', 'Comma or pipe separated values for dropdowns/radio/etc.', 'Required for select/radio/multi-select', 'Option A, Option B, Option C'],
    ['Default Value', 'Pre-filled value', 'No', 'N/A'],
    ['Tooltip', 'Help text shown on hover', 'No', 'Please enter your legal name'],
    [''],
    ['Tips:'],
    ['- You can use friendly type names like "dropdown" instead of "select"'],
    ['- Options can use pipe "|" or comma "," as delimiter'],
    ['- The first two rows in "Form Fields" are the form name & description'],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 20 }, { wch: 55 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Form Fields sheet - every supported field type with realistic examples
  const formFieldsData = [
    ['Form Name:', 'Employee Onboarding Form', '', 'Form Description:', 'Complete onboarding form demonstrating every supported field type'],
    ['Field Label', 'Field Type', 'Required', 'Placeholder', 'Options (comma or pipe separated)', 'Default Value', 'Tooltip'],
    // --- Layout / Display Fields ---
    ['Personal Information', 'header', 'no', '', '', '', ''],
    ['Please fill all mandatory fields marked with *', 'description', 'no', '', '', '', ''],
    ['', 'section-break', 'no', '', '', '', ''],
    // --- Basic Input Fields ---
    ['Full Name', 'text', 'yes', 'Enter your full name', '', '', 'Your legal full name as per ID'],
    ['Bio / Summary', 'textarea', 'yes', 'Write a short bio...', '', '', 'Max 500 characters'],
    ['Age', 'number', 'yes', '25', '', '', 'Must be 18 or older'],
    ['Email Address', 'email', 'yes', 'user@example.com', '', '', 'Company email preferred'],
    ['Phone Number', 'phone', 'no', '+1 (555) 000-0000', '', '', 'Include country code'],
    ['Website / Portfolio', 'url', 'no', 'https://yoursite.com', '', '', ''],
    ['', 'horizontal-line', 'no', '', '', '', ''],
    // --- Date & Time Fields ---
    ['Date Inputs', 'header', 'no', '', '', '', ''],
    ['Date of Birth', 'date', 'yes', '', '', '', ''],
    ['Preferred Interview Time', 'time', 'no', '', '', '09:00', ''],
    ['Start Date & Time', 'datetime', 'no', '', '', '', 'When you will officially join'],
    ['', 'horizontal-line', 'no', '', '', '', ''],
    // --- Selection Fields ---
    ['Selection Inputs', 'header', 'no', '', '', '', ''],
    ['Department', 'select', 'yes', 'Select department', 'HR, Engineering, Marketing, Sales, Finance, Legal, Operations', '', 'Your primary department'],
    ['Technical Skills', 'multi-select', 'no', '', 'JavaScript, Python, SQL, Excel, Design, Docker, AWS', '', 'Select all that apply'],
    ['Gender', 'radio', 'no', '', 'Male, Female, Non-binary, Prefer not to say', '', ''],
    ['Accept Company Policy', 'checkbox', 'yes', '', 'I agree to company policy, I agree to NDA, I agree to code of conduct', '', 'You must agree to continue'],
    ['Available for Night Shift?', 'toggle-switch', 'no', '', '', 'no', 'Toggle on if available'],
    ['', 'horizontal-line', 'no', '', '', '', ''],
    // --- Numeric / Rating Fields ---
    ['Rating & Range', 'header', 'no', '', '', '', ''],
    ['Experience Level (years)', 'slider', 'no', '', '', '3', 'Drag to select 0-10 years'],
    ['Self Assessment', 'rating', 'no', '', '', '', 'Rate yourself from 1 to 5 stars'],
    ['', 'horizontal-line', 'no', '', '', '', ''],
    // --- Special Input Fields ---
    ['Special Inputs', 'header', 'no', '', '', '', ''],
    ['Profile Color', 'color', 'no', '', '', '#3B82F6', 'Pick your badge color'],
    ['Expected Salary', 'currency', 'no', '', '', '', 'Annual salary in USD'],
    ['Country of Origin', 'country', 'no', '', '', '', 'Select your country'],
    ['Home Address', 'address', 'no', 'Enter your full address', '', '', 'Street, City, State, ZIP'],
    ['IP Address', 'ip-address', 'no', '192.168.1.1', '', '', 'Your network IP'],
    ['Employee Barcode', 'barcode', 'no', '', '', '', 'Scan or enter barcode'],
    ['Office Location', 'geo-location', 'no', '', '', '', 'Pin your office on the map'],
    ['Skill Tags', 'tags', 'no', '', '', '', 'Type and press Enter to add tags'],
    ['', 'horizontal-line', 'no', '', '', '', ''],
    // --- File & Media Fields ---
    ['Uploads', 'header', 'no', '', '', '', ''],
    ['Upload Resume', 'file', 'no', '', '', '', 'PDF or DOCX only, max 10MB'],
    ['Profile Photo', 'image', 'no', '', '', '', 'JPEG or PNG, max 5MB'],
    ['Digital Signature', 'signature', 'no', '', '', '', 'Draw your signature here'],
    ['Rich Text Notes', 'rich-text', 'no', '', '', '', 'Supports bold, italic, lists'],
    ['', 'horizontal-line', 'no', '', '', '', ''],
    // --- People & Workflow Fields ---
    ['People & Workflow', 'header', 'no', '', '', '', ''],
    ['Assign Manager', 'user-picker', 'no', '', '', '', 'Select the reporting manager'],
    ['Assign Team', 'group-picker', 'no', '', '', '', 'Select the team/group'],
    ['Manager Approval', 'approval', 'no', '', '', '', 'Requires manager sign-off'],
    ['Dynamic City List', 'dynamic-dropdown', 'no', '', '', '', 'Options loaded dynamically'],
    ['Related Employee', 'cross-reference', 'no', '', '', '', 'Link to another record'],
    ['Calculated Score', 'calculated', 'no', '', '', '', 'Auto-calculated from other fields'],
    ['Show If Senior', 'conditional-section', 'no', '', '', '', 'Visible based on conditions'],
    ['Trigger Onboarding', 'workflow-trigger', 'no', '', '', '', 'Starts the onboarding workflow'],
  ];
  const wsFields = XLSX.utils.aoa_to_sheet(formFieldsData);
  wsFields['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 25 },
    { wch: 45 }, { wch: 15 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsFields, 'Form Fields');

  // Valid Types sheet
  const typesData = [
    ['Valid Field Types', 'Aliases (you can also use these)'],
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
    ['color', ''],
    ['url', 'link, website'],
    ['currency', 'money'],
    ['country', ''],
    ['address', ''],
    ['geo-location', 'location, gps, map'],
    ['header', 'heading, title'],
    ['description', 'paragraph, label'],
    ['section-break', ''],
    ['horizontal-line', 'divider, separator'],
    ['barcode', ''],
    ['user-picker', ''],
    ['group-picker', ''],
    ['approval', ''],
    ['rich-text', ''],
  ];
  const wsTypes = XLSX.utils.aoa_to_sheet(typesData);
  wsTypes['!cols'] = [{ wch: 20 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsTypes, 'Valid Types');

  XLSX.writeFile(wb, 'Form_Import_Template.xlsx');
  toast.success('Template downloaded!');
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
      headerRow.forEach((cell: any, idx: number) => {
        const key = String(cell).toLowerCase().trim();
        if (key.includes('label') || key.includes('field name') || key === 'name') colMap['label'] = idx;
        if (key.includes('type') || key.includes('field type')) colMap['type'] = idx;
        if (key.includes('required') || key.includes('mandatory')) colMap['required'] = idx;
        if (key.includes('placeholder') || key.includes('hint')) colMap['placeholder'] = idx;
        if (key.includes('option')) colMap['options'] = idx;
        if (key.includes('default')) colMap['default'] = idx;
        if (key.includes('tooltip') || key.includes('help')) colMap['tooltip'] = idx;
      });

      if (colMap['label'] === undefined) {
        toast.error('Could not find "Field Label" column. Please check your Excel headers.');
        setIsProcessing(false);
        return;
      }

      const dataRows = rows.slice(fieldStartRow + 1).filter(row => row && row[colMap['label']]);

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
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
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
                <p className="text-xs text-muted-foreground">Your Excel file should have these columns. Row 1 can optionally contain "Form Name:" and "Form Description:".</p>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  {/* Column descriptions */}
                  <div className="px-4 pb-3">
                    <p className="text-xs font-semibold mb-1.5">Required Columns</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs py-1">Column</TableHead>
                          <TableHead className="text-xs py-1">Description</TableHead>
                          <TableHead className="text-xs py-1">Required?</TableHead>
                          <TableHead className="text-xs py-1">Example</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ['Field Label', 'Display name of the field', 'Yes', 'Full Name'],
                          ['Field Type', 'Type of input (see below)', 'Yes', 'text'],
                          ['Required', 'yes / no', 'No (default: no)', 'yes'],
                          ['Placeholder', 'Hint text inside the field', 'No', 'Enter name'],
                          ['Options', 'Comma or pipe separated values', 'For select/radio/multi-select', 'HR, Eng, Sales'],
                          ['Default Value', 'Pre-filled value', 'No', 'N/A'],
                          ['Tooltip', 'Help text on hover', 'No', 'Enter legal name'],
                        ].map(([col, desc, req, ex], i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs py-1 font-medium">{col}</TableCell>
                            <TableCell className="text-xs py-1 text-muted-foreground">{desc}</TableCell>
                            <TableCell className="text-xs py-1">{req}</TableCell>
                            <TableCell className="text-xs py-1 font-mono">{ex}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Sample rows */}
                  <div className="px-4 pb-3">
                    <p className="text-xs font-semibold mb-1.5">Sample Rows (one per field type)</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs py-1">Label</TableHead>
                          <TableHead className="text-xs py-1">Type</TableHead>
                          <TableHead className="text-xs py-1">Required</TableHead>
                          <TableHead className="text-xs py-1">Placeholder</TableHead>
                          <TableHead className="text-xs py-1">Options</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ['Full Name', 'text', 'yes', 'Enter full name', ''],
                          ['Email', 'email', 'yes', 'user@example.com', ''],
                          ['Phone', 'phone', 'no', '+1 (555) 000-0000', ''],
                          ['Age', 'number', 'no', '25', ''],
                          ['Date of Birth', 'date', 'yes', '', ''],
                          ['Interview Time', 'time', 'no', '', ''],
                          ['Department', 'select', 'yes', 'Select...', 'HR, Eng, Sales'],
                          ['Skills', 'multi-select', 'no', '', 'JS, Python, SQL'],
                          ['Gender', 'radio', 'no', '', 'Male, Female, Other'],
                          ['Agree to Terms', 'checkbox', 'yes', '', ''],
                          ['Night Shift?', 'toggle-switch', 'no', '', ''],
                          ['Experience', 'slider', 'no', '', ''],
                          ['Rating', 'rating', 'no', '', ''],
                          ['Resume', 'file', 'no', '', ''],
                          ['Photo', 'image', 'no', '', ''],
                          ['Salary', 'currency', 'no', '', ''],
                          ['Country', 'country', 'no', '', ''],
                          ['Address', 'address', 'no', '', ''],
                          ['Location', 'geo-location', 'no', '', ''],
                          ['Website', 'url', 'no', 'https://...', ''],
                          ['Color', 'color', 'no', '', ''],
                          ['Tags', 'tags', 'no', '', ''],
                          ['Signature', 'signature', 'no', '', ''],
                          ['Comments', 'textarea', 'no', 'Write here...', ''],
                          ['Section Title', 'header', 'no', '', ''],
                          ['Divider', 'horizontal-line', 'no', '', ''],
                        ].map(([label, type, req, ph, opts], i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs py-1 font-medium">{label}</TableCell>
                            <TableCell className="text-xs py-1"><Badge variant="outline" className="text-[10px] px-1 py-0">{type}</Badge></TableCell>
                            <TableCell className="text-xs py-1">{req}</TableCell>
                            <TableCell className="text-xs py-1 text-muted-foreground">{ph || '—'}</TableCell>
                            <TableCell className="text-xs py-1 text-muted-foreground">{opts || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Aliases */}
                  <div className="px-4 pb-3">
                    <p className="text-xs font-semibold mb-1.5">Friendly Aliases (you can use these instead)</p>
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
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Options</TableHead>
                        <TableHead className="w-10">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedFields.map((field, idx) => (
                        <TableRow key={idx} className={!field.isValid ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{field.label}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{field.type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {field.required ? <Badge variant="secondary" className="text-xs">Yes</Badge> : 'No'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {field.options?.map(o => o.label).join(', ') || '—'}
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
          {parsedFields.length === 0 && !isProcessing && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium mb-1">Upload an Excel file or download the template first</p>
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
