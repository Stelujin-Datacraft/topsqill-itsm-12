import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, Calculator, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type FormulaBreakdown, type FormulaVariable } from './FormulaBreakdownDialog';

interface FormulaBreakdownTableProps {
  title: string;
  breakdown: FormulaBreakdown;
  onClose: () => void;
}

function VariableRow({ variable, depth = 0 }: { variable: FormulaVariable; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasSub = !!variable.subBreakdown;
  const sub = variable.subBreakdown;

  return (
    <>
      <TableRow
        className={cn(
          hasSub && 'cursor-pointer hover:bg-primary/5',
          variable.highlight && 'bg-primary/5',
        )}
        onClick={hasSub ? () => setExpanded(!expanded) : undefined}
      >
        <TableCell className="py-2">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {hasSub && (
              expanded
                ? <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground">{variable.label}</span>
            {hasSub && !expanded && (
              <Badge variant="outline" className="text-[9px] ml-1 h-4 px-1">has formula</Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="py-2">
          {variable.fieldName && (
            <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
              {variable.fieldName}
            </code>
          )}
        </TableCell>
        <TableCell className="py-2 text-right">
          <Badge variant={variable.highlight ? 'default' : 'secondary'} className="font-mono text-xs">
            {typeof variable.value === 'number' ? variable.value.toLocaleString('en-IN') : variable.value}
          </Badge>
        </TableCell>
      </TableRow>
      {/* Sub-breakdown rows when expanded */}
      {expanded && sub && (
        <>
          {/* Sub-formula row */}
          <TableRow className="bg-muted/30">
            <TableCell colSpan={3} className="py-1.5" style={{ paddingLeft: (depth + 1) * 20 + 8 }}>
              <div className="flex items-center gap-2">
                <Calculator className="h-3 w-3 text-primary" />
                <code className="text-[11px] font-mono text-primary">{sub.formula}</code>
                {sub.description && (
                  <span className="text-[10px] text-muted-foreground">— {sub.description}</span>
                )}
              </div>
            </TableCell>
          </TableRow>
          {sub.variables.map((sv, si) => (
            <VariableRow key={si} variable={sv} depth={depth + 1} />
          ))}
          {sub.steps && sub.steps.map((step, si) => (
            <TableRow key={`step-${si}`} className="bg-muted/20">
              <TableCell className="py-1.5" style={{ paddingLeft: (depth + 1) * 20 + 8 }}>
                <span className="text-xs text-muted-foreground">Step {si + 1}: {step.label}</span>
              </TableCell>
              <TableCell className="py-1.5">
                <code className="text-[11px] font-mono text-foreground">{step.expression}</code>
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <span className="text-xs font-bold font-mono text-foreground">{step.result}</span>
              </TableCell>
            </TableRow>
          ))}
          {/* Sub result */}
          <TableRow className="bg-primary/5">
            <TableCell className="py-1.5" style={{ paddingLeft: (depth + 1) * 20 + 8 }}>
              <span className="text-xs font-semibold text-primary">= Result</span>
            </TableCell>
            <TableCell className="py-1.5" />
            <TableCell className="py-1.5 text-right">
              <Badge variant="default" className="font-mono text-xs">
                {typeof sub.result === 'number' ? sub.result.toLocaleString('en-IN') : sub.result}
              </Badge>
            </TableCell>
          </TableRow>
        </>
      )}
    </>
  );
}

export function FormulaBreakdownTable({ title, breakdown, onClose }: FormulaBreakdownTableProps) {
  return (
    <Card className="border-primary/30 shadow-md animate-in slide-in-from-top-2 duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">{title} — Formula Breakdown</CardTitle>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-sm flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Formula display */}
        <div className="rounded-md bg-muted/60 border px-3 py-2">
          <code className="text-sm font-mono text-foreground">{breakdown.formula}</code>
          {breakdown.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{breakdown.description}</p>
          )}
        </div>

        {/* Variables table */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="text-[11px] uppercase tracking-wider h-8">Field</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider h-8">Source</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.variables.map((v, i) => (
                <VariableRow key={i} variable={v} />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Calculation steps */}
        {breakdown.steps && breakdown.steps.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-[11px] uppercase tracking-wider h-8">Step</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider h-8">Expression</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.steps.map((step, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-5 w-5 p-0 flex items-center justify-center shrink-0">
                          {i + 1}
                        </Badge>
                        <span className="text-xs text-foreground">{step.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <code className="text-xs font-mono text-foreground">{step.expression}</code>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-xs font-bold font-mono text-foreground">{step.result}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Final result */}
        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5">
          <span className="text-sm font-semibold text-foreground">Result</span>
          <span className="text-lg font-bold text-primary font-mono">
            {typeof breakdown.result === 'number' ? breakdown.result.toLocaleString('en-IN') : breakdown.result}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
