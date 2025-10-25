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

import React, { useState } from 'react';
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
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  // ------------------ FILE HANDLING ------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError("");
    setParsedData([]);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(selectedFile, {
        header: true,
        complete: (results) => processData(results.data),
        error: (err) => setError(`Error parsing CSV: ${err.message}`),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet);
          processData(json);
        } catch {
          setError("Error parsing Excel file");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setError("Please upload a CSV or Excel file");
    }
  };

  const processData = (data: any[]) => {
    if (!data || data.length === 0) {
      setError("No data found in file");
      return;
    }

    const first = data[0];
    const hasId =
      "Submission ID" in first ||
      "submission_id" in first ||
      "submissionId" in first;

    if (!hasId) {
      setError('File must contain a "Submission ID" column');
      return;
    }

    const processed = data
      .filter(
        (row) =>
          row["Submission ID"] || row["submission_id"] || row["submissionId"]
      )
      .map((row) => {
        let id =
          row["Submission ID"] || row["submission_id"] || row["submissionId"];
        if (typeof id === "string" && id.startsWith("#")) id = id.substring(1);
        const { "Submission ID": _, submission_id: __, submissionId: ___, ...rest } =
          row;
        return { submissionId: id, ...rest };
      });

    setParsedData(processed);
  };

  // ------------------ MAIN UPDATE ------------------
  const handleUpdate = async () => {
    if (parsedData.length === 0) {
      setError("No data to update");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const { data: fields, error: fieldsErr } = await supabase
        .from("form_fields")
        .select("id, label, field_type, custom_config")
        .eq("form_id", formId);

      if (fieldsErr) throw new Error("Failed to load form fields");

      const labelToField = new Map(fields.map((f) => [f.label, f]));

      let success = 0;
      let failed = 0;

      for (const submission of parsedData) {
        const { submissionId, ...fieldsData } = submission;

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

 for (const [label, value] of Object.entries(fieldsData)) {
  const field = labelToField.get(label);
  if (!field) {
    console.warn(`No field found for label: "${label}"`);
    continue;
  }

  if (field.field_type === "cross_reference") {
    console.log(`🧩 Processing cross-reference field: ${label}`);
    console.log("Raw value:", value);

    // Check if value is explicitly empty or not provided
    const isEmptyValue = value === "" || value === null || value === undefined;
    
    if (isEmptyValue) {
      console.log(`Empty value provided for ${label}, clearing cross-reference data`);
      newData[field.id] = null; // Clear cross-reference field
      continue;
    }

    // --- STEP 1: Normalize submission_ref_ids ---
    let refIds: string[] = [];
    if (typeof value === "string") {
      refIds = value
        .replace(/[\[\]#\s]/g, "") // remove [ ], #, spaces
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (Array.isArray(value)) {
      refIds = value.map((v) =>
        String(v).replace(/^#/, "").trim()
      );
    } else if (value) {
      refIds = [String(value).replace(/^#/, "").trim()];
    }

    console.log(`Normalized refIds for ${label}:`, refIds);

    // If after normalization we have no valid IDs, skip
    if (refIds.length === 0) {
      console.log(`No valid refIds found for ${label}, skipping update`);
      continue;
    }

    // --- STEP 2: Parse custom_config safely ---
    let customConfig: any = {};
    try {
      customConfig =
        typeof field.custom_config === "string"
          ? JSON.parse(field.custom_config)
          : field.custom_config || {};
    } catch (e) {
      console.warn(`Failed to parse custom_config for ${label}:`, e);
      customConfig = {};
    }

    const targetFormId = customConfig?.targetFormId;
    const displayColumns = customConfig?.displayColumns || [];

    if (!targetFormId) {
      console.error(
        `❌ Missing targetFormId for cross-reference field "${label}"`
      );
      continue;
    }

    // --- STEP 3: Fetch referenced submissions ---
    const { data: targetRecords, error: refErr } = await supabase
      .from("form_submissions")
      .select("id, submission_ref_id, submission_data")
      .eq("form_id", targetFormId)
      .in("submission_ref_id", refIds);

    if (refErr) {
      console.error(`Error fetching linked records for ${label}:`, refErr);
      continue;
    }

    if (!targetRecords || targetRecords.length === 0) {
      console.warn(`No matching records found for ${label} with refIds:`, refIds);
      newData[field.id] = []; // Set empty array if no records found
      continue;
    }

    console.log(`Fetched ${targetRecords.length} linked records for ${label}`);

    // --- STEP 4: Build structured objects ---
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

    console.log(`✅ Final structuredRefs for ${label}:`, structuredRefs);

    // Replace existing data with new data (not merge)
    newData[field.id] = structuredRefs;
  } else {
    // Normal field
    newData[field.id] = value;
  }
}

        // ✅ Merge new data with current data
        // For cross-reference fields, REPLACE instead of merge
        // For other fields, update with new values
        const mergedData = { ...currentData, ...newData };

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
    setFile(null);
    setParsedData([]);
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Update Form Submissions</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to update submission data. The file must
            include a "Submission ID" column.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {parsedData.length > 0 && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border rounded-md p-4 bg-muted/50 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-muted-foreground mb-2">
                  Found {parsedData.length} submission(s) to update
                </p>
                <div className="space-y-1">
                  {parsedData.slice(0, 5).map((s, i) => (
                    <div key={i} className="text-xs font-mono">
                      ID: {s.submissionId} - {Object.keys(s).length - 1} field(s)
                    </div>
                  ))}
                  {parsedData.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      ... and {parsedData.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetDialog();
            }}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={parsedData.length === 0 || isProcessing}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update {parsedData.length} Submission(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
