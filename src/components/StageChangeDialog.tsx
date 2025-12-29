import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowRight, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StageChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  fromStage: string;
  toStage: string;
  requireComment?: boolean;
  transitionBlocked?: boolean;
  blockReason?: string;
}

export function StageChangeDialog({
  open,
  onClose,
  onConfirm,
  fromStage,
  toStage,
  requireComment = false,
  transitionBlocked = false,
  blockReason
}: StageChangeDialogProps) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (requireComment && !comment.trim()) {
      setError('A comment is required for this stage change');
      return;
    }
    onConfirm(comment);
    setComment('');
    setError('');
  };

  const handleClose = () => {
    setComment('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Stage</DialogTitle>
          <DialogDescription>
            You are about to change the stage from "{fromStage}" to "{toStage}".
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-4 py-4">
          <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
            {fromStage || 'Not Set'}
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
            {toStage}
          </div>
        </div>

        {transitionBlocked && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {blockReason || 'This transition is not allowed.'}
            </AlertDescription>
          </Alert>
        )}

        {!transitionBlocked && (
          <div className="space-y-2">
            <Label htmlFor="comment">
              Comment {requireComment && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="comment"
              placeholder="Add a note about this stage change..."
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (error) setError('');
              }}
              rows={3}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
          {!transitionBlocked && (
            <Button onClick={handleConfirm}>
              Confirm Change
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
