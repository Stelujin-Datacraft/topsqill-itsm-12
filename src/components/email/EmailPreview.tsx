import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';

interface EmailPreviewProps {
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateVariables: { name: string; value: string; }[];
  isHtmlMode: boolean;
}

export function EmailPreview({ 
  subject, 
  htmlContent, 
  textContent, 
  templateVariables,
  isHtmlMode 
}: EmailPreviewProps) {
  const replaceVariables = (content: string) => {
    let processedContent = content;
    templateVariables.forEach(variable => {
      const regex = new RegExp(`{{\\s*${variable.name}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, variable.value || `{{${variable.name}}}`);
    });
    return processedContent;
  };

  const processedSubject = replaceVariables(subject);
  const processedContent = replaceVariables(isHtmlMode ? htmlContent : (textContent || ''));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Email Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Subject:</label>
          <div className="p-2 bg-muted rounded border font-medium">
            {processedSubject || 'No subject'}
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Content ({isHtmlMode ? 'HTML' : 'Text'}):
          </label>
          <div className="border rounded min-h-[300px] bg-background">
            {isHtmlMode ? (
              <iframe
                srcDoc={processedContent}
                className="w-full h-[300px] border-0"
                title="Email Preview"
              />
            ) : (
              <div className="p-4 whitespace-pre-wrap font-mono text-sm">
                {processedContent || 'No content'}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}