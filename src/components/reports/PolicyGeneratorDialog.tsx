import { useState, useRef } from 'react';
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
import { ScrollText, Upload, FileText, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generatePolicyDocument, generatePolicyFromTemplate } from '@/utils/policyDocumentGenerator';

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

interface PolicyGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formName: string;
  formDescription?: string;
  fields: PolicyField[];
  submissions: PolicySubmission[];
}

export function PolicyGeneratorDialog({
  open,
  onOpenChange,
  formName,
  formDescription,
  fields,
  submissions,
}: PolicyGeneratorDialogProps) {
  const [mode, setMode] = useState<'default' | 'template'>('default');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (mode === 'template' && !templateFile) {
      toast.error('Please upload a template file');
      return;
    }

    setGenerating(true);
    try {
      toast.info('Generating policy document...');

      if (mode === 'template' && templateFile) {
        const buffer = await templateFile.arrayBuffer();
        await generatePolicyFromTemplate({
          templateBuffer: buffer,
          formName,
          formDescription,
          fields,
          submissions,
        });
      } else {
        await generatePolicyDocument({
          formName,
          formDescription,
          fields,
          submissions,
        });
      }

      toast.success('Policy document downloaded successfully!');
      onOpenChange(false);
    } catch (err) {
      console.error('Policy generation error:', err);
      toast.error('Failed to generate policy document');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (!generating) {
      setMode('default');
      setTemplateFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Create Policy Document
          </DialogTitle>
          <DialogDescription>
            Generate a Word document with all {submissions.length} records from "{formName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'default' | 'template')}>
            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                mode === 'default' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
              onClick={() => setMode('default')}
            >
              <RadioGroupItem value="default" id="default" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="default" className="font-medium cursor-pointer">
                  Default Template
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the built-in professional layout with title page, summary, and records.
                </p>
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
                <Label htmlFor="template" className="font-medium cursor-pointer">
                  Custom Template
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload your own .docx template. Policy records will be appended after your template content.
                </p>
              </div>
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
          </RadioGroup>

          {mode === 'template' && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                className="hidden"
              />
              {templateFile ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted border">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{templateFile.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setTemplateFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload .docx Template
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating || (mode === 'template' && !templateFile)}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ScrollText className="h-4 w-4 mr-2" />
                Generate Policy
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
