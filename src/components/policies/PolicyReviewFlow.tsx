import React, { useState } from 'react';
import { CheckCircle, Clock, AlertOctagon, User, Users, ChevronDown, ChevronUp, CalendarClock, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import type { PolicyReviewCycle } from '@/types/policy';

interface PolicyReviewFlowProps {
  reviewCycles: PolicyReviewCycle[];
  policyStatus: string;
  currentUserId?: string;
  getUserName: (id: string) => string;
  onCompleteReview: (cycleId: string, findings: string, outcome: string) => void;
  isPending?: boolean;
}

export function PolicyReviewFlow({
  reviewCycles,
  policyStatus,
  currentUserId,
  getUserName,
  onCompleteReview,
  isPending = false,
}: PolicyReviewFlowProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [findingsMap, setFindingsMap] = useState<Record<string, string>>({});
  const [outcomeMap, setOutcomeMap] = useState<Record<string, string>>({});

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'overdue': return <AlertOctagon className="h-5 w-5 text-destructive" />;
      case 'in_progress': return <RotateCcw className="h-5 w-5 text-blue-500" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30';
      case 'overdue': return 'border-destructive bg-red-50 dark:bg-red-950/30';
      case 'in_progress': return 'border-blue-500 bg-blue-50 dark:bg-blue-950/30';
      default: return 'border-amber-400 bg-amber-50 dark:bg-amber-950/30';
    }
  };

  const getConnectorColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-400';
      case 'overdue': return 'bg-destructive';
      default: return 'bg-muted-foreground/30';
    }
  };

  // Auto-detect overdue cycles
  const processedCycles = reviewCycles.map(c => ({
    ...c,
    status: (c.status === 'scheduled' && isPast(new Date(c.review_date))) ? 'overdue' : c.status,
  }));

  const overdueCount = processedCycles.filter(c => c.status === 'overdue').length;
  const completedCount = processedCycles.filter(c => c.status === 'completed').length;
  const scheduledCount = processedCycles.filter(c => c.status === 'scheduled').length;
  const inProgressCount = processedCycles.filter(c => c.status === 'in_progress').length;

  if (reviewCycles.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No review cycles configured</p>
        <p className="text-xs text-muted-foreground mt-1">Review cycles are created when a policy is published</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Review Cycles</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {completedCount} completed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
            {overdueCount} overdue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            {inProgressCount} in progress
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            {scheduledCount} scheduled
          </span>
        </div>
      </div>

      {/* Visual Flow */}
      <TooltipProvider>
        <div className="relative">
          {processedCycles.map((cycle, index) => {
            const isExpanded = expandedId === cycle.id;
            const canAct = cycle.status !== 'completed';

            return (
              <div key={cycle.id}>
                {/* Connector */}
                {index > 0 && (
                  <div className={`ml-[19px] w-0.5 h-3 ${getConnectorColor(processedCycles[index - 1].status)}`} />
                )}

                {/* Node */}
                <div
                  className={`border-l-[3px] rounded-r-lg p-3 ml-3 cursor-pointer transition-all ${getStatusColor(cycle.status)}`}
                  onClick={() => setExpandedId(isExpanded ? null : cycle.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {getStatusIcon(cycle.status)}
                      <div>
                        <p className="text-sm font-medium">
                          Review — {format(new Date(cycle.review_date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {cycle.status}
                          {cycle.status === 'overdue' && (
                            <span className="text-destructive font-medium ml-1">
                              ({formatDistanceToNow(new Date(cycle.review_date), { addSuffix: false })} overdue)
                            </span>
                          )}
                          {cycle.status === 'scheduled' && !isPast(new Date(cycle.review_date)) && (
                            <span className="ml-1">
                              (in {formatDistanceToNow(new Date(cycle.review_date))})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cycle.reviewer_id && (
                        <span className="text-[10px] text-muted-foreground">
                          Reviewer: {getUserName(cycle.reviewer_id)}
                        </span>
                      )}
                      {cycle.outcome && (
                        <Badge variant="outline" className="text-[10px] capitalize">{cycle.outcome?.replace('_', ' ')}</Badge>
                      )}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                      {cycle.findings && (
                        <div className="text-xs bg-background/60 rounded p-2">
                          <span className="font-medium">Findings:</span> {cycle.findings}
                        </div>
                      )}

                      {cycle.completed_at && (
                        <p className="text-xs text-muted-foreground">
                          Completed: {format(new Date(cycle.completed_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      )}

                      {/* Action area */}
                      {canAct && (
                        <div className="space-y-2" onClick={e => e.stopPropagation()}>
                          <Textarea
                            placeholder="Enter review findings..."
                            value={findingsMap[cycle.id] || ''}
                            onChange={e => setFindingsMap(prev => ({ ...prev, [cycle.id]: e.target.value }))}
                            className="text-sm min-h-[60px] bg-background"
                            rows={2}
                          />
                          <div className="flex items-center gap-2">
                            <Select
                              value={outcomeMap[cycle.id] || ''}
                              onValueChange={v => setOutcomeMap(prev => ({ ...prev, [cycle.id]: v }))}
                            >
                              <SelectTrigger className="flex-1 h-9 text-sm">
                                <SelectValue placeholder="Select outcome..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no_change">No Change Needed</SelectItem>
                                <SelectItem value="minor_update">Minor Update</SelectItem>
                                <SelectItem value="major_revision">Major Revision Required</SelectItem>
                                <SelectItem value="retire">Recommend Retirement</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => onCompleteReview(
                                cycle.id,
                                findingsMap[cycle.id] || '',
                                outcomeMap[cycle.id] || 'no_change'
                              )}
                              disabled={isPending || !outcomeMap[cycle.id]}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Complete Review
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
