import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { BarChart3, X } from 'lucide-react';

export interface ChartClickPayload {
  chartTitle: string;
  dataPoint: Record<string, any>;
}

interface ChartValueInlineProps {
  payload: ChartClickPayload | null;
  onClose: () => void;
}

export function ChartValueModal({ payload, onClose }: ChartValueInlineProps) {
  if (!payload) return null;

  const entries = Object.entries(payload.dataPoint).filter(
    ([key]) => key !== '__proto__' && key !== 'payload'
  );

  return (
    <Card className="border-primary/30 shadow-md animate-in slide-in-from-top-2 duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">{payload.chartTitle} — Data Point</CardTitle>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-sm flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="w-full">
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
                  {entries.map(([key, value]) => (
                    <TableCell key={key} className="py-2 px-4 whitespace-nowrap">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {typeof value === 'number'
                          ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                          : String(value ?? '—')}
                      </Badge>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
