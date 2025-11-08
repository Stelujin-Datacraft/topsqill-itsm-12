import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types for export functionality
export type ExportFormat = 'csv' | 'json' | 'excel';

export interface ExportData {
  data: Record<string, any>[];
  filename?: string;
  title?: string;
}

// Main export function for query results
export function exportData(data: Record<string, any>[], format: ExportFormat, filename: string) {
  switch (format) {
    case 'csv':
      exportCSVDirect(data, filename);
      break;
    case 'json':
      exportJSONDirect(data, filename);
      break;
    case 'excel':
      exportExcelDirect(data, filename);
      break;
  }
}

// Direct export functions for query results
function exportCSVDirect(data: Record<string, any>[], filename: string) {
  const csv = Papa.unparse(data);
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

function exportJSONDirect(data: Record<string, any>[], filename: string) {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

function exportExcelDirect(data: Record<string, any>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Query Results');
  
  // Auto-size columns
  if (data.length > 0) {
    const cols = Object.keys(data[0]);
    worksheet['!cols'] = cols.map(col => ({ wch: Math.max(col.length, 10) }));
  }
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Legacy functions for reports (maintain backward compatibility)
export function exportToCSV(exportData: ExportData) {
  const filename = exportData.filename || 'export';
  const csv = Papa.unparse(exportData.data);
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToJSON(exportData: ExportData) {
  const filename = exportData.filename || 'export';
  const json = JSON.stringify(exportData.data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

export function exportToPDF(exportData: ExportData) {
  const filename = exportData.filename || 'export';
  const doc = new jsPDF();
  
  if (exportData.title) {
    doc.setFontSize(16);
    doc.text(exportData.title, 14, 15);
  }
  
  if (exportData.data.length > 0) {
    const columns = Object.keys(exportData.data[0]);
    const rows = exportData.data.map(row => 
      columns.map(col => String(row[col] ?? ''))
    );
    
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: exportData.title ? 25 : 15,
    });
  }
  
  doc.save(`${filename}.pdf`);
}

export function exportToParquet(exportData: ExportData) {
  // Parquet export is not fully supported in browser
  // Fall back to JSON for now
  console.warn('Parquet export not available, falling back to JSON');
  exportToJSON(exportData);
}

export function exportToAvro(exportData: ExportData) {
  // Avro export is not fully supported in browser
  // Fall back to JSON for now
  console.warn('Avro export not available, falling back to JSON');
  exportToJSON(exportData);
}

// Utility function to download files
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
