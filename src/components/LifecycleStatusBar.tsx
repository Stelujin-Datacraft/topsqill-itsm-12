import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';
import { Check, Clock, Circle, ChevronRight, History, AlertTriangle } from 'lucide-react';
import { StageChangeDialog } from './StageChangeDialog';
import { useLifecycleHistory } from '@/hooks/useLifecycleHistory';
import { useSLANotification } from '@/hooks/useSLANotification';
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
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  
  const { 
    history, 
    loading: historyLoading,
    addHistoryEntry, 
    getTimeInCurrentStage,
    refetch: refetchHistory
  } = useLifecycleHistory(submissionId || '', field.id);

  // Parse options from the field
  const options = Array.isArray(field.options) 
    ? field.options 
    : typeof field.options === 'string' 
      ? (() => { try { return JSON.parse(field.options); } catch { return []; } })()
      : [];

  const customConfig = ((field.customConfig as any) || {}) as Record<string, any>;
  const transitionRules = customConfig.transitionRules || {};
  const requireCommentOnChange = customConfig.requireCommentOnChange || false;
  const slaWarningHours = customConfig.slaWarningHours || null;

  // SLA Notification hook
  useSLANotification({
    submissionId: submissionId || '',
    fieldId: field.id,
    fieldLabel: field.label,
    currentStage: value,
    slaWarningHours,
    lastChangedAt: history[0]?.changed_at || null
  });

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

  // Create initial history entry if value exists but no history
  useEffect(() => {
    const createInitialHistory = async () => {
      if (submissionId && value && !historyLoading && history.length === 0 && user) {
        console.log('Creating initial lifecycle history entry for:', value);
        await addHistoryEntry(null, value, 'Initial stage');
      }
    };
    createInitialHistory();
  }, [submissionId, value, historyLoading, history.length, user]);

  // Check if transition is allowed
  const isTransitionAllowed = (fromStage: string, toStage: string): boolean => {
    if (!transitionRules || Object.keys(transitionRules).length === 0) return true;
    const allowedTransitions = transitionRules[fromStage];
    if (!allowedTransitions) return true;
    return allowedTransitions.includes(toStage);
  };

  // Check if SLA is exceeded
  const isSLAExceeded = (): boolean => {
    if (!slaWarningHours || !history.length) return false;
    const lastChange = history[0];
    if (!lastChange) return false;
    
    const lastChangeDate = new Date(lastChange.changed_at);
    const now = new Date();
    const diffHours = (now.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= slaWarningHours;
  };

  // Get time remaining before SLA warning
  const getTimeToSLAWarning = (): string | null => {
    if (!slaWarningHours || !history.length) return null;
    const lastChange = history[0];
    if (!lastChange) return null;
    
    const lastChangeDate = new Date(lastChange.changed_at);
    const warningDate = new Date(lastChangeDate.getTime() + (slaWarningHours * 60 * 60 * 1000));
    const now = new Date();
    
    if (now >= warningDate) return 'Exceeded';
    
    const diffMs = warningDate.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
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
  const slaExceeded = isSLAExceeded();
  const slaTimeRemaining = getTimeToSLAWarning();
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

        {/* Time in current stage with clock icon */}
        {timeInStage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`text-xs flex items-center gap-1 ${
                  slaExceeded ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950' : ''
                }`}
              >
                <Clock className="h-3 w-3" />
                {timeInStage}
                {slaExceeded && <AlertTriangle className="h-3 w-3 ml-1" />}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p>Time in current stage: {timeInStage}</p>
                {slaWarningHours && (
                  <p className={slaExceeded ? 'text-red-400' : 'text-amber-400'}>
                    SLA: {slaTimeRemaining}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* SLA Warning Badge */}
        {slaExceeded && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="text-xs flex items-center gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                SLA Exceeded
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Record has been in this stage for over {slaWarningHours} hours</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* History popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative">
              <History className="h-4 w-4" />
              {history.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                  {history.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Stage History
              </h4>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No stage changes recorded yet
                </p>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {history.map((entry, idx) => (
                      <div key={entry.id} className="text-xs border-l-2 border-primary/30 pl-3 py-1 relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary" />
                        
                        {/* Stage transition */}
                        <div className="flex items-center gap-2 font-medium">
                          <span className="text-muted-foreground">
                            {entry.from_stage || 'Initial'}
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground">{entry.to_stage}</span>
                        </div>
                        
                        {/* Timestamp */}
                        <div className="text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.changed_at).toLocaleString()}
                        </div>
                        
                        {/* Comment */}
                        {entry.comment && (
                          <div className="mt-1 text-muted-foreground bg-muted/50 rounded px-2 py-1 italic">
                            "{entry.comment}"
                          </div>
                        )}
                        
                        {/* Duration in previous stage */}
                        {entry.duration_in_previous_stage && (
                          <div className="text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="font-medium">Duration:</span> {entry.duration_in_previous_stage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </PopoverContent>
        </Popover>

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
