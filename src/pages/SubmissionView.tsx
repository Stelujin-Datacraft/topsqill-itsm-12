
import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { SubmissionFormView } from '@/components/SubmissionFormView';
import { PageContent } from '@/components/layouts/PageContent';

const SubmissionView = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = searchParams.get('edit') === 'true';

  if (!submissionId) {
    return (
      <PageContent title="Invalid Submission">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Invalid Submission</h2>
          <p className="text-muted-foreground mb-4">No submission ID provided.</p>
        </div>
      </PageContent>
    );
  }

  const handleBack = () => {
    navigate('/my-submissions');
  };

  return (
    <PageContent 
      title={isEditing ? "Edit Submission" : "Submission Details"}
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
    </PageContent>
  );
};

export default SubmissionView;
