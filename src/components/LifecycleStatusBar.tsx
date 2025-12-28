import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';
import { Check, Clock, Circle, ChevronRight, History, AlertTriangle, Mail } from 'lucide-react';
import { StageChangeDialog } from './StageChangeDialog';
import { useLifecycleHistory } from '@/hooks/useLifecycleHistory';
import { useSLANotification } from '@/hooks/useSLANotification';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();
  const { toast } = useToast();
  const initialHistoryCreated = useRef(false);
  
  const { 
    history, 
    loading: historyLoading,
    lastChange,
    addHistoryEntry, 
    getTimeInCurrentStage,
    refetch: refetchHistory
  } = useLifecycleHistory(submissionId || '', field.id);

  // Update time every minute for time in stage
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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
    lastChangedAt: lastChange?.changed_at || null
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
      if (
        submissionId && 
        value && 
        !historyLoading && 
        history.length === 0 && 
        user &&
        !initialHistoryCreated.current
      ) {
        initialHistoryCreated.current = true;
        console.log('Creating initial lifecycle history entry for:', value);
        await addHistoryEntry(null, value, 'Initial stage');
        await refetchHistory();
      }
    };
    createInitialHistory();
  }, [submissionId, value, historyLoading, history.length, user, addHistoryEntry, refetchHistory]);

  // Send email notification on stage change
  const sendStageChangeEmail = async (fromStage: string | null, toStage: string) => {
    if (!submissionId) return;
    
    try {
      const { data: submission, error: subError } = await supabase
        .from('form_submissions')
        .select('submitted_by, form_id')
        .eq('id', submissionId)
        .single();
      
      if (subError || !submission) return;

      if (submission.submitted_by) {
        const { data: submitterProfile } = await supabase
          .from('user_profiles')
          .select('email, first_name')
          .eq('id', submission.submitted_by)
          .single();

        if (submitterProfile?.email) {
          await supabase.from('notifications').insert({
            user_id: submission.submitted_by,
            type: 'lifecycle_stage_change',
            title: 'Record Stage Updated',
            message: `Your submission has moved from "${fromStage || 'Initial'}" to "${toStage}" for field "${field.label}".`,
            data: { submissionId, fieldId: field.id, fromStage, toStage }
          });

          try {
            await supabase.functions.invoke('send-template-email', {
              body: {
                recipients: [submitterProfile.email],
                subject: `Stage Update: ${field.label} - ${toStage}`,
                htmlContent: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Record Stage Updated</h2>
                    <p>Hello ${submitterProfile.first_name || 'User'},</p>
                    <p>The status of your submission has been updated:</p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0;"><strong>Field:</strong> ${field.label}</p>
                      <p style="margin: 10px 0 0;"><strong>Previous Stage:</strong> ${fromStage || 'Initial'}</p>
                      <p style="margin: 10px 0 0;"><strong>New Stage:</strong> ${toStage}</p>
                    </div>
                  </div>
                `
              }
            });
          } catch (emailErr) {
            console.log('Email notification skipped');
          }
        }
      }
    } catch (err) {
      console.error('Error sending stage change notification:', err);
    }
  };

  const isTransitionAllowed = (fromStage: string, toStage: string): boolean => {
    if (!transitionRules || Object.keys(transitionRules).length === 0) return true;
    const allowedTransitions = transitionRules[fromStage];
    if (!allowedTransitions) return true;
    return allowedTransitions.includes(toStage);
  };

  const isSLAExceeded = (): boolean => {
    if (!slaWarningHours || !lastChange) return false;
    const lastChangeDate = new Date(lastChange.changed_at);
    const diffHours = (currentTime.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= slaWarningHours;
  };

  const getTimeToSLAWarning = (): string | null => {
    if (!slaWarningHours || !lastChange) return null;
    const lastChangeDate = new Date(lastChange.changed_at);
    const warningDate = new Date(lastChangeDate.getTime() + (slaWarningHours * 60 * 60 * 1000));
    if (currentTime >= warningDate) return 'Exceeded';
    const diffMs = warningDate.getTime() - currentTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
  };

  const calculateTimeInStage = (): string | null => {
    if (!lastChange) return null;
    const lastChangeDate = new Date(lastChange.changed_at);
    const diffMs = currentTime.getTime() - lastChangeDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

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
    ];
    return colors[index % colors.length];
  };

  const getStageIcon = (optionValue: string, index: number, currentIndex: number) => {
    if (optionValue === value) return <Circle className="h-4 w-4 fill-current" />;
    if (index < currentIndex) return <Check className="h-4 w-4" />;
    return <Circle className="h-4 w-4" />;
  };

  const handleOptionClick = (optionValue: string) => {
    if (!disabled && isEditing && onChange && optionValue !== value) {
      if (!isTransitionAllowed(value, optionValue)) {
        setPendingStage(optionValue);
        setDialogOpen(true);
        return;
      }
      if (requireCommentOnChange) {
        setPendingStage(optionValue);
        setDialogOpen(true);
        return;
      }
      handleStageChange(optionValue, '');
    }
  };

  const handleStageChange = async (newStage: string, comment: string) => {
    if (onChange) {
      const previousStage = value;
      onChange(newStage);
      if (submissionId) {
        await addHistoryEntry(previousStage, newStage, comment || undefined);
        await refetchHistory();
        await sendStageChangeEmail(previousStage, newStage);
        toast({ title: "Stage Updated", description: `Changed to "${newStage}"` });
      }
    }
  };

  const handleDialogConfirm = async (comment: string) => {
    if (pendingStage) await handleStageChange(pendingStage, comment);
    setDialogOpen(false);
    setPendingStage(null);
  };

  const currentIndex = options.findIndex((o: any) => getOptionValue(o) === value);
  const timeInStage = calculateTimeInStage();
  const slaExceeded = isSLAExceeded();
  const slaTimeRemaining = getTimeToSLAWarning();
  const pendingStageLabel = pendingStage ? getOptionLabel(options.find((o: any) => getOptionValue(o) === pendingStage) || pendingStage) : '';
  const currentStageLabel = value ? getOptionLabel(options.find((o: any) => getOptionValue(o) === value) || value) : '';

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
                      onClick={() => handleOptionClick(optionValue)}
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
                {index < options.length - 1 && (
                  <ChevronRight className={`h-4 w-4 mx-0.5 ${index < currentIndex ? color.text : 'text-muted-foreground/50'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Time in current stage */}
        {timeInStage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`text-xs flex items-center gap-1 ${slaExceeded ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950' : ''}`}>
                <Clock className="h-3 w-3" />
                {timeInStage}
                {slaExceeded && <AlertTriangle className="h-3 w-3 ml-1" />}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p>Time in current stage: {timeInStage}</p>
                {slaWarningHours && <p className={slaExceeded ? 'text-red-400' : 'text-amber-400'}>SLA: {slaTimeRemaining}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {slaExceeded && (
          <Badge variant="destructive" className="text-xs flex items-center gap-1 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            SLA Exceeded
          </Badge>
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
              {historyLoading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No stage changes recorded yet</p>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="text-xs border-l-2 border-primary/30 pl-3 py-1 relative">
                        <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary" />
                        <div className="flex items-center gap-2 font-medium">
                          <span className="text-muted-foreground">{entry.from_stage || 'Initial'}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground">{entry.to_stage}</span>
                        </div>
                        <div className="text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.changed_at).toLocaleString()}
                        </div>
                        {entry.comment && (
                          <div className="mt-1 text-muted-foreground bg-muted/50 rounded px-2 py-1 italic">"{entry.comment}"</div>
                        )}
                        {entry.duration_in_previous_stage && (
                          <div className="text-muted-foreground mt-1"><span className="font-medium">Duration:</span> {entry.duration_in_previous_stage}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center">
              <Mail className="h-3 w-3 text-muted-foreground" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Email notifications sent on stage change</p>
          </TooltipContent>
        </Tooltip>

        <StageChangeDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setPendingStage(null); }}
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
