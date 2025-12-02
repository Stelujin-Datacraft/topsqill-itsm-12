import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface PdfExportOptions {
  formName: string;
  formElement: HTMLElement;
  pages?: { id: string; name: string }[];
  currentPageId?: string;
  onPageChange?: (pageId: string) => void;
}

export async function exportFormToPdf({
  formName,
  formElement,
  pages = [],
  currentPageId,
  onPageChange,
}: PdfExportOptions) {
  try {
    toast.loading('Preparing PDF...');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // If multi-page form, capture each page
    if (pages.length > 1 && onPageChange) {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // Navigate to the page
        if (page.id !== currentPageId) {
          onPageChange(page.id);
          // Wait for page to render
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Capture the form content area
        const canvas = await html2canvas(formElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pdfWidth - 20; // 10mm margin on each side
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Add new page if not first page
        if (i > 0) {
          pdf.addPage();
        }
        
        // Add image to PDF with margins
        let heightLeft = imgHeight;
        let position = 10; // Top margin
        
        // If image is taller than page, split across multiple pages
        while (heightLeft > 0) {
          pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
          heightLeft -= (pdfHeight - 20);
          
          if (heightLeft > 0) {
            pdf.addPage();
            position = -((imgHeight - heightLeft) - 10);
          }
        }
      }
    } else {
      // Single page form or no pagination
      const canvas = await html2canvas(formElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 10;
      
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
      
      // If content overflows, add more pages
      while (heightLeft > 0) {
        pdf.addPage();
        position = -(imgHeight - heightLeft) + 10;
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20);
      }
    }
    
    // Save the PDF
    const fileName = `${formName.replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.pdf`;
    pdf.save(fileName);
    
    toast.dismiss();
    toast.success('PDF saved successfully!');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    toast.dismiss();
    toast.error('Failed to export PDF');
  }
}
