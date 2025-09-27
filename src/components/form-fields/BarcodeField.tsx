import React, { useEffect, useRef } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { QrCode, Scan } from 'lucide-react';
import QRCode from 'qrcode';

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

  const generateBarcode = async () => {
    if (!canvasRef.current || !config.url) return;

    const canvas = canvasRef.current;
    const size = config.size || 200;
    
    try {
      // Generate proper QR code using qrcode library
      await QRCode.toCanvas(canvas, config.url, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      // Fallback to simple pattern if QR generation fails
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR Error', size / 2, size / 2);
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
      {/* <Label>{field.label}</Label> */}
      
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