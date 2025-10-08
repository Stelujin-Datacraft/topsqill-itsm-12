import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';

interface ValidationResult {
  isValid: boolean;
  error?: string;
  duplicateValue?: any;
}

export function useUniqueFieldValidation() {
  const [isValidating, setIsValidating] = useState(false);

  const validateUniqueFields = async (
    formId: string,
    fields: FormField[],
    formData: Record<string, any>,
    currentSubmissionId?: string
  ): Promise<Record<string, ValidationResult>> => {
    setIsValidating(true);
    const results: Record<string, ValidationResult> = {};

    try {
      // Find all fields that have unique validation enabled
      const uniqueFields = fields.filter(
        (field) => field.validation?.unique === true
      );

      if (uniqueFields.length === 0) {
        setIsValidating(false);
        return results;
      }

      // Check each unique field
      for (const field of uniqueFields) {
        const fieldValue = formData[field.id];
        
        // Skip validation if the field is empty (let required validation handle that)
        if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
          results[field.id] = { isValid: true };
          continue;
        }

        try {
          // Query the database for existing submissions with this value
          let query = supabase
            .from('form_submissions')
            .select('id, submission_data')
            .eq('form_id', formId);

          // If updating an existing submission, exclude it from the check
          if (currentSubmissionId) {
            query = query.neq('id', currentSubmissionId);
          }

          const { data: existingSubmissions, error } = await query;

          if (error) {
            console.error('Error checking unique field:', error);
            results[field.id] = {
              isValid: false,
              error: 'Failed to validate uniqueness. Please try again.'
            };
            continue;
          }

          // Check if any submission has the same value for this field
          const isDuplicate = existingSubmissions?.some((submission) => {
            const submissionValue = submission.submission_data?.[field.id];
            
            // Handle different data types
            if (typeof fieldValue === 'object' && typeof submissionValue === 'object') {
              return JSON.stringify(fieldValue) === JSON.stringify(submissionValue);
            }
            
            // Case-insensitive comparison for strings
            if (typeof fieldValue === 'string' && typeof submissionValue === 'string') {
              return fieldValue.toLowerCase().trim() === submissionValue.toLowerCase().trim();
            }
            
            return fieldValue === submissionValue;
          });

          if (isDuplicate) {
            results[field.id] = {
              isValid: false,
              error: `This ${field.label || 'value'} already exists. Please use a different value.`,
              duplicateValue: fieldValue
            };
          } else {
            results[field.id] = { isValid: true };
          }
        } catch (err) {
          console.error(`Error validating field ${field.id}:`, err);
          results[field.id] = {
            isValid: false,
            error: 'Validation error occurred'
          };
        }
      }
    } catch (err) {
      console.error('Error in unique field validation:', err);
    } finally {
      setIsValidating(false);
    }

    return results;
  };

  return {
    validateUniqueFields,
    isValidating
  };
}
