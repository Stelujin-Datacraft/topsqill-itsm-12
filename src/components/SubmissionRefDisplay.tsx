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
  
  // Get the form prefix (at least 5 characters that represent the form name)
  // This is DISPLAY ONLY - does not modify the actual submission ID
  const getFormPrefix = (): string | null => {
    if (!showFormPrefix) return null;
    
    if (formName) {
      const cleanName = formName.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
      const words = cleanName.split(/\s+/).filter(w => w.length > 0);
      
      if (words.length === 0) {
        // Fallback if no valid words
        return formReferenceId ? formReferenceId.slice(0, 5).toUpperCase() : null;
      }
      
      if (words.length === 1) {
        // Single word: use first 5 characters
        return words[0].slice(0, 5).padEnd(5, 'X');
      }
      
      if (words.length === 2) {
        // Two words: first 3 chars of first word + first 2 chars of second word
        const part1 = words[0].slice(0, 3);
        const part2 = words[1].slice(0, 2);
        return (part1 + part2).padEnd(5, 'X').slice(0, 5);
      }
      
      // Three or more words: first 2 chars of first word + first char of next 3 words
      let prefix = words[0].slice(0, 2);
      for (let i = 1; i < Math.min(words.length, 4); i++) {
        prefix += words[i].charAt(0);
      }
      return prefix.padEnd(5, 'X').slice(0, 5);
    }
    
    if (formReferenceId) {
      // Fallback to form reference_id
      return formReferenceId.slice(0, 5).toUpperCase();
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
