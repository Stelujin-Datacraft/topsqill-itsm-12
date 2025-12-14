import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink } from 'lucide-react';

interface TableCellSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  dimensionField: string;
  dimensionValue: string;
  groupField?: string;
  groupValue?: string;
  dimensionLabel?: string;
  groupLabel?: string;
}

interface SubmissionRecord {
  id: string;
  submission_ref_id: string;
}

export function TableCellSubmissionsDialog({ 
  open, 
  onOpenChange, 
  formId,
  dimensionField,
  dimensionValue,
  groupField,
  groupValue,
  dimensionLabel,
  groupLabel
}: TableCellSubmissionsDialogProps) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && formId) {
      loadSubmissions();
    }
  }, [open, formId, dimensionField, dimensionValue, groupField, groupValue]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('form_submissions')
        .select('id, submission_ref_id')
        .eq('form_id', formId);

      // Apply dimension filter
      if (dimensionField && dimensionValue) {
        query = query.contains('submission_data', { [dimensionField]: dimensionValue });
      }

      // Apply group filter if exists
      if (groupField && groupValue) {
        query = query.contains('submission_data', { [groupField]: groupValue });
      }

      const { data, error } = await query.order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubmission = (submissionId: string) => {
    navigate(`/submission/${submissionId}`);
    onOpenChange(false);
  };

  const getDialogTitle = () => {
    let title = `Submissions`;
    if (dimensionLabel && dimensionValue) {
      title += ` - ${dimensionLabel}: ${dimensionValue}`;
    }
    if (groupLabel && groupValue) {
      title += ` - ${groupLabel}: ${groupValue}`;
    }
    return `${title} (${submissions.length})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading submissions...</span>
            </div>
          ) : submissions.length > 0 ? (
            <div className="space-y-2 p-1">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/30"
                >
                  <Badge variant="secondary" className="font-mono">
                    #{submission.submission_ref_id}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewSubmission(submission.id)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found for this criteria
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
