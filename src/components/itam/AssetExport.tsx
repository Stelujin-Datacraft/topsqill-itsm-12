import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useITAssets } from '@/hooks/useITAssets';
import { FileSpreadsheet, FileText, Download, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const EXPORT_COLUMNS = [
  { key: 'asset_tag', label: 'Asset Tag', default: true },
  { key: 'display_name', label: 'Name', default: true },
  { key: 'hostname', label: 'Hostname', default: true },
  { key: 'asset_type', label: 'Type', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'condition', label: 'Condition', default: false },
  { key: 'manufacturer', label: 'Manufacturer', default: true },
  { key: 'model', label: 'Model', default: true },
  { key: 'serial_number', label: 'Serial Number', default: true },
  { key: 'ip_address', label: 'IP Address', default: true },
  { key: 'mac_address', label: 'MAC Address', default: false },
  { key: 'department', label: 'Department', default: false },
  { key: 'location', label: 'Location', default: true },
  { key: 'purchase_date', label: 'Purchase Date', default: false },
  { key: 'purchase_cost', label: 'Purchase Cost', default: false },
  { key: 'warranty_expiry', label: 'Warranty Expiry', default: false },
  { key: 'notes', label: 'Notes', default: false },
  { key: 'created_at', label: 'Date Added', default: false },
];

export function AssetExport() {
  const { assets } = useITAssets();
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    EXPORT_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredAssets = assets.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
    return true;
  });

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const formatValue = (asset: any, key: string): string => {
    const val = asset[key];
    if (val == null || val === '') return '';
    if (key === 'purchase_date' || key === 'warranty_expiry' || key === 'created_at') {
      try { return format(new Date(val), 'yyyy-MM-dd'); } catch { return String(val); }
    }
    if (key === 'purchase_cost') return typeof val === 'number' ? val.toFixed(2) : String(val);
    return String(val);
  };

  const exportCSV = () => {
    const cols = EXPORT_COLUMNS.filter(c => selectedColumns.includes(c.key));
    const header = cols.map(c => c.label).join(',');
    const rows = filteredAssets.map(asset =>
      cols.map(c => {
        const val = formatValue(asset, c.key);
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Exported', description: `${filteredAssets.length} assets exported.` });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: selectedColumns.length > 8 ? 'landscape' : 'portrait' });
    const cols = EXPORT_COLUMNS.filter(c => selectedColumns.includes(c.key));

    // Title
    doc.setFontSize(16);
    doc.text('IT Asset Inventory Report', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')} · ${filteredAssets.length} assets`, 14, 22);

    // Summary stats
    const statuses = assets.reduce((acc: Record<string, number>, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1; return acc;
    }, {});
    const summaryText = Object.entries(statuses).map(([k, v]) => `${k}: ${v}`).join(' | ');
    doc.text(`Status: ${summaryText}`, 14, 28);

    // Table
    autoTable(doc, {
      startY: 34,
      head: [cols.map(c => c.label)],
      body: filteredAssets.map(asset => cols.map(c => formatValue(asset, c.key))),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 34 },
    });

    doc.save(`asset-inventory-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF Exported', description: `${filteredAssets.length} assets exported.` });
  };

  const uniqueTypes = [...new Set(assets.map(a => a.asset_type))];
  const uniqueStatuses = [...new Set(assets.map(a => a.status))];

  return (
    <div className="space-y-6 mt-4">
      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Download className="h-5 w-5" />Export Asset Report</CardTitle>
          <CardDescription>Select columns, apply filters, and export your asset inventory as CSV or PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="h-9 flex items-center px-3">
              {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} selected
            </Badge>
          </div>

          {/* Column Selection */}
          <div>
            <p className="text-sm font-medium mb-3">Select columns to include:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {EXPORT_COLUMNS.map(col => (
                <div key={col.key} className="flex items-center gap-2">
                  <Checkbox
                    id={col.key}
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <label htmlFor={col.key} className="text-sm cursor-pointer">{col.label}</label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedColumns(EXPORT_COLUMNS.map(c => c.key))}>Select All</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedColumns(EXPORT_COLUMNS.filter(c => c.default).map(c => c.key))}>Reset to Default</Button>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3 pt-2">
            <Button onClick={exportCSV} disabled={filteredAssets.length === 0 || selectedColumns.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Export as CSV
            </Button>
            <Button variant="secondary" onClick={exportPDF} disabled={filteredAssets.length === 0 || selectedColumns.length === 0}>
              <FileText className="h-4 w-4 mr-2" />Export as PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {filteredAssets.length > 0 && selectedColumns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview (first 10 rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {EXPORT_COLUMNS.filter(c => selectedColumns.includes(c.key)).map(col => (
                      <th key={col.key} className="px-3 py-2 text-left font-medium text-xs">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.slice(0, 10).map((asset, i) => (
                    <tr key={asset.id} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                      {EXPORT_COLUMNS.filter(c => selectedColumns.includes(c.key)).map(col => (
                        <td key={col.key} className="px-3 py-2 text-xs">{formatValue(asset, col.key) || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
