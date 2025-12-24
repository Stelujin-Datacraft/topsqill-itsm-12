import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeatmapCellProps {
  rowLabel: string;
  colLabel: string;
  rowValue: string;
  colValue: string;
  cellValue: number;
  cellCount: number;
  intensityLabel: string;
  aggregation: string;
  intensityPercent: string;
  maxValue: number;
  backgroundColor: string;
  textColor: string;
  onClick: () => void;
}

export function HeatmapCell({
  rowLabel,
  colLabel,
  rowValue,
  colValue,
  cellValue,
  cellCount,
  intensityLabel,
  aggregation,
  intensityPercent,
  maxValue,
  backgroundColor,
  textColor,
  onClick,
}: HeatmapCellProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="min-h-[40px] rounded-sm flex items-center justify-center text-xs font-medium cursor-pointer hover:ring-2 hover:ring-primary hover:z-10 transition-all select-none"
            style={{
              backgroundColor,
              color: textColor,
            }}
            onClick={handleClick}
            onMouseDown={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }}
          >
            <span className="truncate px-1">
              {typeof cellValue === 'number' ? cellValue.toLocaleString() : cellValue}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-popover text-popover-foreground border border-border shadow-lg p-0 max-w-[280px]"
          sideOffset={8}
        >
          <div className="p-3">
            {/* Header */}
            <div className="font-semibold text-sm mb-2 pb-2 border-b border-border">
              Cell Details
            </div>
            
            {/* Dimensions */}
            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between items-center gap-3">
                <span className="text-muted-foreground text-xs">{rowLabel}:</span>
                <span className="font-medium text-xs truncate max-w-[140px]" title={rowValue}>
                  {rowValue}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-muted-foreground text-xs">{colLabel}:</span>
                <span className="font-medium text-xs truncate max-w-[140px]" title={colValue}>
                  {colValue}
                </span>
              </div>
            </div>
            
            {/* Values Section */}
            <div className="bg-muted/50 rounded-md p-2 mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Values</div>
              <div className="space-y-1">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-muted-foreground text-xs">{intensityLabel}:</span>
                  <span className="font-semibold text-sm text-primary">
                    {typeof cellValue === 'number' ? cellValue.toLocaleString() : cellValue}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-muted-foreground text-xs">Aggregation:</span>
                  <span className="font-medium text-xs capitalize">{aggregation}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-muted-foreground text-xs">Records:</span>
                  <span className="font-medium text-xs">{cellCount}</span>
                </div>
              </div>
            </div>
            
            {/* Intensity Section */}
            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between items-center gap-3">
                <span className="text-muted-foreground text-xs">Intensity:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(parseFloat(intensityPercent), 100)}%` }}
                    />
                  </div>
                  <span className="font-medium text-xs">{intensityPercent}%</span>
                </div>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-muted-foreground text-xs">Max Value:</span>
                <span className="font-medium text-xs">{maxValue.toLocaleString()}</span>
              </div>
            </div>
            
            {/* Action Hint */}
            <div className="text-[11px] text-muted-foreground pt-2 border-t border-border flex items-center gap-1">
              <span>Click to view {cellCount} record{cellCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
