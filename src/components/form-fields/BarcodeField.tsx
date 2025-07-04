import React, { useEffect, useRef } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { QrCode, Scan } from 'lucide-react';

interface BarcodeFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function BarcodeField({ field, value, onChange, error, disabled }: BarcodeFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = (field.customConfig as any) || {};

  useEffect(() => {
    if (config.url && canvasRef.current) {
      generateBarcode();
    }
  }, [config.url, config.barcodeType, config.size]);

  const generateBarcode = () => {
    if (!canvasRef.current || !config.url) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple QR code generation (in a real app, use a proper QR library like qrcode)
    const size = config.size || 200;
    canvas.width = size;
    canvas.height = size;
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    
    // Draw simple pattern representing QR code
    ctx.fillStyle = 'black';
    const cellSize = size / 25;
    
    // Generate a simple pattern based on URL
    const pattern = config.url.split('').map((char, i) => char.charCodeAt(0) + i);
    
    for (let i = 0; i < 25; i++) {
      for (let j = 0; j < 25; j++) {
        if (pattern[(i * 25 + j) % pattern.length] % 3 === 0) {
          ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
        }
      }
    }
  };

  const handleScan = async () => {
    if (onChange && !disabled) {
      try {
        // In a real implementation, this would trigger camera scanning
        // For now, simulate scanning the configured URL
        const scannedValue = config.url || '';
        onChange(scannedValue);
      } catch (error) {
        console.error('Scanning error:', error);
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label>{field.label}</Label>
      
      <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
        {config.url ? (
          <>
            <canvas
              ref={canvasRef}
              className="border border-gray-300 rounded"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
            {config.showText !== false && (
              <p className="text-sm text-center text-gray-600 break-all">
                {config.url}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center space-y-2 py-8">
            <QrCode className="h-12 w-12 text-gray-400" />
            <p className="text-sm text-gray-500">No URL configured</p>
          </div>
        )}

        {config.scanOnFocus && (
          <Button
            type="button"
            variant="outline"
            onClick={handleScan}
            disabled={disabled}
            className="flex items-center space-x-2"
          >
            <Scan className="h-4 w-4" />
            <span>Scan Code</span>
          </Button>
        )}
      </div>

      {value && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800">
            <strong>Scanned:</strong> {value}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}