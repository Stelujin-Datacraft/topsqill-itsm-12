import React, { useState } from 'react';
import { CheckCircle, Clock, AlertOctagon, ArrowRight, User, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

export type ApprovalMode = 'any_one' | 'all';

interface Approval {
  id: string;
  approver_id: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approved_at?: string;
  created_at: string;
  version_number: number;
}

interface PolicyApprovalFlowProps {
  approvals: Approval[];
  policyStatus: string;
  approvalMode: ApprovalMode;
  currentUserId?: string;
  getUserName: (id: string) => string;
  onApprove: (approvalId: string, comment: string) => void;
  onReject: (approvalId: string, comment: string) => void;
  isPending?: boolean;
}

export function PolicyApprovalFlow({
  approvals,
  policyStatus,
  approvalMode,
  currentUserId,
  getUserName,
  onApprove,
  onReject,
  isPending = false,
}: PolicyApprovalFlowProps) {
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;
  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const totalCount = approvals.length;

  const getFlowStatus = () => {
    if (rejectedCount > 0) return 'rejected';
    if (approvalMode === 'any_one' && approvedCount >= 1) return 'approved';
    if (approvalMode === 'all' && approvedCount === totalCount && totalCount > 0) return 'approved';
    return 'in_progress';
  };

  const flowStatus = getFlowStatus();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'rejected': return <AlertOctagon className="h-5 w-5 text-destructive" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30';
      case 'rejected': return 'border-destructive bg-red-50 dark:bg-red-950/30';
      default: return 'border-amber-400 bg-amber-50 dark:bg-amber-950/30';
    }
  };

  const getConnectorColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-400';
      case 'rejected': return 'bg-destructive';
      default: return 'bg-muted-foreground/30';
    }
  };

  if (approvals.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No approval flow configured yet</p>
        <p className="text-xs text-muted-foreground mt-1">Submit this policy for approval to start the flow</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Flow Summary Header */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {flowStatus === 'approved' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
            {flowStatus === 'rejected' && <AlertOctagon className="h-5 w-5 text-destructive" />}
            {flowStatus === 'in_progress' && <Clock className="h-5 w-5 text-amber-500" />}
            <span className="text-sm font-semibold capitalize">
              {flowStatus === 'in_progress' ? 'In Progress' : flowStatus}
            </span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {approvalMode === 'any_one' ? 'Any One Approves' : 'All Must Approve'}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {approvedCount} approved
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
            {rejectedCount} rejected
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            {pendingCount} pending
          </span>
        </div>
      </div>

      {/* Visual Flow */}
      <div className="relative">
        {/* Start Node */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Submitted for Approval</p>
            <p className="text-xs text-muted-foreground">
              {approvals.length > 0 && format(new Date(approvals[0].created_at), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
        </div>

        {/* Connector line from start */}
        <div className="ml-[19px] w-0.5 h-4 bg-muted-foreground/30" />

        {/* Approver Nodes */}
        <TooltipProvider>
          <div className="space-y-0">
            {approvals.map((approval, index) => {
              const isCurrentUser = approval.approver_id === currentUserId;
              const canAct = isCurrentUser && approval.status === 'pending' && policyStatus === 'pending_approval';
              const isExpanded = expandedId === approval.id;

              return (
                <div key={approval.id}>
                  {/* Connector */}
                  {index > 0 && (
                    <div className={`ml-[19px] w-0.5 h-3 ${getConnectorColor(approvals[index - 1].status)}`} />
                  )}

                  {/* Node */}
                  <div
                    className={`border-l-[3px] rounded-r-lg p-3 ml-3 cursor-pointer transition-all ${getStatusColor(approval.status)} ${canAct ? 'ring-1 ring-primary/30' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {getStatusIcon(approval.status)}
                        <div>
                          <p className="text-sm font-medium">{getUserName(approval.approver_id)}</p>
                          <p className="text-xs text-muted-foreground capitalize">{approval.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canAct && (
                          <Badge className="text-[10px] bg-primary text-primary-foreground">Action Required</Badge>
                        )}
                        {approval.approved_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(approval.approved_at), 'MMM d, HH:mm')}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                        {approval.comments && (
                          <div className="text-xs bg-background/60 rounded p-2 italic">
                            "{approval.comments}"
                          </div>
                        )}

                        {/* Action area for current user */}
                        {canAct && (
                          <div className="space-y-2" onClick={e => e.stopPropagation()}>
                            <Textarea
                              placeholder="Add your comment (required for rejection)..."
                              value={commentMap[approval.id] || ''}
                              onChange={e => setCommentMap(prev => ({ ...prev, [approval.id]: e.target.value }))}
                              className="text-sm min-h-[60px] bg-background"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => onApprove(approval.id, commentMap[approval.id] || '')}
                                disabled={isPending}
                                className="flex-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => onReject(approval.id, commentMap[approval.id] || '')}
                                disabled={isPending || !(commentMap[approval.id] || '').trim()}
                                className="flex-1"
                              >
                                <AlertOctagon className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Connector after last node */}
                  {index === approvals.length - 1 && (
                    <div className={`ml-[19px] w-0.5 h-4 ${getConnectorColor(approval.status)}`} />
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>

        {/* End Node */}
        <div className="flex items-center gap-3 mt-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            flowStatus === 'approved' ? 'bg-emerald-500' : flowStatus === 'rejected' ? 'bg-destructive' : 'bg-muted'
          }`}>
            {flowStatus === 'approved' ? (
              <CheckCircle className="h-4 w-4 text-white" />
            ) : flowStatus === 'rejected' ? (
              <AlertOctagon className="h-4 w-4 text-white" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {flowStatus === 'approved' ? 'Ready to Publish' : flowStatus === 'rejected' ? 'Rejected — Returned to Draft' : 'Awaiting Approvals'}
            </p>
            <p className="text-xs text-muted-foreground">
              {approvalMode === 'any_one'
                ? 'One approval is sufficient to proceed'
                : `All ${totalCount} approver(s) must approve`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
