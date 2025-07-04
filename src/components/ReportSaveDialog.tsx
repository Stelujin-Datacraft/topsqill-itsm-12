
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReports } from '@/hooks/useReports';
import { toast } from '@/hooks/use-toast';

interface ReportSaveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tableConfig: any;
  formName: string;
}

export function ReportSaveDialog({ 
  isOpen, 
  onOpenChange, 
  tableConfig, 
  formName 
}: ReportSaveDialogProps) {
  const [reportName, setReportName] = useState(`${formName} Data Table`);
  const [reportDescription, setReportDescription] = useState(
    `Data table report for ${formName} submissions`
  );
  const [saving, setSaving] = useState(false);
  const { createReport, saveReportComponent } = useReports();

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Create the report
      const report = await createReport({
        name: reportName,
        description: reportDescription
      });

      if (report) {
        // Save the table component
        await saveReportComponent({
          report_id: report.id,
          type: 'table',
          config: {
            ...tableConfig,
            title: reportName,
            description: reportDescription
          },
          layout: { x: 0, y: 0, w: 12, h: 8 }
        });

        toast({
          title: "Report saved",
          description: "Data table report has been created successfully",
        });

        onOpenChange(false);
        setReportName(`${formName} Data Table`);
        setReportDescription(`Data table report for ${formName} submissions`);
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Error",
        description: "Failed to save report",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Data Table Report</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Enter report name"
            />
          </div>
          
          <div>
            <Label htmlFor="report-description">Description</Label>
            <Textarea
              id="report-description"
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Enter report description"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !reportName.trim()}>
            {saving ? 'Saving...' : 'Save Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
