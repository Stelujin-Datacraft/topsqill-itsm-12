
import React from 'react';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FormAccessButtonProps {
  formId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function FormAccessButton({ formId, variant = 'outline', size = 'sm' }: FormAccessButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/form-access/${formId}`);
  };

  return (
    <Button 
      variant={variant} 
      size={size}
      onClick={handleClick}
      className="flex items-center gap-2"
    >
      <Shield className="h-4 w-4" />
      Access Management
    </Button>
  );
}
