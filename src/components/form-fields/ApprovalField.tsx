import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ApprovalFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function ApprovalField({ field, value, onChange, error, disabled }: ApprovalFieldProps) {
  const [comments, setComments] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const config = (field.customConfig as any) || {};

  const approvalStatus = value?.status || 'pending';
  const approvalComments = value?.comments || '';
  const approvedBy = value?.approvedBy || '';
  const approvedAt = value?.approvedAt || '';

  const handleApproval = async (approved: boolean) => {
    if (!onChange || disabled || isProcessing) return;

    if (config.requireComments && !comments.trim()) {
      toast({
        title: "Comments required",
        description: "Please provide comments for this approval.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const approvalData = {
        status: approved ? 'approved' : 'rejected',
        comments: comments.trim(),
        approvedBy: user?.email || 'Unknown',
        approvedAt: new Date().toISOString(),
        timestamp: Date.now(),
      };

      onChange(approvalData);

      if (config.enableNotifications !== false) {
        // In a real implementation, trigger notification
        console.log('Sending approval notification:', approvalData);
      }

      toast({
        title: approved ? "Approved" : "Rejected",
        description: `Form has been ${approved ? 'approved' : 'rejected'} successfully.`,
      });

      setComments('');
    } catch (error) {
      console.error('Approval error:', error);
      toast({
        title: "Error",
        description: "Failed to process approval. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    switch (approvalStatus) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = () => {
    switch (approvalStatus) {
      case 'approved':
        return 'bg-green-50 border-green-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  if (approvalStatus !== 'pending') {
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        <div className={`p-4 border rounded-lg ${getStatusColor()}`}>
          <div className="flex items-center space-x-2 mb-2">
            {getStatusIcon()}
            <span className="font-medium capitalize">{approvalStatus}</span>
          </div>
          
          {approvedBy && (
            <p className="text-sm text-gray-600">
              By: {approvedBy}
            </p>
          )}
          
          {approvedAt && (
            <p className="text-sm text-gray-600">
              On: {new Date(approvedAt).toLocaleString()}
            </p>
          )}
          
          {approvalComments && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">Comments:</p>
              <p className="text-sm text-gray-600">{approvalComments}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label>{field.label}</Label>
      
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-yellow-600" />
          <span className="font-medium">Pending Approval</span>
        </div>

        {config.targetFormId && (
          <p className="text-sm text-gray-600">
            Target Form: {config.targetFormName || config.targetFormId}
          </p>
        )}

        {config.requireComments && (
          <div className="space-y-2">
            <Label htmlFor="approval-comments">Comments *</Label>
            <Textarea
              id="approval-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter your approval comments..."
              disabled={disabled || isProcessing}
              rows={3}
            />
          </div>
        )}

        <div className="flex space-x-3">
          <Button
            onClick={() => handleApproval(true)}
            disabled={disabled || isProcessing}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            <span>{isProcessing ? 'Processing...' : 'Approve'}</span>
          </Button>
          
          <Button
            onClick={() => handleApproval(false)}
            disabled={disabled || isProcessing}
            variant="destructive"
            className="flex items-center space-x-2"
          >
            <XCircle className="h-4 w-4" />
            <span>{isProcessing ? 'Processing...' : 'Reject'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}