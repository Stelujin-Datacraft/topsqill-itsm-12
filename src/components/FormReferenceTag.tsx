
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Hash } from 'lucide-react';

interface FormReferenceTagProps {
  referenceId: string;
  className?: string;
}

export function FormReferenceTag({ referenceId, className }: FormReferenceTagProps) {
  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${className}`}>
      <Hash className="h-3 w-3" />
      {referenceId}
    </Badge>
  );
}
