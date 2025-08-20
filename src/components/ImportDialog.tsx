import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, AlertCircle, CheckCircle2, FileText, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import { getFieldType } from '@/data/fieldTypeMapping';

interface ImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formFields: any[];
  onImportComplete: () => void;
}

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

  const FIELD_TYPE_VALIDATION = {
    email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    number: (value: string) => !isNaN(Number(value)) && value.trim() !== '',
    date: (value: string) => !isNaN(Date.parse(value)),
    boolean: (value: string) => ['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase()),
    select: (value: string, field: any) => validateSelectField(value, field),
    radio: (value: string, field: any) => validateSelectField(value, field),
    multiselect: (value: string, field: any) => validateSelectField(value, field),
  };

  const validateSelectField = (value: string, field: any) => {
    if (!value || value.trim() === '') return true; // Empty values are handled by required field validation
    
    const options = field.field_options?.options || [];
    const allowOthers = field.field_options?.allow_others || false;
    
    // For multiselect, split by comma and check each value
    if (field.field_type === 'multiselect') {
      const values = value.split(',').map(v => v.trim());
      return values.every(v => 
        options.some((opt: any) => opt.value === v || opt.label === v) || allowOthers
      );
    }
    
    // For single select (radio/select), check if value exists in options
    const isValidOption = options.some((opt: any) => opt.value === value || opt.label === value);
    return isValidOption || allowOthers;
  };

export function ImportDialog({ isOpen, onOpenChange, formId, formFields, onImportComplete }: ImportDialogProps) {
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileUrl, setFileUrl] = useState('');

  const resetDialog = useCallback(() => {
    setStep(1);
    setCsvData(null);
    setMappings([]);
    setFileUrl('');
    setIsProcessing(false);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0) {
          toast({
            title: "CSV Parse Error",
            description: results.errors[0].message,
            variant: "destructive",
          });
          return;
        }

        const headers = results.data[0] as string[];
        const rows = results.data.slice(1) as any[][];
        const preview = rows.slice(0, 5);

        setCsvData({ headers, rows, preview });
        setStep(2);
      },
      header: false,
      skipEmptyLines: true,
    });
  }, []);

  const handleUrlImport = useCallback(async () => {
    if (!fileUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch(fileUrl);
      const csvText = await response.text();

      Papa.parse(csvText, {
        complete: (results) => {
          if (results.errors.length > 0) {
            toast({
              title: "CSV Parse Error",
              description: results.errors[0].message,
              variant: "destructive",
            });
            return;
          }

          const headers = results.data[0] as string[];
          const rows = results.data.slice(1) as any[][];
          const preview = rows.slice(0, 5);

          setCsvData({ headers, rows, preview });
          setStep(2);
        },
        header: false,
        skipEmptyLines: true,
      });
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to fetch CSV from URL.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fileUrl]);

  const validateMapping = useCallback((csvColumn: string, formField: any, sampleData: any[]) => {
    if (!csvColumn || !formField) return { isValid: false, errorMessage: 'Missing selection' };

    const fieldType = getFieldType(formField.field_type);
    const columnIndex = csvData?.headers.indexOf(csvColumn) ?? -1;
    
    if (columnIndex === -1) return { isValid: false, errorMessage: 'Column not found' };

    // Check required fields
    if (formField.required) {
      const hasEmptyValues = sampleData.some(row => !row[columnIndex] || row[columnIndex].toString().trim() === '');
      if (hasEmptyValues) {
        return { isValid: false, errorMessage: 'Required field has empty values in CSV' };
      }
    }

    // Type validation
    if (FIELD_TYPE_VALIDATION[fieldType as keyof typeof FIELD_TYPE_VALIDATION]) {
      const validator = FIELD_TYPE_VALIDATION[fieldType as keyof typeof FIELD_TYPE_VALIDATION];
      const hasInvalidValues = sampleData.some(row => {
        const value = row[columnIndex]?.toString().trim();
        if (!value) return false; // Skip empty values
        
        // For select-type fields, pass the field object for options validation
        if (['select', 'radio', 'multiselect'].includes(fieldType)) {
          return !validator(value, formField);
        }
        
        return !(validator as any)(value);
      });
      
      if (hasInvalidValues) {
        if (['select', 'radio', 'multiselect'].includes(fieldType)) {
          const allowOthers = formField.field_options?.allow_others || false;
          return { 
            isValid: false, 
            errorMessage: allowOthers 
              ? `Some values in CSV don't match field options` 
              : `Some values in CSV don't match field options. Enable "Allow Others" or fix CSV data.` 
          };
        }
        return { isValid: false, errorMessage: `Invalid ${fieldType} format in CSV data` };
      }
    }

    return { isValid: true };
  }, [csvData]);

  const handleMappingChange = useCallback((index: number, csvColumn: string, formFieldId: string) => {
    const formField = formFields.find(f => f.id === formFieldId);
    const validation = validateMapping(csvColumn, formField, csvData?.preview || []);
    
    setMappings(prev => {
      const newMappings = [...prev];
      newMappings[index] = {
        csvColumn,
        formField: formFieldId,
        isValid: validation.isValid,
        errorMessage: validation.errorMessage,
      };
      return newMappings;
    });
  }, [formFields, csvData, validateMapping]);

  // Filter out non-mappable fields (cross-reference, headers, descriptions, etc.)
  const getMappableFields = useCallback(() => {
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
    
    return formFields.filter(field => !nonMappableTypes.includes(field.field_type));
  }, [formFields]);

  const initializeMappings = useCallback(() => {
    if (!csvData || !formFields.length) return;

    const mappableFields = getMappableFields();
    
    // Check if there are no mappable fields
    if (mappableFields.length === 0) {
      toast({
        title: "No Fields to Map",
        description: "This form has no fields that can be mapped with CSV data. Please correct your form structure and try again.",
        variant: "destructive",
      });
      return;
    }

    const newMappings = mappableFields.map(field => {
      // Try to auto-match by field label or ID
      const matchingHeader = csvData.headers.find(header => 
        header.toLowerCase().includes(field.label.toLowerCase()) ||
        header.toLowerCase().includes(field.id.toLowerCase())
      );

      const validation = matchingHeader ? 
        validateMapping(matchingHeader, field, csvData.preview) :
        { isValid: !field.required, errorMessage: field.required ? 'Required field must be mapped' : '' };

      return {
        csvColumn: matchingHeader || '',
        formField: field.id,
        isValid: validation.isValid,
        errorMessage: validation.errorMessage,
      };
    });

    setMappings(newMappings);
    setStep(3);
  }, [csvData, formFields, validateMapping, getMappableFields]);

  const handleImport = useCallback(async () => {
    if (!csvData || !mappings.length) return;

    const mappableFields = getMappableFields();
    const requiredMappableFields = mappableFields.filter(f => f.required);
    const mappedRequiredFields = requiredMappableFields.filter(rf => 
      mappings.some(m => m.formField === rf.id && m.isValid && m.csvColumn)
    );

    // Only check required field mappings
    if (mappedRequiredFields.length !== requiredMappableFields.length) {
      toast({
        title: "Missing Required Fields",
        description: "All required fields must be mapped to CSV columns.",
        variant: "destructive",
      });
      return;
    }

    // Check for mapping errors only on mapped fields
    const mappedFieldsWithErrors = mappings.filter(m => m.csvColumn && !m.isValid);
    if (mappedFieldsWithErrors.length > 0) {
      toast({
        title: "Invalid Mappings",
        description: "Please fix all mapping errors before importing.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);

      // Get current user once
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      const submissions = csvData.rows.map(row => {
        const submissionData: Record<string, any> = {};
        
        mappings.forEach(mapping => {
          if (mapping.csvColumn && mapping.formField) {
            const columnIndex = csvData.headers.indexOf(mapping.csvColumn);
            if (columnIndex !== -1) {
              submissionData[mapping.formField] = row[columnIndex];
            }
          }
        });

        return {
          form_id: formId,
          submission_data: submissionData,
          submitted_by: currentUserId,
        };
      });

      const { error } = await supabase
        .from('form_submissions')
        .insert(submissions);

      if (error) throw error;

      toast({
        title: "Import Successful",
        description: `Successfully imported ${submissions.length} submissions.`,
      });

      onImportComplete();
      onOpenChange(false);
      resetDialog();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Error",
        description: "Failed to import data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [csvData, mappings, formFields, formId, onImportComplete, onOpenChange, resetDialog]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import CSV Data
            <Badge variant="outline">Step {step} of 3</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 1 && (
            <div className="space-y-6">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList>
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload File
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Import from URL
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload CSV File</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <Label htmlFor="csv-upload" className="cursor-pointer">
                          <span className="text-lg font-medium">Choose CSV file</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            Click to browse or drag and drop
                          </p>
                        </Label>
                        <Input
                          id="csv-upload"
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="url" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Import from URL</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="csv-url">CSV File URL</Label>
                        <Input
                          id="csv-url"
                          placeholder="https://example.com/data.csv"
                          value={fileUrl}
                          onChange={(e) => setFileUrl(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleUrlImport} disabled={isProcessing}>
                        {isProcessing ? 'Importing...' : 'Import from URL'}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {step === 2 && csvData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preview CSV Data</CardTitle>
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
                <Button onClick={initializeMappings}>
                  Continue to Mapping
                </Button>
              </div>
            </div>
          )}

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
                  onClick={handleImport} 
                  disabled={isProcessing || mappings.some(m => !m.isValid)}
                >
                  {isProcessing ? 'Importing...' : `Import ${csvData.rows.length} Records`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}