import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Send, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { FormField } from '@/types/form';

interface FieldComment {
  id: string;
  fieldId: string;
  fieldLabel: string;
  comment: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

interface SubmissionCommentBoxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  formFields: FormField[];
  formData: Record<string, any>;
}

export function SubmissionCommentBox({ open, onOpenChange, submissionId, formFields, formData }: SubmissionCommentBoxProps) {
  const { user, userProfile } = useAuth();
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<FieldComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load comments from submission metadata
  useEffect(() => {
    if (open && submissionId) {
      loadComments();
    }
  }, [open, submissionId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('submission_data')
        .eq('id', submissionId)
        .single();

      if (error) throw error;

      const submissionData = data?.submission_data as Record<string, any>;
      const savedComments = submissionData?.__field_comments || [];
      setComments(savedComments);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedFieldId || !comment.trim()) {
      toast({ title: 'Error', description: 'Please select a field and enter a comment.', variant: 'destructive' });
      return;
    }

    const selectedField = formFields.find(f => f.id === selectedFieldId);
    if (!selectedField) return;

    setSaving(true);
    try {
      const newComment: FieldComment = {
        id: crypto.randomUUID(),
        fieldId: selectedFieldId,
        fieldLabel: selectedField.label,
        comment: comment.trim(),
        userId: user?.id || '',
        userName: [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || userProfile?.email || 'Unknown',
        userEmail: userProfile?.email || '',
        createdAt: new Date().toISOString(),
      };

      const updatedComments = [...comments, newComment];

      // Save to submission_data.__field_comments
      const { data: current, error: fetchError } = await supabase
        .from('form_submissions')
        .select('submission_data')
        .eq('id', submissionId)
        .single();

      if (fetchError) throw fetchError;

      const currentData = (current?.submission_data || {}) as Record<string, any>;
      const updatedData = {
        ...currentData,
        __field_comments: updatedComments,
      } as any;

      const { error: updateError } = await supabase
        .from('form_submissions')
        .update({ submission_data: updatedData })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      setComments(updatedComments);
      setComment('');
      setSelectedFieldId('');
      toast({ title: 'Comment Added', description: `Comment added to "${selectedField.label}".` });
    } catch (err: any) {
      console.error('Error saving comment:', err);
      toast({ title: 'Error', description: 'Failed to save comment.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const updatedComments = comments.filter(c => c.id !== commentId);

      const { data: current, error: fetchError } = await supabase
        .from('form_submissions')
        .select('submission_data')
        .eq('id', submissionId)
        .single();

      if (fetchError) throw fetchError;

      const currentData = (current?.submission_data || {}) as Record<string, any>;
      const updatedData = {
        ...currentData,
        __field_comments: updatedComments,
      } as any;

      const { error: updateError } = await supabase
        .from('form_submissions')
        .update({ submission_data: updatedData })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      setComments(updatedComments);
      toast({ title: 'Comment Deleted' });
    } catch (err: any) {
      console.error('Error deleting comment:', err);
      toast({ title: 'Error', description: 'Failed to delete comment.', variant: 'destructive' });
    }
  };

  // Filter to meaningful field types
  const commentableFields = formFields.filter(f =>
    !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.type)
  );

  const getFieldValue = (fieldId: string) => {
    const val = formData[fieldId];
    if (val === undefined || val === null || val === '') return 'N/A';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // Group comments by field
  const groupedComments = comments.reduce((acc, c) => {
    if (!acc[c.fieldId]) acc[c.fieldId] = [];
    acc[c.fieldId].push(c);
    return acc;
  }, {} as Record<string, FieldComment[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Field Comments
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Add Comment Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-sm font-medium">Add a Comment</Label>
            <div className="grid grid-cols-1 gap-3">
              <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a field..." />
                </SelectTrigger>
                <SelectContent>
                  {commentableFields.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex items-center gap-2">
                        <span>{f.label}</span>
                        <span className="text-[10px] text-muted-foreground">({f.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFieldId && (
                <div className="text-xs text-muted-foreground p-2 bg-background border rounded">
                  <span className="font-medium">Current Value:</span> {getFieldValue(selectedFieldId)}
                </div>
              )}
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Type your comment..."
                rows={2}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={saving || !selectedFieldId || !comment.trim()}
                className="w-fit"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {saving ? 'Saving...' : 'Add Comment'}
              </Button>
            </div>
          </div>

          {/* Comments List */}
          <ScrollArea className="flex-1 max-h-[400px]">
            {loading ? (
              <div className="text-center text-muted-foreground py-6 text-sm">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-sm">
                No comments yet. Select a field and add your first comment.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedComments).map(([fieldId, fieldComments]) => {
                  const field = formFields.find(f => f.id === fieldId);
                  return (
                    <div key={fieldId} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-medium">
                          {field?.label || fieldId}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Value: {getFieldValue(fieldId)}
                        </span>
                      </div>
                      {fieldComments.map(c => (
                        <div key={c.id} className="ml-4 p-3 border rounded-md bg-background space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="font-medium text-foreground">{c.userName}</span>
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              <span>{new Date(c.createdAt).toLocaleString()}</span>
                            </div>
                            {c.userId === user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleDeleteComment(c.id)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                          <p className="text-sm">{c.comment}</p>
                        </div>
                      ))}
                      <Separator className="mt-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
