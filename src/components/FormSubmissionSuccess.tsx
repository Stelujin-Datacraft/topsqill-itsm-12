
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Eye, ArrowLeft, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SubmissionRefDisplay } from '@/components/SubmissionRefDisplay';

interface FormSubmissionSuccessProps {
  submissionRefId?: string;
  submissionId?: string;
  formName: string;
  formId?: string;
  formReferenceId?: string;
  onClose?: () => void;
}

export function FormSubmissionSuccess({ 
  submissionRefId, 
  submissionId,
  formName,
  formId,
  formReferenceId,
  onClose 
}: FormSubmissionSuccessProps) {
  const navigate = useNavigate();

  const handleViewSubmission = () => {
    if (submissionId) {
      navigate(`/submission/${submissionId}`);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="py-12 text-center">
        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-green-600 mb-2">Form Submitted Successfully!</h2>
        
        <p className="text-muted-foreground mb-4">
          Thank you for submitting "{formName}". Your submission has been recorded.
        </p>

        {submissionRefId && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-2">Your submission reference:</p>
            <div className="flex justify-center">
              <SubmissionRefDisplay
                submissionRefId={submissionRefId}
                submissionId={submissionId}
                formReferenceId={formReferenceId}
                formName={formName}
                variant="badge"
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {submissionId && (
            <Button onClick={handleViewSubmission} className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              View This Submission
            </Button>
          )}
          
          {formId && (
            <Link to={`/form-submissions?formId=${formId}`}>
              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                View All Records
              </Button>
            </Link>
          )}
          
          <Link to="/my-submissions">
            <Button variant="outline" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              View All My Submissions
            </Button>
          </Link>
          
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Form
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
