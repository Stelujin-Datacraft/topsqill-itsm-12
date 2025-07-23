
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface FormSubmissionsDialogProps {
  children: React.ReactNode;
  initialFormId?: string;
}

export function FormSubmissionsDialog({ children, initialFormId }: FormSubmissionsDialogProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    const url = initialFormId 
      ? `/form-submissions?formId=${initialFormId}`
      : '/form-submissions';
    navigate(url);
  };

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  );
}
