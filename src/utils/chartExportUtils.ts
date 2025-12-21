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
    // Store original styles to restore later
    const elementsToHide: { element: HTMLElement; originalDisplay: string }[] = [];
    
    // Hide export buttons temporarily
    const exportButtons = chartElement.querySelectorAll('[data-export-hide="true"]');
    exportButtons.forEach(btn => {
      const el = btn as HTMLElement;
      elementsToHide.push({ element: el, originalDisplay: el.style.display });
      el.style.display = 'none';
    });

    // Hide hover-only controls
    const hoverControls = chartElement.querySelectorAll('.opacity-0.group-hover\\:opacity-100');
    hoverControls.forEach(ctrl => {
      const el = ctrl as HTMLElement;
      elementsToHide.push({ element: el, originalDisplay: el.style.display });
      el.style.display = 'none';
    });

    // Force white background temporarily
    const originalBg = chartElement.style.backgroundColor;
    chartElement.style.backgroundColor = '#ffffff';

    // Wait for styles to apply
    await new Promise(resolve => setTimeout(resolve, 50));

    // Capture the chart element
    const canvas = await html2canvas(chartElement, {
      scale: quality,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, clonedElement) => {
        // Style fixes in the cloned document
        const clonedBadges = clonedElement.querySelectorAll('.rounded-full');
        clonedBadges.forEach(badge => {
          const el = badge as HTMLElement;
          el.style.display = 'inline-flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.textAlign = 'center';
          el.style.whiteSpace = 'nowrap';
          el.style.lineHeight = '1.5';
          el.style.verticalAlign = 'middle';
        });

        // Fix flex containers
        const flexContainers = clonedElement.querySelectorAll('.flex');
        flexContainers.forEach(container => {
          const el = container as HTMLElement;
          el.style.alignItems = 'center';
        });

        // Ensure header gradient has solid background
        const headers = clonedElement.querySelectorAll('.bg-gradient-to-r');
        headers.forEach(header => {
          const el = header as HTMLElement;
          el.style.background = '#f3f4f6';
        });
      }
    });

    // Restore original styles
    elementsToHide.forEach(({ element, originalDisplay }) => {
      element.style.display = originalDisplay;
    });
    chartElement.style.backgroundColor = originalBg;

    // Get image dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Calculate PDF dimensions
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = 297; // A4 height in mm
    const margin = 10;
    
    // Choose orientation based on aspect ratio
    const aspectRatio = imgWidth / imgHeight;
    const orientation = aspectRatio > 1.2 ? 'landscape' : 'portrait';
    
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = orientation === 'portrait' ? pdfWidth : pdfHeight;
    const pageHeight = orientation === 'portrait' ? pdfHeight : pdfWidth;
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - (margin * 2) - 20; // Reserve space for title

    let yOffset = margin;

    // Add title if provided
    if (title) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(title, pageWidth / 2, yOffset + 5, { align: 'center' });
      yOffset += 12;
    }

    // Add timestamp
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    const timestamp = `Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    doc.text(timestamp, pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 8;

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png', 1.0);

    // Calculate image dimensions to fit page
    const ratio = imgHeight / imgWidth;
    let finalWidth = availableWidth;
    let finalHeight = finalWidth * ratio;

    if (finalHeight > availableHeight) {
      finalHeight = availableHeight;
      finalWidth = finalHeight / ratio;
    }

    // Center the image
    const xOffset = (pageWidth - finalWidth) / 2;

    // Add the chart image
    doc.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

    // Save the PDF
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to export chart to PDF:', error);
    throw new Error('Failed to export chart to PDF');
  }
}
