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
import { Separator } from '@/components/ui/separator';

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
      // Get submission details to find the submitter
      const { data: submission, error: subError } = await supabase
        .from('form_submissions')
        .select('submitted_by, form_id')
        .eq('id', submissionId)
        .single();
      
      if (subError || !submission) {
        console.error('Error fetching submission:', subError);
        return;
      }

      // Get submitter's email
      if (submission.submitted_by) {
        const { data: submitterProfile } = await supabase
          .from('user_profiles')
          .select('email, first_name')
          .eq('id', submission.submitted_by)
          .single();

        if (submitterProfile?.email) {
          // Create in-app notification
          await supabase
            .from('notifications')
            .insert({
              user_id: submission.submitted_by,
              type: 'lifecycle_stage_change',
              title: 'Record Stage Updated',
              message: `Your submission has moved from "${fromStage || 'Initial'}" to "${toStage}" for field "${field.label}".`,
              data: {
                submissionId,
                fieldId: field.id,
                fieldLabel: field.label,
                fromStage,
                toStage,
                changedAt: new Date().toISOString()
              }
            });

          // Try to send email notification
          try {
            const { error: emailError } = await supabase.functions.invoke('send-template-email', {
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
                      <p style="margin: 10px 0 0;"><strong>Changed At:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <p style="color: #666; font-size: 12px;">This is an automated notification. Please do not reply to this email.</p>
                  </div>
                `
              }
            });

            if (!emailError) {
              console.log('Stage change email sent successfully');
            }
          } catch (emailErr) {
            console.log('Email notification skipped (no email service configured):', emailErr);
          }
        }
      }
    } catch (err) {
      console.error('Error sending stage change notification:', err);
    }
  };

  // Check if transition is allowed
  const isTransitionAllowed = (fromStage: string, toStage: string): boolean => {
    if (!transitionRules || Object.keys(transitionRules).length === 0) return true;
    const allowedTransitions = transitionRules[fromStage];
    if (!allowedTransitions) return true;
    return allowedTransitions.includes(toStage);
  };

  // Check if SLA is exceeded
  const isSLAExceeded = (): boolean => {
    if (!slaWarningHours || !lastChange) return false;
    const lastChangeDate = new Date(lastChange.changed_at);
    const diffHours = (currentTime.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= slaWarningHours;
  };

  // Get time remaining before SLA warning
  const getTimeToSLAWarning = (): string | null => {
    if (!slaWarningHours || !lastChange) return null;
    const lastChangeDate = new Date(lastChange.changed_at);
    const warningDate = new Date(lastChangeDate.getTime() + (slaWarningHours * 60 * 60 * 1000));
    
    if (currentTime >= warningDate) return 'Exceeded';
    
    const diffMs = warningDate.getTime() - currentTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  // Calculate time in current stage dynamically
  const calculateTimeInStage = (): string | null => {
    if (!lastChange) return null;
    
    const lastChangeDate = new Date(lastChange.changed_at);
    const diffMs = currentTime.getTime() - lastChangeDate.getTime();
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Get color based on option label
  const getStageStyles = (optionLabel: string, index: number, isSelected: boolean, isPast: boolean) => {
    const label = optionLabel.toLowerCase();
    
    let baseColor = 'slate';
    if (label.includes('complete') || label.includes('done') || label.includes('approved') || label.includes('success')) {
      baseColor = 'emerald';
    } else if (label.includes('reject') || label.includes('cancel') || label.includes('fail') || label.includes('error')) {
      baseColor = 'red';
    } else if (label.includes('pending') || label.includes('wait') || label.includes('hold') || label.includes('new')) {
      baseColor = 'amber';
    } else if (label.includes('progress') || label.includes('review') || label.includes('process') || label.includes('active')) {
      baseColor = 'blue';
    } else {
      const colors = ['slate', 'indigo', 'purple', 'teal', 'pink'];
      baseColor = colors[index % colors.length];
    }

    if (isSelected) {
      return `bg-${baseColor}-600 text-white border-${baseColor}-500 shadow-md`;
    } else if (isPast) {
      return `bg-${baseColor}-100 dark:bg-${baseColor}-900/30 text-${baseColor}-700 dark:text-${baseColor}-300 border-${baseColor}-300 dark:border-${baseColor}-700`;
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  const handleOptionClick = (optionValue: string, optionLabel: string) => {
    if (!disabled && isEditing && onChange && optionValue !== value) {
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
        
        // Send email notification
        await sendStageChangeEmail(previousStage, newStage);
        
        toast({
          title: "Stage Updated",
          description: `Changed from "${previousStage || 'Initial'}" to "${newStage}"`,
        });
      }
    }
  };

  const handleDialogConfirm = async (comment: string) => {
    if (pendingStage) {
      await handleStageChange(pendingStage, comment);
    }
    setDialogOpen(false);
    setPendingStage(null);
  };

  const currentIndex = options.findIndex((o: any) => getOptionValue(o) === value);
  const timeInStage = calculateTimeInStage();
  const slaExceeded = isSLAExceeded();
  const slaTimeRemaining = getTimeToSLAWarning();
  
  const pendingStageLabel = pendingStage 
    ? getOptionLabel(options.find((o: any) => getOptionValue(o) === pendingStage) || pendingStage)
    : '';
  const currentStageLabel = value 
    ? getOptionLabel(options.find((o: any) => getOptionValue(o) === value) || value)
    : '';

  // Progress percentage
  const progressPercent = options.length > 0 ? ((currentIndex + 1) / options.length) * 100 : 0;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Main Status Bar Container */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          {/* Progress bar */}
          <div className="relative h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stage buttons */}
          <div className="flex items-center justify-between gap-1">
            {options.map((option: any, index: number) => {
              const optionValue = getOptionValue(option);
              const optionLabel = getOptionLabel(option);
              const isSelected = value === optionValue;
              const isPast = index < currentIndex;
              const canTransition = isTransitionAllowed(value, optionValue);
              
              return (
                <React.Fragment key={optionValue}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleOptionClick(optionValue, optionLabel)}
                        disabled={disabled || !isEditing || isSelected}
                        className={`
                          flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-all
                          ${isSelected 
                            ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105' 
                            : isPast 
                              ? 'bg-primary/10 text-primary border-primary/30' 
                              : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border'
                          }
                          ${!canTransition && isEditing && !isSelected ? 'opacity-40 cursor-not-allowed' : ''}
                          ${disabled || !isEditing || isSelected ? '' : 'cursor-pointer hover:shadow-md'}
                        `}
                      >
                        {/* Stage icon */}
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                          ${isSelected 
                            ? 'bg-primary-foreground text-primary border-primary-foreground' 
                            : isPast 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-background text-muted-foreground border-muted-foreground/30'
                          }
                        `}>
                          {isPast ? (
                            <Check className="h-4 w-4" />
                          ) : isSelected ? (
                            <Circle className="h-4 w-4 fill-current" />
                          ) : (
                            <span className="text-xs font-medium">{index + 1}</span>
                          )}
                        </div>
                        
                        {/* Stage label */}
                        <span className={`text-xs font-medium text-center leading-tight ${isSelected ? 'font-semibold' : ''}`}>
                          {optionLabel}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{optionLabel}</p>
                      {!canTransition && isEditing && !isSelected && (
                        <p className="text-xs text-destructive mt-1">Transition not allowed from current stage</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Connector */}
                  {index < options.length - 1 && (
                    <div className={`w-4 h-0.5 ${index < currentIndex ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Time in current stage */}
          {timeInStage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 font-medium
                    ${slaExceeded 
                      ? 'bg-destructive/10 text-destructive border-destructive/30' 
                      : 'bg-muted'
                    }
                  `}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>In stage: {timeInStage}</span>
                  {slaExceeded && <AlertTriangle className="h-3.5 w-3.5 ml-1" />}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">Time in current stage</p>
                  <p className="text-muted-foreground">{timeInStage}</p>
                  {slaWarningHours && (
                    <p className={slaExceeded ? 'text-destructive' : 'text-amber-500'}>
                      SLA: {slaTimeRemaining}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* SLA Warning Badge */}
          {slaExceeded && (
            <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1.5 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" />
              SLA Exceeded
            </Badge>
          )}

          {/* History popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <History className="h-3.5 w-3.5" />
                History
                {history.length > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                    {history.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="start">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Stage Change History
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {history.length} changes
                  </Badge>
                </div>
                
                <Separator />
                
                {historyLoading ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Loading history...
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-8 text-center">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No stage changes recorded yet
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-3 pr-4">
                      {history.map((entry, idx) => (
                        <div 
                          key={entry.id} 
                          className="relative pl-6 pb-3 last:pb-0"
                        >
                          {/* Timeline line */}
                          {idx < history.length - 1 && (
                            <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-border" />
                          )}
                          
                          {/* Timeline dot */}
                          <div className="absolute left-0 top-1.5 h-5 w-5 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                          
                          {/* Content */}
                          <div className="space-y-1.5">
                            {/* Stage transition */}
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span className="text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {entry.from_stage || 'Initial'}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {entry.to_stage}
                              </span>
                            </div>
                            
                            {/* Timestamp */}
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {new Date(entry.changed_at).toLocaleString()}
                            </div>
                            
                            {/* Duration in previous stage */}
                            {entry.duration_in_previous_stage && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <span className="font-medium">Duration in previous:</span> 
                                {entry.duration_in_previous_stage}
                              </div>
                            )}
                            
                            {/* Comment */}
                            {entry.comment && (
                              <div className="text-xs bg-muted/50 rounded-md px-3 py-2 mt-2 italic text-muted-foreground border-l-2 border-primary/30">
                                "{entry.comment}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Email notification indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="text-xs">Auto-notify</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Email notifications are sent to the submitter when the stage changes</p>
            </TooltipContent>
          </Tooltip>
        </div>

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
