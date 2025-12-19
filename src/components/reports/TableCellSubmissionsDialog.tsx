import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';

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
  displayFields?: string[];
  fieldLabels?: Record<string, string>;
}

interface SubmissionRecord {
  id: string;
  submission_ref_id: string;
  submission_data: Record<string, any>;
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
  groupLabel,
  displayFields = [],
  fieldLabels = {}
}: TableCellSubmissionsDialogProps) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && formId) {
      loadSubmissions();
      setExpandedSubmissions(new Set());
    }
  }, [open, formId, dimensionField, dimensionValue, groupField, groupValue]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data')
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
      setSubmissions(data?.map(d => ({
        ...d,
        submission_data: (d.submission_data as Record<string, any>) || {}
      })) || []);
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

  const toggleExpanded = (submissionId: string) => {
    setExpandedSubmissions(prev => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.join(', ');
      return JSON.stringify(value);
    }
    return String(value);
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

  const hasDisplayFields = displayFields.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
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
              {submissions.map((submission) => {
                const isExpanded = expandedSubmissions.has(submission.id);
                return (
                  <div
                    key={submission.id}
                    className="border border-border rounded-md overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3 hover:bg-muted/30">
                      <div className="flex items-center gap-2">
                        {hasDisplayFields && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleExpanded(submission.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Badge variant="secondary" className="font-mono">
                          #{submission.submission_ref_id}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewSubmission(submission.id)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                    
                    {hasDisplayFields && isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-border">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {displayFields.map((fieldId) => {
                            const value = submission.submission_data[fieldId];
                            const label = fieldLabels[fieldId] || fieldId;
                            return (
                              <div key={fieldId} className="flex flex-col">
                                <span className="text-muted-foreground text-xs">{label}</span>
                                <span className="font-medium truncate" title={formatFieldValue(value)}>
                                  {formatFieldValue(value)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
