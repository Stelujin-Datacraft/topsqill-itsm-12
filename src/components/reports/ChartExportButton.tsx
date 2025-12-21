import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { exportChartToPDF } from '@/utils/chartExportUtils';
import { toast } from 'sonner';

interface ChartExportButtonProps {
  chartRef: React.RefObject<HTMLDivElement>;
  filename?: string;
  title?: string;
  className?: string;
}

export function ChartExportButton({
  chartRef,
  filename = 'chart-export',
  title,
  className = '',
}: ChartExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!chartRef.current) {
      toast.error('Chart not found');
      return;
    }

    setIsExporting(true);
    try {
      await exportChartToPDF(chartRef.current, {
        filename,
        title,
        quality: 2,
      });
      toast.success('Chart exported to PDF successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export chart to PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className={`gap-1.5 ${className}`}
      title="Export chart to PDF"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">Exporting...</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">PDF</span>
        </>
      )}
    </Button>
  );
}
