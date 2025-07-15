import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportData {
  headers: string[];
  rows: any[][];
  filename: string;
  title?: string;
}

export const exportToCSV = (data: ExportData) => {
  const csv = Papa.unparse({
    fields: data.headers,
    data: data.rows
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${data.filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (data: ExportData) => {
  const doc = new jsPDF();
  
  if (data.title) {
    doc.setFontSize(16);
    doc.text(data.title, 14, 20);
  }

  autoTable(doc, {
    head: [data.headers],
    body: data.rows,
    startY: data.title ? 30 : 20,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  doc.save(`${data.filename}.pdf`);
};

export const exportToJSON = (data: ExportData) => {
  const jsonData = data.rows.map(row => {
    const obj: Record<string, any> = {};
    data.headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
    type: 'application/json;charset=utf-8;'
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${data.filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToParquet = (data: ExportData) => {
  // Note: For Parquet, we'll create a simplified format since browser support is limited
  // In a real implementation, you'd need a proper Parquet library
  console.warn('Parquet export not fully supported in browser. Exporting as JSON instead.');
  exportToJSON(data);
};

export const exportToAvro = (data: ExportData) => {
  // Note: For Avro, we'll create a simplified format since browser support is limited
  // In a real implementation, you'd need a proper Avro library
  console.warn('Avro export not fully supported in browser. Exporting as JSON instead.');
  exportToJSON(data);
};