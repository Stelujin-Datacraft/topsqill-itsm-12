import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface ChartExportOptions {
  filename?: string;
  title?: string;
  quality?: number;
}

/**
 * Exports a chart element to PDF by capturing it as an image
 */
export async function exportChartToPDF(
  chartElement: HTMLElement,
  options: ChartExportOptions = {}
): Promise<void> {
  const { filename = 'chart-export', title, quality = 2 } = options;

  try {
    // Capture the chart element as canvas
    const canvas = await html2canvas(chartElement, {
      scale: quality,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Get image dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Calculate PDF dimensions (A4 with margins)
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = 297; // A4 height in mm
    const margin = 15;
    const availableWidth = pdfWidth - (margin * 2);
    
    // Calculate aspect ratio and fit image
    const ratio = imgHeight / imgWidth;
    const imageWidth = availableWidth;
    const imageHeight = imageWidth * ratio;

    // Create PDF with appropriate orientation
    const orientation = imageHeight > imageWidth ? 'portrait' : 'landscape';
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    let yOffset = margin;

    // Add title if provided
    if (title) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yOffset + 5);
      yOffset += 15;
    }

    // Add timestamp
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, yOffset);
    yOffset += 10;

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png');

    // Calculate final image size to fit the page
    const maxHeight = (orientation === 'portrait' ? pdfHeight : pdfWidth) - yOffset - margin;
    let finalWidth = imageWidth;
    let finalHeight = imageHeight;

    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = finalHeight / ratio;
    }

    // Center the image horizontally
    const xOffset = (pdfWidth - finalWidth) / 2;

    // Add the chart image
    doc.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

    // Save the PDF
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to export chart to PDF:', error);
    throw new Error('Failed to export chart to PDF');
  }
}
