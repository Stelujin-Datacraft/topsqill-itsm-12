import React, { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { FileText, Sparkles, Upload, ClipboardPaste, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PolicyTemplate } from '@/types/policy';
import mammoth from 'mammoth';

interface PolicyContentSourceProps {
  contentHtml: string;
  onContentChange: (html: string) => void;
  templates: PolicyTemplate[];
  templatesLoading: boolean;
  selectedTemplate: PolicyTemplate | null;
  onTemplateSelect: (template: PolicyTemplate) => void;
  mode: string;
  onModeChange: (mode: string) => void;
}

export function PolicyContentSource({
  contentHtml,
  onContentChange,
  templates,
  templatesLoading,
  selectedTemplate,
  onTemplateSelect,
  mode,
  onModeChange,
}: PolicyContentSourceProps) {
  const [pasteText, setPasteText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'docx') {
      toast.error('Only .docx files are supported for import');
      return;
    }

    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          convertImage: mammoth.images.imgElement(function(image: any) {
            return image.read("base64").then(function(imageBuffer: string) {
              return { src: `data:${image.contentType};base64,${imageBuffer}` };
            });
          }),
        }
      );
      if (result.value) {
        onContentChange(result.value);
        toast.success(`Imported content from "${file.name}"`);
        if (result.messages.length > 0) {
          console.warn('Mammoth warnings:', result.messages);
        }
      } else {
        toast.error('No content found in the document');
      }
    } catch (err: any) {
      console.error('DOCX parse error:', err);
      toast.error('Failed to parse document: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteApply = () => {
    if (!pasteText.trim()) return;
    const isHtml = /<[a-z][\s\S]*>/i.test(pasteText);
    if (isHtml) {
      onContentChange(pasteText);
    } else {
      const html = pasteText
        .split('\n')
        .filter(l => l.trim())
        .map(l => `<p>${l}</p>`)
        .join('');
      onContentChange(html);
    }
    toast.success('Content applied');
    setPasteText('');
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={onModeChange}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="blank" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Write
          </TabsTrigger>
          <TabsTrigger value="template" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Template
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="paste" className="gap-1.5 text-xs">
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste
          </TabsTrigger>
        </TabsList>

        {/* Write from scratch */}
        <TabsContent value="blank">
          <TiptapEditor
            content={contentHtml}
            onChange={onContentChange}
            placeholder="Write the full policy content here..."
            className="min-h-[150px]"
          />
        </TabsContent>

        {/* From Template */}
        <TabsContent value="template">
          <ScrollArea className="max-h-[200px] border rounded-md p-3">
            {templatesLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No templates available.</p>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div
                    key={t.id}
                    onClick={() => onTemplateSelect(t)}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{t.name}</span>
                      <Badge variant="outline">{t.category}</Badge>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {selectedTemplate && (
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Edit imported template content below:</Label>
              <TiptapEditor
                content={contentHtml}
                onChange={onContentChange}
                placeholder="Template content will appear here..."
                className="min-h-[120px] mt-1"
              />
            </div>
          )}
        </TabsContent>

        {/* Upload DOCX */}
        <TabsContent value="upload">
          <div className="space-y-3">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Parsing document...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload a DOCX file</p>
                  <p className="text-xs text-muted-foreground">
                    Supported: .docx — Content will be extracted and editable
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            {contentHtml && (
              <div>
                <Label className="text-xs text-muted-foreground">Imported content (editable):</Label>
                <TiptapEditor
                  content={contentHtml}
                  onChange={onContentChange}
                  placeholder="Uploaded content will appear here..."
                  className="min-h-[120px] mt-1"
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Paste HTML/Text */}
        <TabsContent value="paste">
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Paste HTML or plain text below:</Label>
              <Textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your policy content here (HTML or plain text)..."
                rows={6}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handlePasteApply}
                disabled={!pasteText.trim()}
              >
                Apply Content
              </Button>
            </div>
            {contentHtml && (
              <div>
                <Label className="text-xs text-muted-foreground">Preview (editable):</Label>
                <TiptapEditor
                  content={contentHtml}
                  onChange={onContentChange}
                  placeholder="Applied content will appear here..."
                  className="min-h-[120px] mt-1"
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
