import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SetDefaultReportDialogProps {
  report: { id: string; name: string; is_default_report?: boolean } | null;
  dashboardId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SetDefaultReportDialog({ report, dashboardId, isOpen, onClose }: SetDefaultReportDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isCurrentlyDefault = report?.is_default_report;

  const handleSetDefault = async () => {
    if (!report) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .update({ is_default_report: true } as any)
        .eq('id', report.id);

      if (error) throw error;

      toast({
        title: 'Default Report Set',
        description: `Users redirected to this dashboard will automatically open "${report.name}".`,
      });

      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      onClose();
    } catch (err) {
      console.error('Error setting default report:', err);
      toast({ title: 'Error', description: 'Failed to set default report.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDefault = async () => {
    if (!report) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .update({ is_default_report: false } as any)
        .eq('id', report.id);

      if (error) throw error;

      toast({ title: 'Default Removed', description: 'Default report has been unset.' });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      onClose();
    } catch (err) {
      console.error('Error removing default report:', err);
      toast({ title: 'Error', description: 'Failed to remove default.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            {isCurrentlyDefault ? 'Remove Default Report' : 'Set Default Report'}
          </DialogTitle>
          <DialogDescription>
            {isCurrentlyDefault
              ? `"${report?.name}" is currently the default report. Users will no longer be auto-redirected to this report.`
              : `Set "${report?.name}" as the default report for this dashboard. When users are redirected to this dashboard, they will automatically open this report.`
            }
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          {isCurrentlyDefault ? (
            <Button variant="outline" onClick={handleRemoveDefault} disabled={loading}>
              {loading ? 'Removing...' : 'Remove Default'}
            </Button>
          ) : (
            <Button onClick={handleSetDefault} disabled={loading}>
              {loading ? 'Saving...' : 'Set as Default'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
