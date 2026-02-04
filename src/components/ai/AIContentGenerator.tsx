import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AIContentGeneratorProps {
  contentType: 'email_subject' | 'email_body' | 'form_description' | 'summary' | 'response';
  onApply: (content: string) => void;
  context?: string;
  formName?: string;
  placeholder?: string;
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

export function AIContentGenerator({
  contentType,
  onApply,
  context,
  formName,
  placeholder,
  buttonLabel = 'AI Generate',
  buttonVariant = 'outline',
  buttonSize = 'sm'
}: AIContentGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal' | 'casual'>('professional');
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const { generateContent, isLoading } = useFormAI();

  const contentTypeLabels: Record<string, string> = {
    email_subject: 'Email Subject',
    email_body: 'Email Body',
    form_description: 'Form Description',
    summary: 'Summary',
    response: 'Response'
  };

  const placeholders: Record<string, string> = {
    email_subject: 'Describe what this email is about...',
    email_body: 'Describe the email content, purpose, and key points to include...',
    form_description: 'Describe what this form is for and who should use it...',
    summary: 'Paste the content you want to summarize...',
    response: 'Describe the response you need...'
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    const result = await generateContent(contentType, prompt, {
      contentContext: context,
      tone,
      formName
    });

    if (result) {
      if (contentType === 'email_subject' && result.subjects) {
        setSubjectOptions(result.subjects);
        setGeneratedContent(result.recommended || result.subjects[0]);
      } else {
        setGeneratedContent(result.text || (typeof result === 'string' ? result : JSON.stringify(result)));
      }
    }
  };

  const handleApply = () => {
    if (generatedContent) {
      onApply(generatedContent);
      setIsOpen(false);
      setGeneratedContent(null);
      setSubjectOptions([]);
      setPrompt('');
      toast.success('Content applied');
    }
  };

  const handleCopy = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    }
  };

  const handleSelectSubject = (subject: string) => {
    setGeneratedContent(subject);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI {contentTypeLabels[contentType]} Generator
          </DialogTitle>
          <DialogDescription>
            Describe what you want and AI will generate content for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tone Selection */}
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label>What do you want to generate?</Label>
            <Textarea
              placeholder={placeholder || placeholders[contentType]}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Context Display */}
          {context && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Context provided</Label>
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md max-h-20 overflow-auto">
                {context.substring(0, 200)}...
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>

          {/* Subject Options (for email subjects) */}
          {contentType === 'email_subject' && subjectOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Choose a subject line:</Label>
              <div className="space-y-2">
                {subjectOptions.map((subject, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectSubject(subject)}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      generatedContent === subject
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="text-sm">{subject}</span>
                    {generatedContent === subject && (
                      <Badge variant="secondary" className="ml-2">Selected</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Content Preview */}
          {generatedContent && contentType !== 'email_subject' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Generated Content</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-48 border rounded-md p-3">
                <div className="text-sm whitespace-pre-wrap">{generatedContent}</div>
              </ScrollArea>
            </div>
          )}

          {/* Apply Button */}
          {generatedContent && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApply}>
                Apply Content
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
