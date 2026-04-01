import React, { useRef, useEffect, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2 } from 'lucide-react';

interface DocxPreviewProps {
  file: File | null;
  className?: string;
}

export function DocxPreview({ file, className = '' }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !containerRef.current) return;

    const render = async () => {
      setLoading(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          await renderAsync(arrayBuffer, containerRef.current, undefined, {
            className: 'docx-preview-wrapper',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: true,
            trimXmlDeclaration: true,
            useBase64URL: true,
          });
        }
      } catch (err: any) {
        console.error('DOCX preview error:', err);
        setError('Could not render document preview');
      } finally {
        setLoading(false);
      }
    };

    render();
  }, [file]);

  if (!file) return null;

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Rendering document...</span>
        </div>
      )}
      {error && (
        <div className="text-center py-8 text-sm text-destructive">{error}</div>
      )}
      <div
        ref={containerRef}
        className="docx-preview-container border rounded-lg overflow-auto bg-white"
        style={{ maxHeight: '500px' }}
      />
    </div>
  );
}
