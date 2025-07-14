import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ApprovalFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
  formData?: Record<string, any>;
  allFields?: FormField[];
}

export function ApprovalField({ field, value, onChange, error, disabled, formData, allFields }: ApprovalFieldProps) {
  const [comments, setComments] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [crossReferenceSelections, setCrossReferenceSelections] = useState<any[]>([]);
  const { user } = useAuth();
  const config = (field.customConfig as any) || {};

  const approvalStatus = value?.status || 'pending';
  const approvalComments = value?.comments || '';
  const approvedBy = value?.approvedBy || '';
  const approvedAt = value?.approvedAt || '';

  // Get cross-reference field data if configured
  useEffect(() => {
    if (!config.approveCurrentSubmission && config.crossReferenceFieldId && formData) {
      const crossRefFieldData = formData[config.crossReferenceFieldId];
      if (Array.isArray(crossRefFieldData)) {
        setCrossReferenceSelections(crossRefFieldData);
      }
    }
  }, [config, formData]);

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

      // If approving current submission
      if (config.approveCurrentSubmission !== false) {
        onChange(approvalData);
        
        toast({
          title: approved ? "Approved" : "Rejected",
          description: `Current submission has been ${approved ? 'approved' : 'rejected'}.`,
        });
      } else {
        // If approving cross-reference selections
        if (crossReferenceSelections.length === 0) {
          toast({
            title: "No selections",
            description: "No submissions selected in the cross-reference field to approve.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        // Approve selected submissions
        const approvalPromises = crossReferenceSelections.map(async (selection) => {
          const submissionId = selection.id;
          
          // Use user ID if available, otherwise store as null and use email in notes
          const updateData: any = {
            approval_status: approved ? 'approved' : 'rejected',
            approval_timestamp: new Date().toISOString(),
            approval_notes: comments.trim()
          };

          // Only set approved_by if we have a valid user ID
          if (user?.id) {
            updateData.approved_by = user.id;
          } else {
            // Store email in notes if no user ID available
            updateData.approval_notes = `${comments.trim()} (Approved by: ${user?.email || 'Unknown'})`;
          }

          const { error } = await supabase
            .from('form_submissions')
            .update(updateData)
            .eq('id', submissionId);

          if (error) {
            console.error('Error updating submission approval:', error);
            throw error;
          }
        });

        await Promise.all(approvalPromises);

        onChange(approvalData);

        toast({
          title: approved ? "Approved" : "Rejected",
          description: `${crossReferenceSelections.length} submission(s) have been ${approved ? 'approved' : 'rejected'}.`,
        });
      }

      if (config.sendNotifications !== false) {
        console.log('Sending approval notification:', approvalData);
      }

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

  // Get cross-reference field info for display
  const crossReferenceField = allFields?.find(f => f.id === config.crossReferenceFieldId);

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

        <div className="text-sm text-gray-600 space-y-1">
          {config.approveCurrentSubmission !== false ? (
            <p>Target: Current Submission</p>
          ) : (
            <>
              <p>Target: Cross-Reference Selections</p>
              {crossReferenceField && (
                <p>Field: {crossReferenceField.label}</p>
              )}
              {crossReferenceSelections.length > 0 ? (
                <p>Selected: {crossReferenceSelections.length} submission(s)</p>
              ) : (
                <p className="text-orange-600">No submissions selected in cross-reference field</p>
              )}
            </>
          )}
        </div>

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
            disabled={disabled || isProcessing || (config.approveCurrentSubmission === false && crossReferenceSelections.length === 0)}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            <span>{isProcessing ? 'Processing...' : 'Approve'}</span>
          </Button>
          
          <Button
            onClick={() => handleApproval(false)}
            disabled={disabled || isProcessing || (config.approveCurrentSubmission === false && crossReferenceSelections.length === 0)}
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
