import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';

export interface ChartClickPayload {
  chartTitle: string;
  dataPoint: Record<string, any>;
}

interface ChartValueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ChartClickPayload | null;
}

export function ChartValueModal({ open, onOpenChange, payload }: ChartValueModalProps) {
  if (!payload) return null;

  const entries = Object.entries(payload.dataPoint).filter(
    ([key]) => key !== '__proto__' && key !== 'payload'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            {payload.chartTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="text-[11px] uppercase tracking-wider h-8">Property</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="py-2 text-sm font-medium text-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {typeof value === 'number'
                        ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                        : String(value ?? '—')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
