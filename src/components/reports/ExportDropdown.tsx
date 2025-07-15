import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileJson, Database } from 'lucide-react';
import { ExportData, exportToCSV, exportToPDF, exportToJSON, exportToParquet, exportToAvro } from '@/utils/exportUtils';

interface ExportDropdownProps {
  data: ExportData;
  disabled?: boolean;
}

export function ExportDropdown({ data, disabled }: ExportDropdownProps) {
  const handleExport = (format: string) => {
    switch (format) {
      case 'csv':
        exportToCSV(data);
        break;
      case 'pdf':
        exportToPDF(data);
        break;
      case 'json':
        exportToJSON(data);
        break;
      case 'parquet':
        exportToParquet(data);
        break;
      case 'avro':
        exportToAvro(data);
        break;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('parquet')}>
          <Database className="h-4 w-4 mr-2" />
          Export as Parquet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('avro')}>
          <Database className="h-4 w-4 mr-2" />
          Export as Avro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}