import { FormField } from '@/types/form';

/**
 * Validates a field value in real-time as the user types.
 * Returns an error message string or undefined if valid.
 */
export function validateFieldValue(field: FormField, value: any): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined; // Don't show required errors in real-time, only on submit
  }

  const { validation, customConfig } = field;

  switch (field.type) {
    case 'number':
    case 'currency':
    case 'slider': {
      const numVal = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numVal)) return undefined;
      
      const min = validation?.min ?? customConfig?.min;
      const max = validation?.max ?? customConfig?.max;
      
      if (min !== undefined && numVal < min) {
        return validation?.message || `Value must be at least ${min}`;
      }
      if (max !== undefined && numVal > max) {
        return validation?.message || `Value must be at most ${max}`;
      }
      
      if (validation?.maxLength) {
        const digits = String(numVal).replace(/[^0-9]/g, '');
        if (digits.length > validation.maxLength) {
          return validation?.message || `Must not exceed ${validation.maxLength} digits`;
        }
      }
      break;
    }

    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
    case 'password':
    case 'phone':
    case 'ip-address': {
      const strVal = String(value);
      
      if (validation?.minLength && strVal.length < validation.minLength) {
        return validation?.message || `Must be at least ${validation.minLength} characters`;
      }
      if (validation?.maxLength && strVal.length > validation.maxLength) {
        return validation?.message || `Must not exceed ${validation.maxLength} characters`;
      }
      if (validation?.pattern) {
        try {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(strVal)) {
            return validation?.message || `Invalid format`;
          }
        } catch {
          // Invalid regex, skip
        }
      }
      if (validation?.min !== undefined && strVal.length < validation.min) {
        return validation?.message || `Must be at least ${validation.min} characters`;
      }
      if (validation?.max !== undefined && strVal.length > validation.max) {
        return validation?.message || `Must not exceed ${validation.max} characters`;
      }
      break;
    }

    case 'multi-select':
    case 'tags': {
      if (Array.isArray(value)) {
        if (validation?.min && value.length < validation.min) {
          return validation?.message || `Select at least ${validation.min} items`;
        }
        if (validation?.max && value.length > validation.max) {
          return validation?.message || `Select at most ${validation.max} items`;
        }
        if (customConfig?.maxSelections && value.length > customConfig.maxSelections) {
          return `Select at most ${customConfig.maxSelections} items`;
        }
        if (customConfig?.maxTags && value.length > customConfig.maxTags) {
          return `Maximum ${customConfig.maxTags} tags allowed`;
        }
      }
      break;
    }

    case 'rating': {
      const ratingVal = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(ratingVal)) return undefined;
      if (validation?.min && ratingVal < validation.min) {
        return validation?.message || `Minimum rating is ${validation.min}`;
      }
      break;
    }

    case 'date':
    case 'datetime': {
      if (customConfig?.minDate && value < customConfig.minDate) {
        return validation?.message || `Date must be after ${customConfig.minDate}`;
      }
      if (customConfig?.maxDate && value > customConfig.maxDate) {
        return validation?.message || `Date must be before ${customConfig.maxDate}`;
      }
      break;
    }

    default:
      break;
  }

  return undefined;
}
