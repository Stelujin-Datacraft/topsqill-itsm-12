import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileJson, Database } from 'lucide-react';
import { ExportData, exportToCSV, exportToPDF, exportToJSON, exportToParquet, exportToAvro } from '@/utils/exportUtils';
import { logFormAuditEvent } from '@/utils/formAuditLogger';
import { useAuth } from '@/contexts/AuthContext';

interface ExportDropdownProps {
  data: ExportData;
  disabled?: boolean;
  formId?: string;
  formName?: string;
  asSubMenu?: boolean;
}

export function ExportDropdown({ data, disabled, formId, formName, asSubMenu = false }: ExportDropdownProps) {
  const { userProfile } = useAuth();

  const handleExport = async (format: string) => {
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

    // Log the export event if form context is available
    if (formId && userProfile?.id) {
      await logFormAuditEvent({
        userId: userProfile.id,
        eventType: 'form_exported',
        formId: formId,
        formName: formName,
        description: `Exported ${data.data.length} records to ${format.toUpperCase()}`,
        additionalMetadata: {
          exportFormat: format,
          recordCount: data.data.length
        }
      });
    }
  };

  const exportItems = (
    <>
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
    </>
  );

  if (asSubMenu) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="bg-popover">
          {exportItems}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        {exportItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
