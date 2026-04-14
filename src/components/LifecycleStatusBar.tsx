import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';
import { Check, Circle, ChevronRight, History, Clock, ArrowRight } from 'lucide-react';
import { StageChangeDialog } from './StageChangeDialog';
import { LifecycleHistoryDialog } from './LifecycleHistoryDialog';
import { useLifecycleHistory } from '@/hooks/useLifecycleHistory';
import { useSLANotification } from '@/hooks/useSLANotification';
import { useSLATracking } from '@/hooks/useSLATracking';
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
  formId?: string;
  hideHistoryButton?: boolean;
  onOpenHistory?: () => void;
}

// Default color palette for stages without configured colors
const STAGE_COLORS = [
  { bg: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#a5b4fc' }, // indigo
  { bg: '#0ea5e9', light: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' }, // sky
  { bg: '#8b5cf6', light: '#f3e8ff', text: '#6d28d9', border: '#c4b5fd' }, // violet
  { bg: '#14b8a6', light: '#ccfbf1', text: '#0f766e', border: '#5eead4' }, // teal
  { bg: '#f59e0b', light: '#fef3c7', text: '#b45309', border: '#fcd34d' }, // amber
  { bg: '#ec4899', light: '#fce7f3', text: '#be185d', border: '#f9a8d4' }, // pink
  { bg: '#10b981', light: '#d1fae5', text: '#047857', border: '#6ee7b7' }, // emerald
  { bg: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fdba74' }, // orange
];

// Semantic color mapping based on stage labels
function getSemanticColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes('complete') || l.includes('done') || l.includes('approved') || l.includes('success') || l.includes('resolved'))
    return { bg: '#10b981', light: '#d1fae5', text: '#047857', border: '#6ee7b7' };
  if (l.includes('reject') || l.includes('cancel') || l.includes('fail') || l.includes('error') || l.includes('closed'))
    return { bg: '#ef4444', light: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
  if (l.includes('pending') || l.includes('wait') || l.includes('hold') || l.includes('new') || l.includes('open'))
    return { bg: '#f59e0b', light: '#fef3c7', text: '#b45309', border: '#fcd34d' };
  if (l.includes('progress') || l.includes('review') || l.includes('process') || l.includes('active'))
    return { bg: '#3b82f6', light: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' };
  return null;
}

export function LifecycleStatusBar({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  isEditing = false,
  submissionId,
  formId,
  hideHistoryButton = false,
  onOpenHistory
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

  const { handleStageChange: triggerSLATracking } = useSLATracking();

  const options = Array.isArray(field.options) 
    ? field.options 
    : typeof field.options === 'string' 
      ? (() => { try { return JSON.parse(field.options); } catch { return []; } })()
      : [];

  const customConfig = ((field.customConfig as any) || {}) as Record<string, any>;
  const transitionRules = customConfig.transitionRules || {};
  const requireCommentOnChange = customConfig.requireCommentOnChange || false;
  const slaWarningHours = customConfig.slaWarningHours || null;
  const enableSlaTracking = customConfig.enableSlaTracking || false;
  const slaTemplateId = customConfig.slaTemplateId || null;
  const escalationChainId = customConfig.escalationChainId || null;
  const slaTrackedStages = customConfig.slaTrackedStages || [];

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
    if (option && typeof option === 'object') return option.label || option.value || String(option);
    return String(option);
  };

  const getOptionValue = (option: any): string => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') return option.value || option.label || String(option);
    return String(option);
  };

  useEffect(() => {
    const createInitialHistory = async () => {
      if (submissionId && value && !historyLoading && history.length === 0 && user && !initialHistoryCreated.current) {
        initialHistoryCreated.current = true;
        await addHistoryEntry(null, value, 'Initial stage');
        await refetchHistory();
      }
    };
    createInitialHistory();
  }, [submissionId, value, historyLoading, history.length, user, addHistoryEntry, refetchHistory]);

  const sendStageChangeNotification = async (fromStage: string | null, toStage: string) => {
    if (!submissionId) return;
    try {
      const { data: submission, error: subError } = await supabase
        .from('form_submissions')
        .select('submitted_by, form_id, submission_ref_id')
        .eq('id', submissionId)
        .single();
      if (subError || !submission) return;
      if (submission.submitted_by) {
        const recordRef = submission.submission_ref_id || submissionId.slice(0, 8);
        await supabase.from('notifications').insert({
          user_id: submission.submitted_by,
          type: 'lifecycle_stage_change',
          title: 'Record Stage Updated',
          message: `Record ${recordRef} has moved from "${fromStage || 'Initial'}" to "${toStage}" for field "${field.label}".`,
          data: { submissionId, submissionRefId: submission.submission_ref_id, fieldId: field.id, fieldLabel: field.label, fromStage, toStage, changedAt: new Date().toISOString() }
        });
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

  const getStageColor = (option: any, index: number) => {
    // 1. Use configured color from the option
    const configuredColor = typeof option === 'object' && option?.color ? option.color : null;
    if (configuredColor) {
      return { bg: configuredColor, light: configuredColor + '20', text: configuredColor, border: configuredColor + '60' };
    }
    // 2. Try semantic color from label
    const label = getOptionLabel(option);
    const semantic = getSemanticColor(label);
    if (semantic) return semantic;
    // 3. Fallback to palette
    return STAGE_COLORS[index % STAGE_COLORS.length];
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
      toast({ title: "Stage Updated", description: `Changed to "${newStage}"` });
      if (submissionId) {
        const operations: Promise<any>[] = [
          addHistoryEntry(previousStage, newStage, comment || undefined),
          sendStageChangeNotification(previousStage, newStage)
        ];
        if (enableSlaTracking && slaTemplateId && formId) {
          operations.push(triggerSLATracking({
            submissionId, fieldId: field.id, formId, currentStage: newStage,
            config: { enableSlaTracking, slaTemplateId, escalationChainId, slaTrackedStages }
          }));
        }
        Promise.all(operations).then(() => refetchHistory()).catch(err => console.error('Error in stage change operations:', err));
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
  const timeInStage = getTimeInCurrentStage();

  return (
    <TooltipProvider>
      <div className="w-full space-y-1">
        {/* ServiceNow-style Stage Progress Bar - all stages colored */}
        <div className="flex items-stretch w-full rounded-lg overflow-hidden shadow-sm border border-border/40">
          {options.map((option: any, index: number) => {
            const optionValue = getOptionValue(option);
            const optionLabel = getOptionLabel(option);
            const isSelected = value === optionValue;
            const isPast = index < currentIndex;
            const isFuture = index > currentIndex;
            const color = getStageColor(option, index);
            const canTransition = isTransitionAllowed(value, optionValue);
            const isLast = index === options.length - 1;
            const isFirst = index === 0;
            
            return (
              <Tooltip key={optionValue}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleOptionClick(optionValue)}
                    disabled={disabled || !isEditing || isSelected}
                    className={`
                      relative flex items-center justify-center gap-1.5 py-2.5 px-3 flex-1
                      text-xs font-medium transition-all duration-200 min-w-0
                      ${isEditing && !isSelected && canTransition ? 'cursor-pointer hover:brightness-110' : ''}
                      ${!canTransition && isEditing && !isSelected ? 'cursor-not-allowed' : ''}
                      ${isSelected ? 'font-bold text-sm' : ''}
                    `}
                    style={{
                      backgroundColor: isSelected
                        ? color.bg
                        : isPast
                          ? color.bg
                          : color.light,
                      color: isSelected
                        ? '#ffffff'
                        : isPast
                          ? '#ffffff'
                          : color.text,
                      opacity: isFuture ? 0.85 : 1,
                      borderRight: !isLast ? '2px solid rgba(255,255,255,0.4)' : 'none',
                    }}
                  >
                    {/* Status Icon */}
                    <span className="flex-shrink-0">
                      {isPast ? (
                        <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-white/30">
                          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                        </span>
                      ) : isSelected ? (
                        <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-white/30 ring-2 ring-white/50">
                          <ArrowRight className="h-3 w-3 text-white" strokeWidth={3} />
                        </span>
                      ) : (
                        <span
                          className="flex items-center justify-center w-[18px] h-[18px] rounded-full"
                          style={{ backgroundColor: color.bg + '30' }}
                        >
                          <Circle className="h-2.5 w-2.5" style={{ color: color.text }} />
                        </span>
                      )}
                    </span>

                    {/* Label */}
                    <span className="truncate">{optionLabel}</span>

                    {/* Time in current stage */}
                    {isSelected && timeInStage && (
                      <span className="text-[10px] opacity-75 whitespace-nowrap font-normal">
                        {timeInStage}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-center">
                    <p className="font-medium">{optionLabel}</p>
                    {isSelected && <p className="text-xs opacity-70">Current stage</p>}
                    {isPast && <p className="text-xs opacity-70">Completed</p>}
                    {isFuture && <p className="text-xs opacity-70">Upcoming</p>}
                    {!canTransition && isEditing && !isSelected && (
                      <p className="text-xs text-destructive">Transition not allowed</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* History Button - only if not hidden */}
        {!hideHistoryButton && (
          <div className="flex justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onOpenHistory ? onOpenHistory() : setHistoryDialogOpen(true)}
            >
              <History className="h-3 w-3" />
              Stage History
            </Button>
          </div>
        )}
      </div>

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
    </TooltipProvider>
  );
}
