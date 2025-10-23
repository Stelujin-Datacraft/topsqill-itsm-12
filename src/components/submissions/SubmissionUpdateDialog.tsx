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

interface SubmissionUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  onUpdateComplete: () => void;
}

interface ParsedSubmission {
  submissionId: string;
  [key: string]: any;
}

export function SubmissionUpdateDialog({
  open,
  onOpenChange,
  formId,
  onUpdateComplete,
}: SubmissionUpdateDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSubmission[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setParsedData([]);

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(selectedFile, {
        header: true,
        complete: (results) => {
          processData(results.data);
        },
        error: (error) => {
          setError(`Error parsing CSV: ${error.message}`);
        },
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          processData(jsonData);
        } catch (error) {
          setError('Error parsing Excel file');
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setError('Please upload a CSV or Excel file');
    }
  };

  const processData = (data: any[]) => {
    if (!data || data.length === 0) {
      setError('No data found in file');
      return;
    }

    // Check for Submission ID column
    const firstRow = data[0];
    const hasSubmissionId = 'Submission ID' in firstRow || 'submission_id' in firstRow || 'submissionId' in firstRow;

    if (!hasSubmissionId) {
      setError('File must contain a "Submission ID" column');
      return;
    }

    const processed = data
      .filter((row: any) => row['Submission ID'] || row['submission_id'] || row['submissionId'])
      .map((row: any) => {
        let submissionId = row['Submission ID'] || row['submission_id'] || row['submissionId'];
        // Strip the '#' prefix if present to match database format
        if (typeof submissionId === 'string' && submissionId.startsWith('#')) {
          submissionId = submissionId.substring(1);
        }
        const { 'Submission ID': _, submission_id: __, submissionId: ___, ...restData } = row;
        return {
          submissionId,
          ...restData,
        };
      });

    if (processed.length === 0) {
      setError('No valid submissions found in file');
      return;
    }

    setParsedData(processed);
  };

  const handleUpdate = async () => {
    if (parsedData.length === 0) {
      setError('No data to update');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // First, fetch form fields to map labels to field IDs
      const { data: formFields, error: fieldsError } = await supabase
        .from('form_fields')
        .select('id, label')
        .eq('form_id', formId);

      if (fieldsError) {
        setError('Failed to load form fields');
        setIsProcessing(false);
        return;
      }

      // Create label to field ID mapping
      const labelToFieldId = new Map<string, string>();
      formFields?.forEach(field => {
        labelToFieldId.set(field.label, field.id);
      });

      console.log('Label to Field ID mapping:', Object.fromEntries(labelToFieldId));

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const submission of parsedData) {
        try {
          console.log('Processing submission:', submission.submissionId, 'with data:', submission);
          
          // Fetch current submission by submission_ref_id (without # prefix)
          const { data: existingSubmission, error: fetchError } = await supabase
            .from('form_submissions')
            .select('id, submission_data')
            .eq('submission_ref_id', submission.submissionId)
            .eq('form_id', formId)
            .maybeSingle();

          console.log('Existing submission found:', existingSubmission);

          if (fetchError || !existingSubmission) {
            errorCount++;
            errors.push(`Submission #${submission.submissionId} not found`);
            console.error('Fetch error:', fetchError);
            continue;
          }

          // Transform new data: map field labels to field IDs
          const { submissionId, ...newDataWithLabels } = submission as { submissionId: string; [key: string]: any };
          const newData: Record<string, any> = {};
          
          Object.entries(newDataWithLabels).forEach(([label, value]) => {
            const fieldId = labelToFieldId.get(label);
            if (fieldId) {
              newData[fieldId] = value;
              console.log(`Mapped "${label}" -> "${fieldId}" = "${value}"`);
            } else {
              console.warn(`No field ID found for label: "${label}"`);
            }
          });

          // Merge existing data with new data (using field IDs)
          const currentData = typeof existingSubmission.submission_data === 'object' && existingSubmission.submission_data !== null 
            ? existingSubmission.submission_data 
            : {};
          const updatedSubmissionData = {
            ...currentData,
            ...newData,
          };

          console.log('Current data:', currentData);
          console.log('New data (mapped):', newData);
          console.log('Merged data:', updatedSubmissionData);

          // Update submission using the actual database ID
          const { error: updateError } = await supabase
            .from('form_submissions')
            .update({
              submission_data: updatedSubmissionData,
            })
            .eq('id', existingSubmission.id);

          if (updateError) {
            errorCount++;
            errors.push(`Failed to update #${submission.submissionId}: ${updateError.message}`);
            console.error('Update error:', updateError);
          } else {
            successCount++;
            console.log('Successfully updated submission:', submission.submissionId);
          }
        } catch (err) {
          errorCount++;
          errors.push(`Error updating #${submission.submissionId}`);
          console.error('Unexpected error:', err);
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Bulk update completed',
          description: `Successfully updated ${successCount} submission(s). ${errorCount > 0 ? `Failed: ${errorCount}` : ''}`,
        });
        onUpdateComplete();
        onOpenChange(false);
        resetDialog();
      } else {
        setError(`Failed to update any submissions. ${errors.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      console.error('Error updating submissions:', error);
      setError('An error occurred while updating submissions');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setParsedData([]);
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      onOpenChange(newOpen);
      if (!newOpen) resetDialog();
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Update Form Submissions</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with submission data to update. The file must include a "Submission ID" column to identify records.
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
                  {parsedData.slice(0, 5).map((submission, index) => (
                    <div key={index} className="text-xs font-mono">
                      ID: {submission.submissionId} - {Object.keys(submission).length - 1} field(s)
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
