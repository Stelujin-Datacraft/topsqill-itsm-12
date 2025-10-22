import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { SubmissionUpdateDialog } from './SubmissionUpdateDialog';

interface SubmissionUpdateButtonProps {
  formId: string;
  onUpdateComplete: () => void;
}

export function SubmissionUpdateButton({ formId, onUpdateComplete }: SubmissionUpdateButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <Upload className="h-4 w-4 mr-2" />
        Update Records
      </Button>
      <SubmissionUpdateDialog
        open={open}
        onOpenChange={setOpen}
        formId={formId}
        onUpdateComplete={onUpdateComplete}
      />
    </>
  );
}
