import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Hash } from 'lucide-react';

interface SubmissionRefDisplayProps {
  submissionRefId?: string;
  submissionId?: string;
  formReferenceId?: string;
  formName?: string;
  showFormPrefix?: boolean;
  variant?: 'default' | 'compact' | 'badge';
  className?: string;
}

/**
 * Displays a submission reference ID with an optional form prefix.
 * The form prefix is shown as a separate badge/label alongside the submission ID.
 */
export function SubmissionRefDisplay({
  submissionRefId,
  submissionId,
  formReferenceId,
  formName,
  showFormPrefix = true,
  variant = 'default',
  className = '',
}: SubmissionRefDisplayProps) {
  // Get the display ID (submission_ref_id or truncated id)
  const displayId = submissionRefId || (submissionId ? submissionId.slice(0, 8) : 'N/A');
  
  // Get the form prefix (first 3-4 characters of form reference_id or form name initials)
  const getFormPrefix = (): string | null => {
    if (!showFormPrefix) return null;
    
    if (formReferenceId) {
      // Extract first 3-4 characters from form reference_id
      return formReferenceId.slice(0, 3).toUpperCase();
    }
    
    if (formName) {
      // Generate initials from form name (first letter of each word, max 3)
      const words = formName.trim().split(/\s+/);
      const initials = words
        .slice(0, 3)
        .map(word => word.charAt(0).toUpperCase())
        .join('');
      return initials || null;
    }
    
    return null;
  };

  const formPrefix = getFormPrefix();

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-xs ${className}`}>
        {formPrefix && (
          <span className="text-muted-foreground">{formPrefix}:</span>
        )}
        <span>#{displayId}</span>
      </span>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        {formPrefix && (
          <Badge variant="secondary" className="text-xs font-medium px-1.5 py-0">
            {formPrefix}
          </Badge>
        )}
        <Badge variant="outline" className="flex items-center gap-1">
          <Hash className="h-3 w-3" />
          {displayId}
        </Badge>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {formPrefix && (
        <Badge variant="secondary" className="text-xs font-semibold px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20">
          {formPrefix}
        </Badge>
      )}
      <span className="font-mono text-sm">#{displayId}</span>
    </div>
  );
}
