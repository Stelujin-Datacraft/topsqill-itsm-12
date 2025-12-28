import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';
import { Check, Clock, Circle, ChevronRight, History } from 'lucide-react';
import { StageChangeDialog } from './StageChangeDialog';
import { useLifecycleHistory } from '@/hooks/useLifecycleHistory';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LifecycleStatusBarProps {
  field: FormField;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  isEditing?: boolean;
  submissionId?: string;
}

export function LifecycleStatusBar({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  isEditing = false,
  submissionId
}: LifecycleStatusBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  
  const { 
    history, 
    addHistoryEntry, 
    getTimeInCurrentStage 
  } = useLifecycleHistory(submissionId || '', field.id);

  // Parse options from the field
  const options = Array.isArray(field.options) 
    ? field.options 
    : typeof field.options === 'string' 
      ? (() => { try { return JSON.parse(field.options); } catch { return []; } })()
      : [];

  const customConfig = (field.customConfig as any) || {};
  const transitionRules = customConfig.transitionRules || {};
  const requireCommentOnChange = customConfig.requireCommentOnChange || false;

  const getOptionLabel = (option: any): string => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') {
      return option.label || option.value || String(option);
    }
    return String(option);
  };

  const getOptionValue = (option: any): string => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') {
      return option.value || option.label || String(option);
    }
    return String(option);
  };

  // Check if transition is allowed
  const isTransitionAllowed = (fromStage: string, toStage: string): boolean => {
    if (!transitionRules || Object.keys(transitionRules).length === 0) return true;
    const allowedTransitions = transitionRules[fromStage];
    if (!allowedTransitions) return true;
    return allowedTransitions.includes(toStage);
  };

  // Get color based on option label (semantic colors for common statuses)
  const getColorForOption = (optionLabel: string, index: number) => {
    const label = optionLabel.toLowerCase();
    
    if (label.includes('complete') || label.includes('done') || label.includes('approved') || label.includes('success')) {
      return { bg: 'bg-green-600', hover: 'hover:bg-green-700', border: 'border-green-500', text: 'text-green-600' };
    }
    if (label.includes('reject') || label.includes('cancel') || label.includes('fail') || label.includes('error')) {
      return { bg: 'bg-red-600', hover: 'hover:bg-red-700', border: 'border-red-500', text: 'text-red-600' };
    }
    if (label.includes('pending') || label.includes('wait') || label.includes('hold') || label.includes('new')) {
      return { bg: 'bg-amber-600', hover: 'hover:bg-amber-700', border: 'border-amber-500', text: 'text-amber-600' };
    }
    if (label.includes('progress') || label.includes('review') || label.includes('process') || label.includes('active')) {
      return { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', border: 'border-blue-500', text: 'text-blue-600' };
    }
    
    const colors = [
      { bg: 'bg-slate-600', hover: 'hover:bg-slate-700', border: 'border-slate-500', text: 'text-slate-600' },
      { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', border: 'border-indigo-500', text: 'text-indigo-600' },
      { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', border: 'border-purple-500', text: 'text-purple-600' },
      { bg: 'bg-teal-600', hover: 'hover:bg-teal-700', border: 'border-teal-500', text: 'text-teal-600' },
      { bg: 'bg-pink-600', hover: 'hover:bg-pink-700', border: 'border-pink-500', text: 'text-pink-600' },
    ];
    
    return colors[index % colors.length];
  };

  // Get stage icon based on position relative to current
  const getStageIcon = (optionValue: string, index: number, currentIndex: number) => {
    if (optionValue === value) {
      return <Circle className="h-4 w-4 fill-current" />;
    }
    if (index < currentIndex) {
      return <Check className="h-4 w-4" />;
    }
    return <Circle className="h-4 w-4" />;
  };

  const handleOptionClick = (optionValue: string, optionLabel: string) => {
    if (!disabled && isEditing && onChange && optionValue !== value) {
      const currentLabel = options.find((o: any) => getOptionValue(o) === value);
      const currentLabelStr = currentLabel ? getOptionLabel(currentLabel) : value;
      
      // Check transition rules
      if (!isTransitionAllowed(value, optionValue)) {
        setPendingStage(optionValue);
        setDialogOpen(true);
        return;
      }

      // If comments required, show dialog
      if (requireCommentOnChange) {
        setPendingStage(optionValue);
        setDialogOpen(true);
        return;
      }

      // Direct change
      onChange(optionValue);
      if (submissionId) {
        addHistoryEntry(value, optionValue);
      }
    }
  };

  const handleDialogConfirm = async (comment: string) => {
    if (pendingStage && onChange) {
      onChange(pendingStage);
      if (submissionId) {
        await addHistoryEntry(value, pendingStage, comment);
      }
    }
    setDialogOpen(false);
    setPendingStage(null);
  };

  const currentIndex = options.findIndex((o: any) => getOptionValue(o) === value);
  const timeInStage = getTimeInCurrentStage();
  const pendingStageLabel = pendingStage 
    ? getOptionLabel(options.find((o: any) => getOptionValue(o) === pendingStage) || pendingStage)
    : '';
  const currentStageLabel = value 
    ? getOptionLabel(options.find((o: any) => getOptionValue(o) === value) || value)
    : '';

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Connected Progress Bar */}
        <div className="flex items-center bg-muted/30 rounded-lg p-1">
          {options.map((option: any, index: number) => {
            const optionValue = getOptionValue(option);
            const optionLabel = getOptionLabel(option);
            const isSelected = value === optionValue;
            const isPast = index < currentIndex;
            const color = getColorForOption(optionLabel, index);
            const canTransition = isTransitionAllowed(value, optionValue);
            
            return (
              <React.Fragment key={optionValue}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isSelected ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleOptionClick(optionValue, optionLabel)}
                      disabled={disabled || !isEditing || isSelected}
                      className={`text-xs px-3 py-1 flex items-center gap-1.5 transition-all ${
                        isSelected 
                          ? `${color.bg} ${color.hover} text-white ${color.border} font-semibold` 
                          : isPast 
                            ? `${color.text} bg-muted/50` 
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      } ${!canTransition && isEditing && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {getStageIcon(optionValue, index, currentIndex)}
                      {optionLabel}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{optionLabel}</p>
                    {!canTransition && isEditing && !isSelected && (
                      <p className="text-xs text-red-400">Transition not allowed</p>
                    )}
                  </TooltipContent>
                </Tooltip>
                
                {/* Connector line between stages */}
                {index < options.length - 1 && (
                  <ChevronRight className={`h-4 w-4 mx-0.5 ${
                    index < currentIndex ? color.text : 'text-muted-foreground/50'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Time in current stage */}
        {timeInStage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeInStage}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Time in current stage</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* History popover */}
        {history.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <History className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Stage History</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {history.map((entry, idx) => (
                      <div key={entry.id} className="text-xs border-l-2 border-muted pl-3 py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {entry.from_stage || 'Initial'}
                          </span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="font-medium">{entry.to_stage}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {new Date(entry.changed_at).toLocaleString()}
                        </div>
                        {entry.comment && (
                          <div className="mt-1 text-muted-foreground italic">
                            "{entry.comment}"
                          </div>
                        )}
                        {entry.duration_in_previous_stage && (
                          <div className="text-muted-foreground">
                            Duration: {entry.duration_in_previous_stage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Stage Change Dialog */}
        <StageChangeDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setPendingStage(null);
          }}
          onConfirm={handleDialogConfirm}
          fromStage={currentStageLabel}
          toStage={pendingStageLabel}
          requireComment={requireCommentOnChange}
          transitionBlocked={pendingStage ? !isTransitionAllowed(value, pendingStage) : false}
          blockReason={`Transition from "${currentStageLabel}" to "${pendingStageLabel}" is not allowed.`}
        />
      </div>
    </TooltipProvider>
  );
}
