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
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface CreateReportDialogProps {
  children?: React.ReactNode;
}

export function CreateReportDialog({ children }: CreateReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const { createReport } = useReports();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!reportName.trim()) {
      toast({
        title: "Error",
        description: "Report name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      
      const newReport = await createReport({
        name: reportName.trim(),
        description: reportDescription.trim()
      });

      if (newReport) {
        toast({
          title: "Success",
          description: "Report created successfully",
        });

        // Reset form
        setReportName('');
        setReportDescription('');
        setIsOpen(false);

        // Navigate to the report editor with the actual report ID
        navigate(`/report-editor/${newReport.id}`);
      }
    } catch (error) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: "Failed to create report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setReportName('');
    setReportDescription('');
  };

  return (
    <>
      {children ? (
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">
          {children}
        </div>
      ) : (
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Report</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="report-name">Report Name *</Label>
              <Input
                id="report-name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Enter report name"
                disabled={creating}
              />
            </div>
            
            <div>
              <Label htmlFor="report-description">Description</Label>
              <Textarea
                id="report-description"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Enter report description (optional)"
                rows={3}
                disabled={creating}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !reportName.trim()}>
              {creating ? 'Creating...' : 'Create Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}