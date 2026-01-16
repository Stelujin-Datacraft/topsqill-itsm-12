// Password validation utility based on security parameters

export interface PasswordPolicy {
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  password_min_length: 9,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_numbers: true,
  password_require_special: true,
};

export function validatePassword(
  password: string,
  policy: Partial<PasswordPolicy> = {}
): PasswordValidationResult {
  const fullPolicy = { ...DEFAULT_PASSWORD_POLICY, ...policy };
  const errors: string[] = [];

  // Check minimum length
  if (password.length < fullPolicy.password_min_length) {
    errors.push(`Password must be at least ${fullPolicy.password_min_length} characters long`);
  }

  // Check uppercase
  if (fullPolicy.password_require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check lowercase
  if (fullPolicy.password_require_lowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check numbers
  if (fullPolicy.password_require_numbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check special characters
  if (fullPolicy.password_require_special && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  if (score <= 2) {
    return { score, label: 'Weak', color: 'text-red-500' };
  } else if (score <= 3) {
    return { score, label: 'Fair', color: 'text-amber-500' };
  } else if (score <= 4) {
    return { score, label: 'Good', color: 'text-blue-500' };
  } else {
    return { score, label: 'Strong', color: 'text-emerald-500' };
  }
}
