// import React, { useState } from 'react';
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { useToast } from '@/hooks/use-toast';
// import * as XLSX from 'xlsx';
// import Papa from 'papaparse';
// import { supabase } from '@/integrations/supabase/client';
// import { Loader2, AlertCircle } from 'lucide-react';
// import { Alert, AlertDescription } from '@/components/ui/alert';

// interface SubmissionUpdateDialogProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   formId: string;
//   onUpdateComplete: () => void;
// }

// interface ParsedSubmission {
//   submissionId: string;
//   [key: string]: any;
// }

// export function SubmissionUpdateDialog({
//   open,
//   onOpenChange,
//   formId,
//   onUpdateComplete,
// }: SubmissionUpdateDialogProps) {
//   const [file, setFile] = useState<File | null>(null);
//   const [parsedData, setParsedData] = useState<ParsedSubmission[]>([]);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [error, setError] = useState<string>('');
//   const { toast } = useToast();

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const selectedFile = e.target.files?.[0];
//     if (!selectedFile) return;

//     setFile(selectedFile);
//     setError('');
//     setParsedData([]);

//     const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

//     if (fileExtension === 'csv') {
//       Papa.parse(selectedFile, {
//         header: true,
//         complete: (results) => {
//           processData(results.data);
//         },
//         error: (error) => {
//           setError(`Error parsing CSV: ${error.message}`);
//         },
//       });
//     } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         try {
//           const data = new Uint8Array(e.target?.result as ArrayBuffer);
//           const workbook = XLSX.read(data, { type: 'array' });
//           const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
//           const jsonData = XLSX.utils.sheet_to_json(firstSheet);
//           processData(jsonData);
//         } catch (error) {
//           setError('Error parsing Excel file');
//         }
//       };
//       reader.readAsArrayBuffer(selectedFile);
//     } else {
//       setError('Please upload a CSV or Excel file');
//     }
//   };

//   const processData = (data: any[]) => {
//     if (!data || data.length === 0) {
//       setError('No data found in file');
//       return;
//     }

//     // Check for Submission ID column
//     const firstRow = data[0];
//     const hasSubmissionId = 'Submission ID' in firstRow || 'submission_id' in firstRow || 'submissionId' in firstRow;

//     if (!hasSubmissionId) {
//       setError('File must contain a "Submission ID" column');
//       return;
//     }

//     const processed = data
//       .filter((row: any) => row['Submission ID'] || row['submission_id'] || row['submissionId'])
//       .map((row: any) => {
//         let submissionId = row['Submission ID'] || row['submission_id'] || row['submissionId'];
//         // Strip the '#' prefix if present to match database format
//         if (typeof submissionId === 'string' && submissionId.startsWith('#')) {
//           submissionId = submissionId.substring(1);
//         }
//         const { 'Submission ID': _, submission_id: __, submissionId: ___, ...restData } = row;
//         return {
//           submissionId,
//           ...restData,
//         };
//       });

//     if (processed.length === 0) {
//       setError('No valid submissions found in file');
//       return;
//     }

//     setParsedData(processed);
//   };

//   const handleUpdate = async () => {
//     if (parsedData.length === 0) {
//       setError('No data to update');
//       return;
//     }

//     setIsProcessing(true);
//     setError('');

//     try {
//       // First, fetch form fields to map labels to field IDs and get field types
//       const { data: formFields, error: fieldsError } = await supabase
//         .from('form_fields')
//         .select('id, label, field_type, custom_config')
//         .eq('form_id', formId);

//       if (fieldsError) {
//         setError('Failed to load form fields');
//         setIsProcessing(false);
//         return;
//       }

//       // Create label to field mapping
//       const labelToField = new Map<string, any>();
//       formFields?.forEach(field => {
//         labelToField.set(field.label, field);
//       });

//       console.log('Label to Field mapping:', Array.from(labelToField.entries()).map(([label, field]) => ({ label, id: field.id, type: field.field_type })));

//       let successCount = 0;
//       let errorCount = 0;
//       const errors: string[] = [];

//       for (const submission of parsedData) {
//         try {
//           console.log('Processing submission:', submission.submissionId, 'with data:', submission);
          
//           // Fetch current submission by submission_ref_id (without # prefix)
//           const { data: existingSubmission, error: fetchError } = await supabase
//             .from('form_submissions')
//             .select('id, submission_data')
//             .eq('submission_ref_id', submission.submissionId)
//             .eq('form_id', formId)
//             .maybeSingle();

//           console.log('Existing submission found:', existingSubmission);

//           if (fetchError || !existingSubmission) {
//             errorCount++;
//             errors.push(`Submission #${submission.submissionId} not found`);
//             console.error('Fetch error:', fetchError);
//             continue;
//           }

//           // Transform new data: map field labels to field IDs and handle cross-references
//           const { submissionId, ...newDataWithLabels } = submission as { submissionId: string; [key: string]: any };
//           const newData: Record<string, any> = {};
          
//           for (const [label, value] of Object.entries(newDataWithLabels)) {
//             const field = labelToField.get(label);
//             if (field) {
//               // Handle cross-reference fields
//               if (field.field_type === 'cross_reference') {
//                 console.log(`Processing cross-reference field "${label}":`, value);
//                 console.log(`Raw value type:`, typeof value);
                
//                 // Parse the value - could be JSON array string or comma-separated
//                 let submissionRefIds: string[] = [];
                
//                 if (typeof value === 'string') {
//                   // Remove any leading/trailing whitespace
//                   const trimmedValue = value.trim();
                  
//                   // Check if it looks like a JSON array: starts with [ and ends with ]
//                   if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
//                     try {
//                       // Try parsing as JSON array: "[TF1251024002, TF1251024001]"
//                       const parsed = JSON.parse(trimmedValue);
//                       if (Array.isArray(parsed)) {
//                         submissionRefIds = parsed.map(v => String(v).trim()).filter(Boolean);
//                       }
//                     } catch (e) {
//                       console.error('Failed to parse JSON array:', e);
//                       // Fall back to removing brackets and splitting by comma
//                       const withoutBrackets = trimmedValue.slice(1, -1);
//                       submissionRefIds = withoutBrackets.split(',').map(id => id.trim()).filter(Boolean);
//                     }
//                   } else {
//                     // Treat as comma-separated: "TF1251024002, TF1251024001" or "TF1251024002,TF1251024001"
//                     submissionRefIds = trimmedValue.split(',').map(id => id.trim()).filter(Boolean);
//                   }
//                 } else if (Array.isArray(value)) {
//                   submissionRefIds = value.map(v => String(v).trim()).filter(Boolean);
//                 } else {
//                   // Handle single value
//                   submissionRefIds = [String(value).trim()].filter(Boolean);
//                 }
                
//                 // Strip '#' prefix from all ref_ids to match database format
//                 submissionRefIds = submissionRefIds.map(id => 
//                   id.startsWith('#') ? id.substring(1) : id
//                 ).filter(Boolean);
                
//                 console.log('Parsed submission_ref_ids (should be separate):', submissionRefIds);
//                 console.log('Number of ref_ids:', submissionRefIds.length);
                
//                 if (submissionRefIds.length > 0) {
//                   // Get the target form ID and display columns from custom_config
//                   const targetFormId = field.custom_config?.targetFormId;
//                   const displayColumns = field.custom_config?.displayColumns || [];
                  
//                   if (!targetFormId) {
//                     console.warn(`No target form ID configured for cross-reference field: ${label}`);
//                     continue;
//                   }
                  
//                   // Get existing cross-reference values from submission_data
//                   const currentData = typeof existingSubmission.submission_data === 'object' && existingSubmission.submission_data !== null 
//                     ? existingSubmission.submission_data 
//                     : {};
//                   const existingCrossRefs = Array.isArray(currentData[field.id]) ? currentData[field.id] : [];
                  
//                   // Create a set of existing submission_ref_ids to avoid duplicates
//                   const existingRefIdSet = new Set(
//                     existingCrossRefs.map((ref: any) => ref?.submission_ref_id).filter(Boolean)
//                   );
                  
//                   console.log('Existing cross-refs in submission:', existingCrossRefs);
//                   console.log('Existing ref_ids:', Array.from(existingRefIdSet));
                  
//                   // Build cross-reference objects for new entries only
//                   const newCrossRefs: any[] = [];
                  
//                   for (const refId of submissionRefIds) {
//                     // Skip if already exists in current submission
//                     if (existingRefIdSet.has(refId)) {
//                       console.log(`Skipping duplicate ref_id: ${refId}`);
//                       continue;
//                     }
                    
//                     // Fetch the linked record to get its ID and submission_data
//                     const { data: record, error: recordError } = await supabase
//                       .from('form_submissions')
//                       .select('id, submission_ref_id, submission_data')
//                       .eq('form_id', targetFormId)
//                       .eq('submission_ref_id', refId)
//                       .maybeSingle();
                    
//                     if (recordError || !record) {
//                       console.warn(`Record not found for ref_id: ${refId}`, recordError);
//                       continue;
//                     }
                    
//                     // Build displayData object with configured display columns from the connected record
//                     const displayData: Record<string, any> = {};
//                     if (displayColumns.length > 0 && record.submission_data) {
//                       for (const columnId of displayColumns) {
//                         if (record.submission_data[columnId] !== undefined) {
//                           displayData[columnId] = record.submission_data[columnId];
//                         }
//                       }
//                     }
                    
//                     // Create the cross-reference object with EXACT structure required by the database:
//                     // { id: uuid, displayData: { fieldId: value }, submission_ref_id: string }
//                     const crossRefObject = {
//                       id: record.id,                              // UUID from form_submissions.id
//                       displayData: displayData,                   // Object with fieldId->value mapping
//                       submission_ref_id: record.submission_ref_id // String from form_submissions.submission_ref_id
//                     };
                    
//                     newCrossRefs.push(crossRefObject);
//                     console.log(`Added new cross-reference:`, JSON.stringify(crossRefObject, null, 2));
//                   }
                  
//                   // Merge existing and new cross-references
//                   newData[field.id] = [...existingCrossRefs, ...newCrossRefs];
                  
//                   console.log(`Final merged cross-reference array for "${label}":`, JSON.stringify(newData[field.id], null, 2));
//                   console.log(`Total count: ${newData[field.id].length} (${existingCrossRefs.length} existing + ${newCrossRefs.length} new)`);
//                 } else {
//                   console.warn(`No valid submission_ref_ids found for cross-reference field: ${label}`);
//                 }
//               } else {
//                 // Handle non-cross-reference fields normally
//                 newData[field.id] = value;
//                 console.log(`Mapped "${label}" -> "${field.id}" = "${value}"`);
//               }
//             } else {
//               console.warn(`No field found for label: "${label}"`);
//             }
//           }

//           // Merge existing data with new data (using field IDs)
//           const currentData = typeof existingSubmission.submission_data === 'object' && existingSubmission.submission_data !== null 
//             ? existingSubmission.submission_data 
//             : {};
//           const updatedSubmissionData = {
//             ...currentData,
//             ...newData,
//           };

//           console.log('Current data:', currentData);
//           console.log('New data (mapped):', newData);
//           console.log('Merged data:', updatedSubmissionData);
//           console.log('Updated submission_data (stringified):', JSON.stringify(updatedSubmissionData, null, 2));

//           // Update submission using the actual database ID
//           const { error: updateError } = await supabase
//             .from('form_submissions')
//             .update({
//               submission_data: updatedSubmissionData,
//             })
//             .eq('id', existingSubmission.id);

//           if (updateError) {
//             errorCount++;
//             errors.push(`Failed to update #${submission.submissionId}: ${updateError.message}`);
//             console.error('Update error:', updateError);
//           } else {
//             successCount++;
//             console.log('Successfully updated submission:', submission.submissionId);
//           }
//         } catch (err) {
//           errorCount++;
//           errors.push(`Error updating #${submission.submissionId}`);
//           console.error('Unexpected error:', err);
//         }
//       }

//       if (successCount > 0) {
//         toast({
//           title: 'Bulk update completed',
//           description: `Successfully updated ${successCount} submission(s). ${errorCount > 0 ? `Failed: ${errorCount}` : ''}`,
//         });
//         onUpdateComplete();
//         onOpenChange(false);
//         resetDialog();
//       } else {
//         setError(`Failed to update any submissions. ${errors.slice(0, 3).join(', ')}`);
//       }
//     } catch (error) {
//       console.error('Error updating submissions:', error);
//       setError('An error occurred while updating submissions');
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const resetDialog = () => {
//     setFile(null);
//     setParsedData([]);
//     setError('');
//   };

//   return (
//     <Dialog open={open} onOpenChange={(newOpen) => {
//       onOpenChange(newOpen);
//       if (!newOpen) resetDialog();
//     }}>
//       <DialogContent className="sm:max-w-[600px]">
//         <DialogHeader>
//           <DialogTitle>Update Form Submissions</DialogTitle>
//           <DialogDescription>
//             Upload a CSV or Excel file with submission data to update. The file must include a "Submission ID" column to identify records.
//           </DialogDescription>
//         </DialogHeader>

//         <div className="space-y-4">
//           <div>
//             <Label htmlFor="file">Select File</Label>
//             <Input
//               id="file"
//               type="file"
//               accept=".csv,.xlsx,.xls"
//               onChange={handleFileChange}
//               disabled={isProcessing}
//             />
//           </div>

//           {error && (
//             <Alert variant="destructive">
//               <AlertCircle className="h-4 w-4" />
//               <AlertDescription>{error}</AlertDescription>
//             </Alert>
//           )}

//           {parsedData.length > 0 && (
//             <div className="space-y-2">
//               <Label>Preview</Label>
//               <div className="border rounded-md p-4 bg-muted/50 max-h-[200px] overflow-y-auto">
//                 <p className="text-sm text-muted-foreground mb-2">
//                   Found {parsedData.length} submission(s) to update
//                 </p>
//                 <div className="space-y-1">
//                   {parsedData.slice(0, 5).map((submission, index) => (
//                     <div key={index} className="text-xs font-mono">
//                       ID: {submission.submissionId} - {Object.keys(submission).length - 1} field(s)
//                     </div>
//                   ))}
//                   {parsedData.length > 5 && (
//                     <p className="text-xs text-muted-foreground">
//                       ... and {parsedData.length - 5} more
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>

//         <DialogFooter>
//           <Button
//             variant="outline"
//             onClick={() => {
//               onOpenChange(false);
//               resetDialog();
//             }}
//             disabled={isProcessing}
//           >
//             Cancel
//           </Button>
//           <Button
//             onClick={handleUpdate}
//             disabled={parsedData.length === 0 || isProcessing}
//           >
//             {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//             Update {parsedData.length} Submission(s)
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, MapPin, CheckCircle2, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFieldType } from '@/data/fieldTypeMapping';

interface CSVData {
  headers: string[];
  rows: any[][];
  preview: any[];
}

interface FieldMapping {
  csvColumn: string;
  formField: string;
  isValid: boolean;
  errorMessage?: string;
}

export function SubmissionUpdateDialog({
  open,
  onOpenChange,
  formId,
  onUpdateComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  onUpdateComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  // ------------------ FILE HANDLING ------------------
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError("");
    setParsedData([]);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(selectedFile, {
        header: false,
        complete: (results) => {
          const headers = results.data[0] as string[];
          const rows = results.data.slice(1) as any[][];
          const preview = rows.slice(0, 5);
          setCsvData({ headers, rows, preview });
          setStep(2);
        },
        error: (err) => setError(`Error parsing CSV: ${err.message}`),
        skipEmptyLines: true,
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const headers = json[0] as string[];
          const rows = json.slice(1) as any[][];
          const preview = rows.slice(0, 5);
          setCsvData({ headers, rows, preview });
          setStep(2);
        } catch {
          setError("Error parsing Excel file");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setError("Please upload a CSV or Excel file");
    }
  }, []);

  // ------------------ FIELD MAPPING ------------------
  const getMappableFields = useCallback(() => {
    const nonMappableTypes = [
      'child-cross-reference', 
      'header',
      'description',
      'section-break',
      'horizontal-line',
      'record-table',
      'matrix-grid'
    ];
    
    return formFields.filter(field => !nonMappableTypes.includes(field.field_type));
  }, [formFields]);

  const initializeMappings = useCallback(async () => {
    if (!csvData) return;

    try {
      setIsProcessing(true);
      const { data: fields, error: fieldsErr } = await supabase
        .from("form_fields")
        .select("id, label, field_type, custom_config, required")
        .eq("form_id", formId);

      if (fieldsErr) throw new Error("Failed to load form fields");

      setFormFields(fields);

      const mappableFields = fields.filter(field => {
        const nonMappableTypes = [
          'cross-reference',
          'child-cross-reference', 
          'header',
          'description',
          'section-break',
          'horizontal-line',
          'record-table',
          'matrix-grid'
        ];
        return !nonMappableTypes.includes(field.field_type);
      });

      if (mappableFields.length === 0) {
        toast({
          title: "No Fields to Map",
          description: "This form has no fields that can be mapped with CSV data.",
          variant: "destructive",
        });
        return;
      }

      // Auto-match fields
      const newMappings = mappableFields.map(field => {
        const matchingHeader = csvData.headers.find(header => 
          header.toLowerCase().includes(field.label.toLowerCase()) ||
          header.toLowerCase().includes(field.id.toLowerCase())
        );

        return {
          csvColumn: matchingHeader || '',
          formField: field.id,
          isValid: !field.required || !!matchingHeader,
          errorMessage: field.required && !matchingHeader ? 'Required field must be mapped' : '',
        };
      });

      setMappings(newMappings);
      setStep(3);
    } catch (err) {
      console.error(err);
      setError("Failed to load form fields");
    } finally {
      setIsProcessing(false);
    }
  }, [csvData, formId, toast]);

  const handleMappingChange = useCallback((index: number, csvColumn: string, formFieldId: string) => {
    const formField = formFields.find(f => f.id === formFieldId);
    
    setMappings(prev => {
      const newMappings = [...prev];
      newMappings[index] = {
        csvColumn,
        formField: formFieldId,
        isValid: !formField?.required || !!csvColumn,
        errorMessage: formField?.required && !csvColumn ? 'Required field must be mapped' : '',
      };
      return newMappings;
    });
  }, [formFields]);

  // ------------------ MAIN UPDATE ------------------
  const handleUpdate = async () => {
    if (!csvData || !mappings.length) return;

    const mappableFields = getMappableFields();
    const requiredMappableFields = mappableFields.filter(f => f.required);
    const mappedRequiredFields = requiredMappableFields.filter(rf => 
      mappings.some(m => m.formField === rf.id && m.isValid && m.csvColumn)
    );

    if (mappedRequiredFields.length !== requiredMappableFields.length) {
      toast({
        title: "Missing Required Fields",
        description: "All required fields must be mapped to CSV columns.",
        variant: "destructive",
      });
      return;
    }

    const mappedFieldsWithErrors = mappings.filter(m => m.csvColumn && !m.isValid);
    if (mappedFieldsWithErrors.length > 0) {
      toast({
        title: "Invalid Mappings",
        description: "Please fix all mapping errors before updating.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const labelToField = new Map(formFields.map((f) => [f.label, f]));
      
      // Find Submission ID column
      const submissionIdColumn = csvData.headers.find(h => 
        h === "Submission ID" || h === "submission_id" || h === "submissionId"
      );

      if (!submissionIdColumn) {
        setError('File must contain a "Submission ID" column');
        return;
      }

      const submissionIdIndex = csvData.headers.indexOf(submissionIdColumn);

      let success = 0;
      let failed = 0;

      for (const row of csvData.rows) {
        let submissionId = row[submissionIdIndex];
        if (!submissionId) {
          failed++;
          continue;
        }

        if (typeof submissionId === "string" && submissionId.startsWith("#")) {
          submissionId = submissionId.substring(1);
        }

        const { data: existing, error: fetchErr } = await supabase
          .from("form_submissions")
          .select("id, submission_data")
          .eq("form_id", formId)
          .eq("submission_ref_id", submissionId)
          .maybeSingle();

        if (fetchErr || !existing) {
          failed++;
          continue;
        }

        const currentData =
          typeof existing.submission_data === "object" &&
          existing.submission_data !== null
            ? existing.submission_data
            : {};

        const newData: Record<string, any> = {};

        // Use mappings to extract data from CSV row
        for (const mapping of mappings) {
          if (!mapping.csvColumn || !mapping.formField) continue;

          const columnIndex = csvData.headers.indexOf(mapping.csvColumn);
          if (columnIndex === -1) continue;

          const value = row[columnIndex];
          const field = formFields.find(f => f.id === mapping.formField);
          if (!field) continue;

          if (field.field_type === "cross-reference") {
            console.log(`🧩 Processing cross-reference field: ${field.label}`);
            console.log("Raw value:", value);

            const isEmptyValue =
              value === "" ||
              value === null ||
              value === undefined ||
              (Array.isArray(value) && value.length === 0);

            if (isEmptyValue) {
              console.log(`⚙️ Removing cross-reference field for ${field.label}`);
              newData[field.id] = null;
              continue;
            }

            let refIds: string[] = [];
            if (typeof value === "string") {
              refIds = value
                .replace(/[\[\]#\s]/g, "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
            } else if (Array.isArray(value)) {
              refIds = value.map((v) => String(v).replace(/^#/, "").trim());
            } else if (value) {
              refIds = [String(value).replace(/^#/, "").trim()];
            }

            console.log(`Normalized refIds for ${field.label}:`, refIds);

            if (refIds.length === 0) {
              console.log(`No valid refIds found for ${field.label}, marking for deletion`);
              newData[field.id] = null;
              continue;
            }

            let customConfig: any = {};
            try {
              customConfig =
                typeof field.custom_config === "string"
                  ? JSON.parse(field.custom_config)
                  : field.custom_config || {};
            } catch (e) {
              console.warn(`Failed to parse custom_config for ${field.label}:`, e);
              customConfig = {};
            }

            const targetFormId = customConfig?.targetFormId;
            const displayColumns = customConfig?.displayColumns || [];

            if (!targetFormId) {
              console.error(
                `❌ Missing targetFormId for cross-reference field "${field.label}"`
              );
              continue;
            }

            const { data: targetRecords, error: refErr } = await supabase
              .from("form_submissions")
              .select("id, submission_ref_id, submission_data")
              .eq("form_id", targetFormId)
              .in("submission_ref_id", refIds);

            if (refErr) {
              console.error(`Error fetching linked records for ${field.label}:`, refErr);
              continue;
            }

            if (!targetRecords || targetRecords.length === 0) {
              console.warn(`No matching records found for ${field.label} with refIds:`, refIds);
              newData[field.id] = null;
              continue;
            }

            console.log(`Fetched ${targetRecords.length} linked records for ${field.label}`);

            const structuredRefs = targetRecords.map((rec) => {
              const displayData: Record<string, any> = {};
              for (const col of displayColumns) {
                if (rec.submission_data?.[col] !== undefined) {
                  displayData[col] = rec.submission_data[col];
                }
              }
              return {
                id: rec.id,
                displayData,
                submission_ref_id: rec.submission_ref_id,
              };
            });

            console.log(`✅ Final structuredRefs for ${field.label}:`, structuredRefs);
            newData[field.id] = structuredRefs;
          } else {
            newData[field.id] = value;
          }
        }

        const mergedData = structuredClone(currentData);

        for (const [key, value] of Object.entries(newData)) {
          const field = formFields.find((f) => f.id === key);
          if (field?.field_type === "cross-reference") {
            if (value === null || (Array.isArray(value) && value.length === 0)) {
              console.log(`🗑️ Removing cross-reference field from database: ${key}`);
              delete mergedData[key];
            } else {
              console.log(`🧹 Overwriting cross-reference field: ${key}`);
              mergedData[key] = value;
            }
          } else {
            mergedData[key] = value;
          }
        }

        const { error: updateErr } = await supabase
          .from("form_submissions")
          .update({ submission_data: mergedData })
          .eq("id", existing.id);

        if (updateErr) failed++;
        else success++;
      }

      toast({
        title: "Update Complete",
        description: `${success} updated, ${failed} failed.`,
      });

      onUpdateComplete?.();
      onOpenChange(false);
      resetDialog();
    } catch (err) {
      console.error(err);
      setError("Update failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDialog = () => {
    setStep(1);
    setFile(null);
    setCsvData(null);
    setParsedData([]);
    setMappings([]);
    setFormFields([]);
    setError("");
  };

  // ------------------ UI RETURN ------------------
  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) resetDialog();
      }}
    >
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Update Form Submissions
            <Badge variant="outline">Step {step} of 3</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Step 1: Upload File */}
          {step === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload File</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="file">Select CSV or Excel File</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileChange}
                        disabled={isProcessing}
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        File must include a "Submission ID" column to identify records.
                      </p>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Preview Data */}
          {step === 2 && csvData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preview Data</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Found {csvData.rows.length} rows. Showing first 5 rows for preview.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-96 border rounded">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          {csvData.headers.map((header, index) => (
                            <th key={index} className="p-2 text-left font-medium border-r">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.preview.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t">
                            {row.map((cell: any, cellIndex: number) => (
                              <td key={cellIndex} className="p-2 border-r text-sm">
                                {cell?.toString() || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={initializeMappings} disabled={isProcessing}>
                  {isProcessing ? 'Loading...' : 'Continue to Mapping'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Map Fields */}
          {step === 3 && csvData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Map CSV Columns to Form Fields
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Map form fields to CSV columns. Only required fields (*) must be mapped, others are optional.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getMappableFields().map((field, index) => {
                    const mapping = mappings[index];
                    return (
                      <div key={field.id} className="flex items-center gap-4 p-4 border rounded">
                        <div className="flex-1">
                          <Label className="flex items-center gap-1">
                            {field.label}
                            {field.required && <span className="text-destructive">*</span>}
                            <Badge variant="outline" className="ml-2">
                              {getFieldType(field.field_type)}
                            </Badge>
                          </Label>
                        </div>
                        
                        <div className="flex-1">
                          <Select
                            value={mapping?.csvColumn || ''}
                            onValueChange={(value) => handleMappingChange(index, value, field.id)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select CSV column" />
                            </SelectTrigger>
                            <SelectContent>
                              {csvData.headers.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-8 flex justify-center">
                          {mapping?.isValid ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : mapping?.csvColumn ? (
                            <AlertCircle className="h-5 w-5 text-destructive" />
                          ) : null}
                        </div>

                        {mapping?.errorMessage && (
                          <div className="flex-1 text-sm text-destructive">
                            {mapping.errorMessage}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back to Preview
                </Button>
                <Button 
                  onClick={handleUpdate} 
                  disabled={isProcessing || mappings.some(m => m.csvColumn && !m.isValid)}
                >
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isProcessing ? 'Updating...' : `Update ${csvData.rows.length} Records`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
