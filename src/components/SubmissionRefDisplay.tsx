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
  
  // Get the form prefix (at least 5 characters from form reference_id or form name)
  // This is DISPLAY ONLY - does not modify the actual submission ID
  const getFormPrefix = (): string | null => {
    if (!showFormPrefix) return null;
    
    if (formReferenceId) {
      // Extract first 5 characters from form reference_id
      return formReferenceId.slice(0, 5).toUpperCase();
    }
    
    if (formName) {
      // Generate prefix from form name (first 5 chars or padded initials)
      const cleanName = formName.trim().toUpperCase();
      
      // If form name is short, use it directly
      if (cleanName.length <= 5) {
        return cleanName.padEnd(5, 'X');
      }
      
      // Try to get meaningful prefix: first letters of words, then fill with first word chars
      const words = cleanName.split(/\s+/);
      let prefix = words.map(word => word.charAt(0)).join('');
      
      // If initials are less than 5, pad with chars from first word
      if (prefix.length < 5 && words[0]) {
        prefix = (prefix + words[0].slice(1)).slice(0, 5);
      }
      
      // Ensure minimum 5 characters
      return prefix.padEnd(5, 'X').slice(0, 5);
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
