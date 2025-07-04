
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SubmissionFormView } from '@/components/SubmissionFormView';

const SubmissionView = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  if (!submissionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Invalid Submission</h2>
          <p className="text-muted-foreground mb-4">No submission ID provided.</p>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/my-submissions');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <SubmissionFormView 
          submissionId={submissionId} 
          onBack={handleBack}
        />
      </div>
    </div>
  );
};

export default SubmissionView;
