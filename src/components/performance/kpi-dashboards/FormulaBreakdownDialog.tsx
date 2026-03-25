import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Calculator, Equal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormulaVariable {
  label: string;
  fieldName?: string;
  value: string | number;
  highlight?: boolean;
}

export interface FormulaBreakdown {
  formula: string;
  description?: string;
  variables: FormulaVariable[];
  steps?: { label: string; expression: string; result: string }[];
  result: string | number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  breakdown: FormulaBreakdown;
}

export function FormulaBreakdownDialog({ open, onOpenChange, title, breakdown }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Formula */}
          <div className="rounded-lg bg-muted/60 border px-3 py-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Formula</p>
            <p className="text-sm font-mono text-foreground">{breakdown.formula}</p>
            {breakdown.description && (
              <p className="text-xs text-muted-foreground mt-1">{breakdown.description}</p>
            )}
          </div>

          {/* Variables / Fields Used */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fields & Values</p>
            <div className="space-y-1.5">
              {breakdown.variables.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                    v.highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground text-sm">{v.label}</span>
                    {v.fieldName && (
                      <span className="text-[10px] text-muted-foreground font-mono">{v.fieldName}</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs shrink-0 ml-2">
                    {typeof v.value === 'number' ? v.value.toLocaleString('en-IN') : v.value}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Calculation Steps */}
          {breakdown.steps && breakdown.steps.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Calculation Steps</p>
              <div className="space-y-1.5">
                {breakdown.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-md border bg-card px-3 py-2">
                    <Badge variant="outline" className="text-[9px] shrink-0 w-5 h-5 p-0 flex items-center justify-center">
                      {i + 1}
                    </Badge>
                    <span className="text-muted-foreground">{step.label}:</span>
                    <span className="font-mono text-foreground">{step.expression}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-mono font-bold text-foreground">{step.result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Final Result */}
          <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Equal className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Result</span>
            </div>
            <span className="text-xl font-bold text-primary font-mono">
              {typeof breakdown.result === 'number' ? breakdown.result.toLocaleString('en-IN') : breakdown.result}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
