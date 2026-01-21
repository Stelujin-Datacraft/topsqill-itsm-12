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
import { Trash2, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  { value: 'custom', label: 'Custom Range', hours: null },
];

export function DeleteLogsDialog({ tableName, title, onDeleted }: DeleteLogsDialogProps) {
  const [open, setOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const selectedOption = timeframeOptions.find(opt => opt.value === timeframe);
  const isCustomRange = timeframe === 'custom';

  const getDeleteDescription = () => {
    if (isCustomRange && startDate && endDate) {
      return `logs from ${format(startDate, 'MMM d, yyyy')} to ${format(endDate, 'MMM d, yyyy')}`;
    }
    return selectedOption?.label.toLowerCase() || '';
  };

  const handleDelete = async () => {
    if (!timeframe) {
      toast.error('Please select a timeframe');
      return;
    }

    if (isCustomRange && (!startDate || !endDate)) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (confirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    try {
      let query = supabase.from(tableName).delete();
      
      if (isCustomRange && startDate && endDate) {
        // Custom date range - delete logs between start and end dates
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
      } else if (selectedOption?.hours !== null && selectedOption?.hours !== undefined) {
        // Delete logs from the last X hours (recent logs)
        const cutoffDate = new Date(Date.now() - (selectedOption.hours * 60 * 60 * 1000));
        query = query.gte('created_at', cutoffDate.toISOString());
      } else {
        // For "all time", delete all records using a condition that matches everything
        // Use 'not is null' on id which is always true for existing records
        query = query.not('id', 'is', null);
      }

      const { error, count } = await query;

      if (error) {
        console.error('Delete error:', error);
        toast.error(`Failed to delete logs: ${error.message}`);
        return;
      }

      toast.success(`Successfully deleted ${getDeleteDescription()} logs`);
      setOpen(false);
      setTimeframe('');
      setConfirmText('');
      setStartDate(undefined);
      setEndDate(undefined);
      onDeleted();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete logs');
    } finally {
      setDeleting(false);
    }
  };

  const isValidSelection = () => {
    if (!timeframe) return false;
    if (isCustomRange) {
      return startDate && endDate && confirmText === 'DELETE';
    }
    return confirmText === 'DELETE';
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

          {/* Custom Date Range Picker */}
          {isCustomRange && (
            <div className="space-y-3 p-3 border rounded-md bg-muted/50">
              <label className="text-sm font-medium">Select Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        disabled={(date) => date > new Date()}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        disabled={(date) => 
                          date > new Date() || 
                          (startDate ? date < startDate : false)
                        }
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {startDate && endDate && (
                <p className="text-xs text-muted-foreground">
                  Will delete logs from {format(startDate, 'MMM d, yyyy')} to {format(endDate, 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}

          {timeframe && !isCustomRange && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">
                Warning: This will delete all logs from {selectedOption?.label.toLowerCase()}.
              </p>
            </div>
          )}

          {isCustomRange && startDate && endDate && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">
                Warning: This will delete all logs from {format(startDate, 'MMM d, yyyy')} to {format(endDate, 'MMM d, yyyy')}.
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
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-destructive bg-background"
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
            disabled={deleting || !isValidSelection()}
          >
            {deleting ? 'Deleting...' : 'Delete Logs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
