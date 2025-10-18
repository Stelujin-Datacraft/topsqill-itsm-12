import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Link, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface UserImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (users: Array<{ email: string; firstName: string; lastName: string; role: string }>) => void;
}

interface CSVData {
  headers: string[];
  rows: string[][];
  preview: string[][];
}

export function UserImportDialog({ isOpen, onOpenChange, onImportComplete }: UserImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const resetDialog = () => {
    setStep('upload');
    setCsvData(null);
    setFileUrl('');
    setIsProcessing(false);
  };

  const parseCSV = (text: string): CSVData => {
    const result = Papa.parse(text, { skipEmptyLines: true });
    const rows = result.data as string[][];
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    return {
      headers,
      rows: dataRows,
      preview: dataRows.slice(0, 5)
    };
  };

  const parseExcel = (arrayBuffer: ArrayBuffer): CSVData => {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    
    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);
    
    return {
      headers,
      rows: dataRows,
      preview: dataRows.slice(0, 5)
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        const text = await file.text();
        const data = parseCSV(text);
        setCsvData(data);
        setStep('preview');
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const data = parseExcel(arrayBuffer);
        setCsvData(data);
        setStep('preview');
      } else {
        throw new Error('Unsupported file format. Please upload CSV or Excel file.');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to parse file',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlImport = async () => {
    if (!fileUrl) {
      toast({
        title: 'Error',
        description: 'Please enter a URL',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch file from URL');
      
      const text = await response.text();
      const data = parseCSV(text);
      setCsvData(data);
      setStep('preview');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import from URL',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!csvData) return;

    setIsProcessing(true);
    try {
      const emailIndex = csvData.headers.findIndex(h => h.toLowerCase().includes('email'));
      const firstNameIndex = csvData.headers.findIndex(h => h.toLowerCase().includes('first') && h.toLowerCase().includes('name'));
      const lastNameIndex = csvData.headers.findIndex(h => h.toLowerCase().includes('last') && h.toLowerCase().includes('name'));
      const roleIndex = csvData.headers.findIndex(h => h.toLowerCase().includes('role'));

      if (emailIndex === -1) {
        throw new Error('Email column is required');
      }
      if (firstNameIndex === -1) {
        throw new Error('First Name column is required');
      }
      if (lastNameIndex === -1) {
        throw new Error('Last Name column is required');
      }

      const users = csvData.rows
        .filter(row => row[emailIndex]?.trim())
        .map(row => ({
          email: row[emailIndex].trim(),
          firstName: row[firstNameIndex]?.trim() || '',
          lastName: row[lastNameIndex]?.trim() || '',
          role: row[roleIndex]?.trim().toLowerCase() || 'user'
        }));

      if (users.length === 0) {
        throw new Error('No valid users found in file');
      }

      onImportComplete(users);
      resetDialog();
      onOpenChange(false);
      
      toast({
        title: 'Success',
        description: `Successfully queued ${users.length} user(s) for import`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import users',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) resetDialog();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Users</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">Upload File</TabsTrigger>
              <TabsTrigger value="url">From URL</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload CSV or Excel File</CardTitle>
                  <CardDescription>
                    File must contain: Email, First Name, Last Name columns. Role column is optional (defaults to 'user').
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                    />
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Import from URL</CardTitle>
                  <CardDescription>
                    Provide a URL to a CSV file
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Input
                      type="url"
                      placeholder="https://example.com/users.csv"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      disabled={isProcessing}
                    />
                    <Link className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Button onClick={handleUrlImport} disabled={isProcessing}>
                    Import from URL
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {step === 'preview' && csvData && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {csvData.rows.length} user(s) in file. Preview shows first 5 rows.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b">
                        {csvData.headers.map((header, idx) => (
                          <th key={idx} className="p-2 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.preview.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="p-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isProcessing}>
                {isProcessing ? 'Importing...' : `Import ${csvData.rows.length} User(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
