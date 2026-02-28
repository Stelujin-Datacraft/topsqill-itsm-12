import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { usePolicies } from '@/hooks/usePolicies';
import { POLICY_CATEGORIES } from '@/types/policy';
import { toast } from 'sonner';
import mammoth from 'mammoth';
import PageContent from '@/components/PageContent';

const CreateTemplate = () => {
  const navigate = useNavigate();
  const { createTemplate } = usePolicies();
  const [mode, setMode] = useState<'write' | 'upload'>('write');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [contentHtml, setContentHtml] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setContentHtml(result.value);
        if (!name) setName(file.name.replace(/\.docx$/i, ''));
        toast.success(`Content imported from "${file.name}"`);
      }
    } catch (err: any) {
      toast.error('Failed to parse document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    await createTemplate.mutateAsync({
      name,
      description: description || undefined,
      category,
      content_structure: contentHtml ? { html: contentHtml } : {},
      is_system_template: false,
    });

    navigate('/policies');
  };

  return (
    <PageContent
      title="Create Policy Template"
      description="Create a reusable template for policy creation"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/policies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createTemplate.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {createTemplate.isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Data Protection Template" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this template for?" rows={3} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POLICY_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Template Content</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={v => setMode(v as any)}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="write" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" /> Write
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-1.5 text-xs">
                  <Upload className="h-3.5 w-3.5" /> Upload DOCX
                </TabsTrigger>
              </TabsList>

              <TabsContent value="write">
                <TiptapEditor
                  content={contentHtml}
                  onChange={setContentHtml}
                  placeholder="Write template content..."
                  className="min-h-[250px]"
                />
              </TabsContent>

              <TabsContent value="upload">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Upload a .docx file</p>
                      <p className="text-xs text-muted-foreground">Content will be extracted as a reusable template</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </div>
                {contentHtml && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Imported content (editable):</Label>
                    <TiptapEditor content={contentHtml} onChange={setContentHtml} className="min-h-[200px] mt-1" />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PageContent>
  );
};

export default CreateTemplate;
