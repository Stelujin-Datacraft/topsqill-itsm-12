import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollText, Upload, FileText, X, Loader2, History, Download, Trash2, Wand2, Copy, Check, Info, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { generatePolicyDocument, generatePolicyFromTemplate } from '@/utils/policyDocumentGenerator';
import { generateFromSmartTemplate, getAvailableTags } from '@/utils/smartTemplateGenerator';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

interface DocumentHistoryEntry {
  id: string;
  form_name: string;
  generated_by_email: string | null;
  generated_at: string;
  document_type: string;
  selected_fields: any;
  submission_count: number;
  file_path: string;
  file_name: string;
  version: number;
}

interface PolicyGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formName: string;
  formDescription?: string;
  fields: PolicyField[];
  submissions: PolicySubmission[];
  organizationId?: string;
}

// Copyable tag chip component
function CopyableTag({ tag, label }: { tag: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tag);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted border border-border text-xs font-mono hover:bg-accent hover:border-primary/30 transition-colors cursor-pointer group"
          >
            <span className="text-primary/80">{tag}</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{label}</p>
          <p className="text-muted-foreground">Click to copy</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PolicyGeneratorDialog({
  open,
  onOpenChange,
  formId,
  formName,
  formDescription,
  fields,
  submissions,
  organizationId,
}: PolicyGeneratorDialogProps) {
  const [mode, setMode] = useState<'default' | 'template' | 'smart'>('default');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const smartFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize all fields as selected
  useEffect(() => {
    if (open && fields.length > 0 && selectedFields.length === 0) {
      setSelectedFields(fields.map(f => f.id));
    }
  }, [open, fields]);

  // Fetch history when history tab is active
  useEffect(() => {
    if (open && activeTab === 'history') {
      fetchHistory();
    }
  }, [open, activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('document_history')
        .select('*')
        .eq('form_id', formId)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setHistory((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFields.length === fields.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(fields.map(f => f.id));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.docx')) {
        toast.error('Please upload a .docx file');
        return;
      }
      setTemplateFile(file);
    }
  };

  const handleGenerate = async () => {
    if ((mode === 'template' || mode === 'smart') && !templateFile) {
      toast.error('Please upload a template file');
      return;
    }
    if (mode !== 'smart' && selectedFields.length === 0) {
      toast.error('Please select at least one field');
      return;
    }

    setGenerating(true);
    try {
      toast.info('Generating document...');

      const filteredFields = fields.filter(f => selectedFields.includes(f.id));
      let blob: Blob;

      if (mode === 'smart' && templateFile) {
        const buffer = await templateFile.arrayBuffer();
        blob = await generateFromSmartTemplate({
          templateBuffer: buffer,
          formName,
          fields, // Use all fields for smart template (placeholders determine what's included)
          submissions,
          returnBlob: true,
        });
      } else if (mode === 'template' && templateFile) {
        const buffer = await templateFile.arrayBuffer();
        blob = await generatePolicyFromTemplate({
          templateBuffer: buffer,
          formName,
          formDescription,
          fields: filteredFields,
          submissions,
          returnBlob: true,
        });
      } else {
        blob = await generatePolicyDocument({
          formName,
          formDescription,
          fields: filteredFields,
          submissions,
          returnBlob: true,
        });
      }

      const modeSuffix = mode === 'smart' ? 'Smart' : 'Doc';
      const filename = `${formName.replace(/[^a-zA-Z0-9]/g, '_')}_${modeSuffix}_${new Date().toISOString().slice(0, 10)}.docx`;

      // Save to Supabase Storage
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const userEmail = userData?.user?.email;
      const filePath = `${organizationId || 'default'}/${formId}/${Date.now()}_${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('generated-documents')
        .upload(filePath, blob, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      if (uploadError) {
        console.error('Upload error:', uploadError);
      }

      // Get next version
      const { data: lastVersion } = await supabase
        .from('document_history')
        .select('version')
        .eq('form_id', formId)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = ((lastVersion as any[])?.[0]?.version || 0) + 1;

      // Save history record
      const { error: historyError } = await supabase
        .from('document_history')
        .insert({
          form_id: formId,
          form_name: formName,
          generated_by: userId,
          generated_by_email: userEmail,
          document_type: mode,
          selected_fields: mode === 'smart' ? fields.map(f => f.id) : selectedFields,
          submission_count: submissions.length,
          file_path: filePath,
          file_name: filename,
          file_size_bytes: blob.size,
          version: nextVersion,
          organization_id: organizationId,
        } as any);

      if (historyError) {
        console.error('History save error:', historyError);
      }

      // Download the file
      const { saveAs } = await import('file-saver');
      saveAs(blob, filename);

      toast.success('Document downloaded & saved to history!');
      onOpenChange(false);
    } catch (err) {
      console.error('Document generation error:', err);
      toast.error('Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadHistory = async (entry: DocumentHistoryEntry) => {
    try {
      const { data, error } = await supabase.storage
        .from('generated-documents')
        .download(entry.file_path);

      if (error) throw error;
      const { saveAs } = await import('file-saver');
      saveAs(data, entry.file_name);
      toast.success('Document downloaded');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download document');
    }
  };

  const handleDeleteHistory = async (entry: DocumentHistoryEntry) => {
    try {
      await supabase.storage.from('generated-documents').remove([entry.file_path]);
      await supabase.from('document_history').delete().eq('id', entry.id);
      setHistory(prev => prev.filter(h => h.id !== entry.id));
      toast.success('Document removed from history');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete document');
    }
  };

  const handleClose = () => {
    if (!generating) {
      setMode('default');
      setTemplateFile(null);
      setSelectedFields(fields.map(f => f.id));
      setActiveTab('generate');
      onOpenChange(false);
    }
  };

  const availableTags = getAvailableTags(fields);
  const metaTags = availableTags.filter(t => t.category === 'meta');
  const fieldTags = availableTags.filter(t => t.category === 'field');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Create Docs
          </DialogTitle>
          <DialogDescription>
            Generate a Word document from "{formName}" with {submissions.length} records.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">
              <FileText className="h-4 w-4 mr-1" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="flex-1 min-h-0 overflow-auto space-y-4 py-2">
            {/* Template mode selection */}
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'default' | 'template' | 'smart')}>
              <div
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mode === 'default' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setMode('default')}
              >
                <RadioGroupItem value="default" id="default" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="default" className="font-medium cursor-pointer">Default Template</Label>
                  <p className="text-xs text-muted-foreground mt-1">Built-in professional layout with title page, summary, and records.</p>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>

              <div
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mode === 'template' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setMode('template')}
              >
                <RadioGroupItem value="template" id="template" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="template" className="font-medium cursor-pointer">Custom Template</Label>
                  <p className="text-xs text-muted-foreground mt-1">Upload your own .docx template. Records appended after your content.</p>
                </div>
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>

              <div
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mode === 'smart' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setMode('smart')}
              >
                <RadioGroupItem value="smart" id="smart" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="smart" className="font-medium cursor-pointer flex items-center gap-1.5">
                    Smart Template
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a .docx with <code className="text-[11px] bg-muted px-1 rounded">{'{Field_Name}'}</code> placeholders. Values are dynamically replaced per record.
                  </p>
                </div>
                <Wand2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </RadioGroup>

            {/* Smart Template: Upload + Tag Guide */}
            {mode === 'smart' && (
              <div className="space-y-3">
                {/* File Upload */}
                <input ref={smartFileInputRef} type="file" accept=".docx" onChange={handleFileChange} className="hidden" />
                {templateFile ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted border">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{templateFile.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setTemplateFile(null); if (smartFileInputRef.current) smartFileInputRef.current.value = ''; }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => smartFileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Smart .docx Template
                  </Button>
                )}

                {/* Tag Guide as Dropdown */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        <span>Available Placeholder Tags</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-0" align="start" sideOffset={4}>
                    <div className="p-3 border-b">
                      <p className="text-xs text-muted-foreground">
                        Click a tag to copy it. For multiple records, wrap content in{' '}
                        <code className="bg-muted px-1 rounded text-[11px]">{'{#records}'}...{'{/records}'}</code>.
                      </p>
                    </div>
                    <ScrollArea className="max-h-[300px]">
                      <div className="p-3 space-y-3">
                        {/* Metadata Tags */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Document Info</p>
                          <div className="flex flex-wrap gap-1.5">
                            {metaTags.map(t => (
                              <CopyableTag key={t.tag} tag={t.tag} label={t.label} />
                            ))}
                          </div>
                        </div>

                        {/* Field Tags */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Form Fields ({fieldTags.length})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {fieldTags.map(t => (
                              <CopyableTag key={t.tag} tag={t.tag} label={t.label} />
                            ))}
                          </div>
                        </div>

                        {/* Loop Example */}
                        <div className="rounded-md border bg-muted/30 p-2.5 space-y-1">
                          <p className="text-xs font-medium">Template Example:</p>
                          <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
{`{#records}
Record: {Record_ID}
${fieldTags.length > 0 ? `${fieldTags[0].label.replace(/\s+/g, '_')}: {${fieldTags[0].label.replace(/\s+/g, '_')}}` : 'Field_Name: {Field_Name}'}
${fieldTags.length > 1 ? `${fieldTags[1].label.replace(/\s+/g, '_')}: {${fieldTags[1].label.replace(/\s+/g, '_')}}` : ''}
{/records}`}
                          </pre>
                        </div>
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Custom Template: File Upload */}
            {mode === 'template' && (
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept=".docx" onChange={handleFileChange} className="hidden" />
                {templateFile ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted border">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{templateFile.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setTemplateFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload .docx Template
                  </Button>
                )}
              </div>
            )}

            {/* Field Selection (not shown for smart mode — placeholders handle field selection) */}
            {mode !== 'smart' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Select Fields to Include</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSelectAll}>
                    {selectedFields.length === fields.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <ScrollArea className="h-[180px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {fields.map(field => (
                      <label
                        key={field.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedFields.includes(field.id)}
                          onCheckedChange={() => handleFieldToggle(field.id)}
                        />
                        <span className="text-sm">{field.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{field.field_type}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">{selectedFields.length} of {fields.length} fields selected</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 min-h-0 overflow-auto py-2">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No documents generated yet.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>v{entry.version}</span>
                        <span>•</span>
                        <span>{entry.document_type === 'smart' ? 'Smart' : entry.document_type === 'template' ? 'Template' : 'Default'}</span>
                        <span>•</span>
                        <span>{format(new Date(entry.generated_at), 'MMM d, yyyy h:mm a')}</span>
                        <span>•</span>
                        <span>{entry.submission_count} records</span>
                      </div>
                      {entry.generated_by_email && (
                        <p className="text-xs text-muted-foreground">{entry.generated_by_email}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadHistory(entry)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteHistory(entry)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {activeTab === 'generate' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={generating}>Cancel</Button>
            <Button
              onClick={handleGenerate}
              disabled={
                generating ||
                (mode !== 'smart' && selectedFields.length === 0) ||
                ((mode === 'template' || mode === 'smart') && !templateFile)
              }
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><ScrollText className="h-4 w-4 mr-2" />Generate Doc</>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
