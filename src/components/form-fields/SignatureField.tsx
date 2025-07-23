
import React, { useRef, useEffect, useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw, Download, Trash2 } from 'lucide-react';

interface SignatureFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function SignatureField({ field, value, onChange, error, disabled }: SignatureFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const config = field.customConfig || {};
  const canvasWidth = config.canvasWidth || 400;
  const canvasHeight = config.canvasHeight || 200;
  const penColor = config.penColor || '#000000';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Set drawing styles
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load existing signature if any
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = value;
    }
  }, [canvasWidth, canvasHeight, penColor, value]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Only save signature if we were actually drawing
      setTimeout(() => saveSignature(), 50);
    }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');
    let finalValue = dataURL;

    // Add timestamp if enabled
    if (config.showTimestamp) {
      const timestamp = new Date().toISOString();
      finalValue = JSON.stringify({ signature: dataURL, timestamp });
    }

    onChange(finalValue);
  };

  const clearSignature = () => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange('');
  };

  const undoLastStroke = () => {
    // This is a simplified undo - in a real implementation, 
    // you'd want to store drawing states
    clearSignature();
  };

  const downloadSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const link = document.createElement('a');
    link.download = `signature-${field.id}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={field.id}>{field.label}</Label>
      
      <div className="border rounded-lg p-4 bg-white">
        <canvas
          ref={canvasRef}
          className="border border-dashed border-gray-300 cursor-crosshair rounded"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onDoubleClick={config.clearOnDoubleTap ? clearSignature : undefined}
          style={{ 
            width: `${canvasWidth}px`, 
            height: `${canvasHeight}px`,
            opacity: disabled ? 0.5 : 1 
          }}
        />
        
        <div className="flex gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSignature}
            disabled={disabled || !hasSignature}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          
          {config.undoEnabled !== false && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={undoLastStroke}
              disabled={disabled || !hasSignature}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Undo
            </Button>
          )}
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadSignature}
            disabled={!hasSignature}
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>

        {config.showTimestamp && hasSignature && (
          <p className="text-xs text-gray-500 mt-2">
            Signed on: {new Date().toLocaleString()}
          </p>
        )}
      </div>

      {!hasSignature && (
        <p className="text-sm text-gray-500">
          Click and drag to create your signature
          {config.clearOnDoubleTap && ' • Double-click to clear'}
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
