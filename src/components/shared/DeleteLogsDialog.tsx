import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteLogsDialogProps {
  tableName: 'audit_logs' | 'form_audit_logs';
  title: string;
  onDeleted: () => void;
}

const timeframeOptions = [
  { value: '24h', label: 'Last 24 Hours', hours: 24 },
  { value: '7d', label: 'Last 7 Days', hours: 24 * 7 },
  { value: '1w', label: 'Last 1 Week', hours: 24 * 7 },
  { value: '1m', label: 'Last 1 Month', hours: 24 * 30 },
  { value: '3w', label: 'Last 3 Weeks', hours: 24 * 21 },
  { value: '3m', label: 'Last 3 Months', hours: 24 * 90 },
  { value: 'all', label: 'All Time', hours: null },
];

export function DeleteLogsDialog({ tableName, title, onDeleted }: DeleteLogsDialogProps) {
  const [open, setOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const selectedOption = timeframeOptions.find(opt => opt.value === timeframe);

  const handleDelete = async () => {
    if (!timeframe) {
      toast.error('Please select a timeframe');
      return;
    }

    if (confirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    try {
      let query = supabase.from(tableName).delete();
      
      if (selectedOption?.hours !== null) {
        const cutoffDate = new Date(Date.now() - (selectedOption!.hours * 60 * 60 * 1000));
        query = query.lte('created_at', cutoffDate.toISOString());
      } else {
        // For "all time", delete all records - we need a condition that's always true
        query = query.gte('created_at', '1970-01-01T00:00:00.000Z');
      }

      const { error, count } = await query;

      if (error) {
        console.error('Delete error:', error);
        toast.error(`Failed to delete logs: ${error.message}`);
        return;
      }

      toast.success(`Successfully deleted ${selectedOption?.label.toLowerCase()} logs`);
      setOpen(false);
      setTimeframe('');
      setConfirmText('');
      onDeleted();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete logs');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {title}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. All selected logs will be permanently deleted from the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Timeframe</label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue placeholder="Choose time range to delete..." />
              </SelectTrigger>
              <SelectContent>
                {timeframeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {timeframe && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">
                Warning: This will delete all logs from {selectedOption?.label.toLowerCase()}.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Type <span className="font-mono text-destructive">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleting || !timeframe || confirmText !== 'DELETE'}
          >
            {deleting ? 'Deleting...' : 'Delete Logs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
