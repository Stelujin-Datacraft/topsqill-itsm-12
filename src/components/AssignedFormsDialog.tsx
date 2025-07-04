
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useFormAssignments } from '@/hooks/useFormAssignments';
import { FileText, User, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function AssignedFormsDialog() {
  const [open, setOpen] = useState(false);
  const { assignments, loading, updateAssignmentStatus } = useFormAssignments();
  const navigate = useNavigate();
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleFormClick = (formId: string) => {
    // Open form in new tab
    window.open(`/form/${formId}`, '_blank');
  };

  const handleStatusUpdate = async (assignmentId: string, newStatus: string) => {
    try {
      await updateAssignmentStatus(assignmentId, newStatus);
      toast({
        title: "Status Updated",
        description: `Assignment status updated to ${newStatus.replace('_', ' ')}`,
      });
    } catch (error) {
      console.error('Error updating assignment status:', error);
      toast({
        title: "Error",
        description: "Failed to update assignment status",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Assigned Forms
          {assignments.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {assignments.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Forms Assigned to You</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <div>Loading assignments...</div>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No forms assigned</h3>
            <p>No forms have been assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        {assignment.forms?.name || 'Unknown Form'}
                      </CardTitle>
                      {assignment.forms?.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {assignment.forms.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(assignment.status)}>
                        {assignment.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleFormClick(assignment.form_id)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Form
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>
                        Assigned by: {assignment.user_profiles 
                          ? `${assignment.user_profiles.first_name || ''} ${assignment.user_profiles.last_name || ''}`.trim() || assignment.user_profiles.email
                          : 'System'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>
                        Assigned {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {assignment.due_date && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>
                          Due: {formatDistanceToNow(new Date(assignment.due_date), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="text-muted-foreground">Type: </span>
                      <Badge variant="outline" className="ml-2">
                        {assignment.assignment_type}
                      </Badge>
                    </div>
                  </div>
                  
                  {assignment.notes && (
                    <>
                      <Separator className="my-3" />
                      <div>
                        <p className="text-sm font-medium mb-1">Notes:</p>
                        <p className="text-sm text-muted-foreground">{assignment.notes}</p>
                      </div>
                    </>
                  )}
                  
                  {assignment.status === 'pending' && (
                    <div className="flex space-x-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(assignment.id, 'in_progress')}
                      >
                        Start Working
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(assignment.id, 'completed')}
                      >
                        Mark Complete
                      </Button>
                    </div>
                  )}
                  
                  {assignment.status === 'in_progress' && (
                    <div className="flex space-x-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(assignment.id, 'completed')}
                      >
                        Mark Complete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
