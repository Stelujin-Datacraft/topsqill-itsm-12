import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { exportData, ExportFormat } from '@/utils/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface ExportMenuProps {
  data: Record<string, any>[] | null;
  disabled?: boolean;
}

export function ExportMenu({ data, disabled }: ExportMenuProps) {
  const { toast } = useToast();

  const handleExport = (format: ExportFormat) => {
    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "Execute a query first to export results",
        variant: "destructive"
      });
      return;
    }

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `query_results_${timestamp}`;
      exportData(data, format, filename);
      
      toast({
        title: "Export successful",
        description: `Exported ${data.length} rows as ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export data",
        variant: "destructive"
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !data || data.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2">
          <FileText className="h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')} className="gap-2">
          <FileJson className="h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
