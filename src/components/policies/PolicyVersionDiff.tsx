import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitCompare, ArrowRight } from 'lucide-react';
import type { PolicyVersion } from '@/types/policy';

interface PolicyVersionDiffProps {
  versions: PolicyVersion[];
  currentContent?: Record<string, any>;
  currentVersion: number;
  policyName: string;
}

function htmlToText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText || div.textContent || '';
}

function computeLineDiff(oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; text: string }[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'same' | 'added' | 'removed'; text: string }[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0, ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    const oldLine = oi < oldLines.length ? oldLines[oi] : undefined;
    const newLine = ni < newLines.length ? newLines[ni] : undefined;

    if (oldLine === newLine) {
      result.push({ type: 'same', text: oldLine || '' });
      oi++; ni++;
    } else if (newLine !== undefined && (oldLine === undefined || !oldLines.slice(oi).includes(newLine))) {
      result.push({ type: 'added', text: newLine });
      ni++;
    } else if (oldLine !== undefined && (newLine === undefined || !newLines.slice(ni).includes(oldLine))) {
      result.push({ type: 'removed', text: oldLine });
      oi++;
    } else {
      result.push({ type: 'removed', text: oldLine || '' });
      result.push({ type: 'added', text: newLine || '' });
      oi++; ni++;
    }
  }

  return result;
}

export function PolicyVersionDiff({ versions, currentContent, currentVersion, policyName }: PolicyVersionDiffProps) {
  const [leftVersionNum, setLeftVersionNum] = useState<string>('');
  const [rightVersionNum, setRightVersionNum] = useState<string>('current');

  const allVersionOptions = useMemo(() => {
    const opts = versions.map(v => ({
      value: String(v.version_number),
      label: `v${v.version_number} — ${v.change_summary || v.name}`,
      content: v.content,
    }));
    opts.push({
      value: 'current',
      label: `v${currentVersion} (Current)`,
      content: currentContent || {},
    });
    return opts.sort((a, b) => {
      const aNum = a.value === 'current' ? currentVersion : Number(a.value);
      const bNum = b.value === 'current' ? currentVersion : Number(b.value);
      return aNum - bNum;
    });
  }, [versions, currentContent, currentVersion]);

  const getContent = (versionNum: string): string => {
    if (versionNum === 'current') {
      return htmlToText(currentContent?.html || '');
    }
    const ver = versions.find(v => String(v.version_number) === versionNum);
    return htmlToText(ver?.content?.html || '');
  };

  const leftContent = leftVersionNum ? getContent(leftVersionNum) : '';
  const rightContent = rightVersionNum ? getContent(rightVersionNum) : '';

  const diffResult = useMemo(() => {
    if (!leftVersionNum || !rightVersionNum) return [];
    return computeLineDiff(leftContent, rightContent);
  }, [leftContent, rightContent, leftVersionNum, rightVersionNum]);

  const addedCount = diffResult.filter(d => d.type === 'added').length;
  const removedCount = diffResult.filter(d => d.type === 'removed').length;

  return (
    <div className="space-y-4">
      {/* Version Selectors */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Select value={leftVersionNum} onValueChange={setLeftVersionNum}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select older version..." />
            </SelectTrigger>
            <SelectContent>
              {allVersionOptions.map(o => (
                <SelectItem key={o.value} value={o.value} disabled={o.value === rightVersionNum}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <Select value={rightVersionNum} onValueChange={setRightVersionNum}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select newer version..." />
            </SelectTrigger>
            <SelectContent>
              {allVersionOptions.map(o => (
                <SelectItem key={o.value} value={o.value} disabled={o.value === leftVersionNum}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Diff Display */}
      {leftVersionNum && rightVersionNum ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <GitCompare className="h-4 w-4" />
            <span className="text-emerald-600 font-medium">+{addedCount} added</span>
            <span className="text-destructive font-medium">-{removedCount} removed</span>
          </div>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="font-mono text-xs p-3 space-y-0">
              {diffResult.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No content to compare</p>
              ) : diffResult.every(d => d.type === 'same') ? (
                <p className="text-muted-foreground text-center py-8">No differences found</p>
              ) : (
                diffResult.map((line, i) => (
                  <div
                    key={i}
                    className={`px-2 py-0.5 rounded-sm ${
                      line.type === 'added'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        : line.type === 'removed'
                        ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 line-through'
                        : 'text-foreground'
                    }`}
                  >
                    <span className="select-none mr-2 text-muted-foreground/50">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    {line.text || '\u00A0'}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="text-center py-8">
          <GitCompare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select two versions to compare</p>
        </div>
      )}
    </div>
  );
}
