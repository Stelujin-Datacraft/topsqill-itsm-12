import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3 } from 'lucide-react';

export interface ChartClickPayload {
  chartTitle: string;
  dataPoint: Record<string, any>;
}

interface ChartValueInlineProps {
  payload: ChartClickPayload | null;
  onClose: () => void;
}

export function ChartValueModal({ payload, onClose }: ChartValueInlineProps) {
  const entries = payload
    ? Object.entries(payload.dataPoint).filter(
        ([key]) => key !== '__proto__' && key !== 'payload'
      )
    : [];

  return (
    <Dialog open={!!payload} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-module-reports" />
            {payload?.chartTitle} — Data Point
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="w-full max-h-[60vh]">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5">
                  {entries.map(([key]) => (
                    <TableHead key={key} className="text-[11px] uppercase tracking-wider h-8 whitespace-nowrap px-4">
                      {key.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {entries.map(([key, value]) => {
                    let display: string;
                    if (value == null) display = '—';
                    else if (typeof value === 'number') display = value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
                    else if (typeof value === 'object') display = (value as any).label || (value as any).value || (value as any).name || JSON.stringify(value);
                    else display = String(value);
                    return (
                    <TableCell key={key} className="py-2 px-4 whitespace-nowrap">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {display}
                      </Badge>
                    </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
