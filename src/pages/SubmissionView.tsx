
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SubmissionFormView } from '@/components/SubmissionFormView';
import DashboardLayout from '@/components/DashboardLayout';

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
    <DashboardLayout 
      title="Submission Details"
      actions={
        <button 
          onClick={handleBack}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Back to Submissions
        </button>
      }
    >
      <div className="max-w-7xl mx-auto">
        <SubmissionFormView 
          submissionId={submissionId} 
          onBack={handleBack}
        />
      </div>
    </DashboardLayout>
  );
};

export default SubmissionView;
