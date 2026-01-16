import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Check, X } from 'lucide-react';
import { validatePassword, getPasswordStrength, PasswordPolicy } from '@/utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  password: string;
  policy?: Partial<PasswordPolicy>;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({ 
  password, 
  policy,
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const validation = useMemo(() => validatePassword(password, policy), [password, policy]);

  const requirements = useMemo(() => {
    const p = { 
      password_min_length: policy?.password_min_length ?? 9,
      password_require_uppercase: policy?.password_require_uppercase ?? true,
      password_require_lowercase: policy?.password_require_lowercase ?? true,
      password_require_numbers: policy?.password_require_numbers ?? true,
      password_require_special: policy?.password_require_special ?? true,
    };

    return [
      {
        label: `At least ${p.password_min_length} characters`,
        met: password.length >= p.password_min_length,
        required: true,
      },
      {
        label: 'At least one uppercase letter',
        met: /[A-Z]/.test(password),
        required: p.password_require_uppercase,
      },
      {
        label: 'At least one lowercase letter',
        met: /[a-z]/.test(password),
        required: p.password_require_lowercase,
      },
      {
        label: 'At least one number',
        met: /[0-9]/.test(password),
        required: p.password_require_numbers,
      },
      {
        label: 'At least one special character',
        met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
        required: p.password_require_special,
      },
    ].filter(r => r.required);
  }, [password, policy]);

  if (!password) {
    return null;
  }

  const progressValue = (strength.score / 6) * 100;
  const progressColor = 
    strength.label === 'Weak' ? 'bg-red-500' :
    strength.label === 'Fair' ? 'bg-amber-500' :
    strength.label === 'Good' ? 'bg-blue-500' :
    'bg-emerald-500';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Password strength</span>
          <span className={strength.color + ' font-medium'}>{strength.label}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      {showRequirements && (
        <div className="space-y-1.5">
          {requirements.map((req, idx) => (
            <div 
              key={idx} 
              className={`flex items-center gap-2 text-xs ${
                req.met ? 'text-emerald-600' : 'text-muted-foreground'
              }`}
            >
              {req.met ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
