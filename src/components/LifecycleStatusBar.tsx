import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';
import { Check, Circle, ChevronRight, History } from 'lucide-react';
import { StageChangeDialog } from './StageChangeDialog';
import { LifecycleHistoryDialog } from './LifecycleHistoryDialog';
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
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

  // Send in-app notification on stage change
  const sendStageChangeNotification = async (fromStage: string | null, toStage: string) => {
    if (!submissionId) return;
    
    try {
      const { data: submission, error: subError } = await supabase
        .from('form_submissions')
        .select('submitted_by, form_id, submission_ref_id')
        .eq('id', submissionId)
        .single();
      
      if (subError || !submission) {
        console.log('Could not fetch submission for notification');
        return;
      }

      if (submission.submitted_by) {
        const recordRef = submission.submission_ref_id || submissionId.slice(0, 8);
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: submission.submitted_by,
          type: 'lifecycle_stage_change',
          title: 'Record Stage Updated',
          message: `Record ${recordRef} has moved from "${fromStage || 'Initial'}" to "${toStage}" for field "${field.label}".`,
          data: { 
            submissionId, 
            submissionRefId: submission.submission_ref_id,
            fieldId: field.id, 
            fieldLabel: field.label,
            fromStage, 
            toStage,
            changedAt: new Date().toISOString()
          }
        });

        if (notifError) {
          console.error('Error creating notification:', notifError);
        } else {
          console.log('In-app notification sent to submitter');
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
    console.log('handleStageChange called:', { newStage, comment, submissionId, hasOnChange: !!onChange });
    if (onChange) {
      const previousStage = value;
      // Update UI immediately
      onChange(newStage);
      toast({ title: "Stage Updated", description: `Changed to "${newStage}"` });
      
      if (submissionId) {
        console.log('Adding history entry with comment:', comment);
        // Run all async operations in parallel for speed
        Promise.all([
          addHistoryEntry(previousStage, newStage, comment || undefined),
          sendStageChangeNotification(previousStage, newStage)
        ]).then(() => {
          refetchHistory();
        }).catch(err => {
          console.error('Error in stage change operations:', err);
        });
      } else {
        console.log('No submissionId, skipping history entry');
      }
    }
  };

  const handleDialogConfirm = async (comment: string) => {
    if (pendingStage) await handleStageChange(pendingStage, comment);
    setDialogOpen(false);
    setPendingStage(null);
  };

  const currentIndex = options.findIndex((o: any) => getOptionValue(o) === value);
  const pendingStageLabel = pendingStage ? getOptionLabel(options.find((o: any) => getOptionValue(o) === pendingStage) || pendingStage) : '';
  const currentStageLabel = value ? getOptionLabel(options.find((o: any) => getOptionValue(o) === value) || value) : '';

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Connected Progress Bar - White background */}
        <div className="flex items-center bg-white dark:bg-slate-100 rounded-lg p-1 shadow-sm border border-border">
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
                          ? `${color.bg} ${color.hover} text-white ${color.border} font-semibold shadow-md` 
                          : isPast
                            ? `${color.bg} ${color.hover} text-white opacity-90`
                            : `bg-slate-200 text-slate-500 ${isEditing ? 'hover:bg-slate-300' : ''}`
                      } ${!canTransition && isEditing && !isSelected ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                  <ChevronRight className={`h-4 w-4 mx-0.5 ${index <= currentIndex ? color.text : 'text-slate-400'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>


        {/* View History Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300"
              onClick={() => setHistoryDialogOpen(true)}
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>View stage history</TooltipContent>
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

        <LifecycleHistoryDialog
          open={historyDialogOpen}
          onClose={() => setHistoryDialogOpen(false)}
          history={history}
          loading={historyLoading}
          fieldLabel={field.label}
        />
      </div>
    </TooltipProvider>
  );
}
