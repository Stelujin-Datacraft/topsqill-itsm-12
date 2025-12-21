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
  const { filename = 'chart-export', quality = 2 } = options;

  try {
    // Clone the element to avoid modifying the original
    const clonedElement = chartElement.cloneNode(true) as HTMLElement;
    
    // Create a temporary container for the cloned element
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = `${chartElement.offsetWidth}px`;
    tempContainer.style.backgroundColor = '#ffffff';
    tempContainer.style.padding = '20px';
    tempContainer.style.boxSizing = 'border-box';
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);

    // Remove export buttons and controls from the clone
    const exportButtons = clonedElement.querySelectorAll('[data-export-hide="true"]');
    exportButtons.forEach(btn => btn.remove());

    // Remove hover states and opacity controls
    const hoverElements = clonedElement.querySelectorAll('.opacity-0, .group-hover\\:opacity-100');
    hoverElements.forEach(el => {
      (el as HTMLElement).style.opacity = '0';
      (el as HTMLElement).style.display = 'none';
    });

    // Fix badge wrapping - make them inline and properly spaced
    const badges = clonedElement.querySelectorAll('.flex-wrap');
    badges.forEach(badge => {
      (badge as HTMLElement).style.display = 'flex';
      (badge as HTMLElement).style.flexWrap = 'wrap';
      (badge as HTMLElement).style.gap = '8px';
      (badge as HTMLElement).style.alignItems = 'center';
    });

    // Ensure all badge spans are properly styled
    const badgeSpans = clonedElement.querySelectorAll('.rounded-full');
    badgeSpans.forEach(span => {
      (span as HTMLElement).style.display = 'inline-flex';
      (span as HTMLElement).style.alignItems = 'center';
      (span as HTMLElement).style.whiteSpace = 'nowrap';
      (span as HTMLElement).style.flexShrink = '0';
    });

    // Set proper background colors for the header
    const headerSection = clonedElement.querySelector('.bg-gradient-to-r');
    if (headerSection) {
      (headerSection as HTMLElement).style.background = '#f8f9fa';
      (headerSection as HTMLElement).style.borderRadius = '8px';
      (headerSection as HTMLElement).style.padding = '16px';
    }

    // Ensure chart container has proper dimensions
    clonedElement.style.width = '100%';
    clonedElement.style.height = 'auto';
    clonedElement.style.minHeight = '400px';
    clonedElement.style.overflow = 'visible';
    clonedElement.style.backgroundColor = '#ffffff';

    // Wait for any reflows
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture the cloned element as canvas
    const canvas = await html2canvas(tempContainer, {
      scale: quality,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: tempContainer.offsetWidth,
      height: tempContainer.scrollHeight,
      windowWidth: tempContainer.offsetWidth,
      windowHeight: tempContainer.scrollHeight,
    });

    // Clean up
    document.body.removeChild(tempContainer);

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

    // Choose orientation based on content aspect ratio
    const orientation = imageHeight > (pdfHeight - margin * 2) ? 'portrait' : 'landscape';
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = orientation === 'portrait' ? pdfWidth : pdfHeight;
    const pageHeight = orientation === 'portrait' ? pdfHeight : pdfWidth;

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png', 1.0);

    // Calculate final image size to fit the page
    const maxHeight = pageHeight - (margin * 2);
    const maxWidth = pageWidth - (margin * 2);
    
    let finalWidth = maxWidth;
    let finalHeight = finalWidth * ratio;

    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = finalHeight / ratio;
    }

    // Center the image
    const xOffset = (pageWidth - finalWidth) / 2;
    const yOffset = margin;

    // Add the chart image
    doc.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

    // Save the PDF
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to export chart to PDF:', error);
    throw new Error('Failed to export chart to PDF');
  }
}
