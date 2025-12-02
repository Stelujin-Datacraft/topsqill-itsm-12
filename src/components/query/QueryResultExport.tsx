import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface QueryResultExportProps {
  columns: string[];
  originalRows: any[][];
  filteredRows: any[][];
  filename?: string;
  disabled?: boolean;
}

export function QueryResultExport({
  columns,
  originalRows,
  filteredRows,
  filename = 'query-export',
  disabled = false,
}: QueryResultExportProps) {
  const { toast } = useToast();

  const exportToCSV = (rows: any[][], suffix: string) => {
    const header = columns.join(',');
    const csvRows = rows.map(row =>
      row.map(cell => {
        const value = cell !== null && cell !== undefined ? String(cell) : '';
        // Escape quotes and wrap in quotes if contains comma or newline
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    downloadFile(csv, `${filename}${suffix}.csv`, 'text/csv');
    toast({ title: 'Exported', description: `Data exported to ${filename}${suffix}.csv` });
  };

  const exportToJSON = (rows: any[][], suffix: string) => {
    const data = rows.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `${filename}${suffix}.json`, 'application/json');
    toast({ title: 'Exported', description: `Data exported to ${filename}${suffix}.json` });
  };

  const exportToExcel = (rows: any[][], suffix: string) => {
    const data = rows.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}${suffix}.xlsx`);
    toast({ title: 'Exported', description: `Data exported to ${filename}${suffix}.xlsx` });
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasFilters = originalRows.length !== filteredRows.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2" disabled={disabled}>
          <Download className="h-3 w-3 mr-1" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Current Data ({filteredRows.length} rows)
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportToCSV(filteredRows, '-filtered')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToJSON(filteredRows, '-filtered')}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(filteredRows, '-filtered')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>

        {hasFilters && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Original Data ({originalRows.length} rows)
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportToCSV(originalRows, '-original')}>
              <FileText className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToJSON(originalRows, '-original')}>
              <FileJson className="h-4 w-4 mr-2" />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToExcel(originalRows, '-original')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as Excel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
