import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown, FileSpreadsheet, FileText, FileType2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

export interface ExportableUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  status: string;
  created_at: string;
  nationality?: string;
  mobile?: string;
  gender?: string;
  timezone?: string;
  last_login_at?: string;
}

interface Props {
  users: ExportableUser[];
  userGroupsMap: Record<string, string[]>;
  getAssignedRoles: (userId: string) => Array<{ id: string; name: string }>;
  getAssignedTemplate: (userId: string) => { id: string; name: string } | null;
}

const FILE_BASE = 'members-export';

function buildRows(p: Props) {
  return p.users.map((u) => {
    const fullName =
      [u.first_name, u.last_name].filter(Boolean).join(' ') ||
      u.email.split('@')[0];
    const groups = p.userGroupsMap[u.id] || [];
    const customRoles = p.getAssignedRoles(u.id).map((r) => r.name);
    const template = p.getAssignedTemplate(u.id);
    return {
      'Full Name': fullName,
      Email: u.email,
      'First Name': u.first_name || '',
      'Last Name': u.last_name || '',
      'System Role': u.role || '',
      Status: u.status || '',
      'Custom Roles': customRoles.join(', '),
      Groups: groups.join(', '),
      'Security Template': template?.name || '',
      Nationality: u.nationality || '',
      Mobile: u.mobile || '',
      Gender: u.gender || '',
      Timezone: u.timezone || '',
      'Last Login': u.last_login_at
        ? new Date(u.last_login_at).toLocaleString()
        : '',
      'Joined At': u.created_at
        ? new Date(u.created_at).toLocaleString()
        : '',
    };
  });
}

function exportCSV(rows: Record<string, string>[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${FILE_BASE}-${Date.now()}.csv`);
}

function exportXLSX(rows: Record<string, string>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([out], { type: 'application/octet-stream' }),
    `${FILE_BASE}-${Date.now()}.xlsx`,
  );
}

function exportPDF(rows: Record<string, string>[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  doc.setFontSize(14);
  doc.text('Members Export', 40, 30);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 46);

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const body = rows.map((r) => headers.map((h) => (r as any)[h] ?? ''));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 60,
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 20, right: 20 },
  });

  doc.save(`${FILE_BASE}-${Date.now()}.pdf`);
}

export function UsersExportButton(props: Props) {
  const { toast } = useToast();

  const run = (fmt: 'csv' | 'xlsx' | 'pdf') => {
    if (!props.users.length) {
      toast({ title: 'No members to export', variant: 'destructive' });
      return;
    }
    try {
      const rows = buildRows(props);
      if (fmt === 'csv') exportCSV(rows);
      else if (fmt === 'xlsx') exportXLSX(rows);
      else exportPDF(rows);
      toast({
        title: 'Export ready',
        description: `${rows.length} member(s) exported as ${fmt.toUpperCase()}.`,
      });
    } catch (e: any) {
      toast({
        title: 'Export failed',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2 text-module-access" />
          Export
          <ChevronDown className="h-4 w-4 ml-2 " />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 bg-background border border-border shadow-lg z-50"
      >
        <DropdownMenuItem onClick={() => run('xlsx')} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2  text-module-forms" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('csv')} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-module-forms" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('pdf')} className="cursor-pointer">
          <FileType2 className="h-4 w-4 mr-2  text-module-forms" />
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}