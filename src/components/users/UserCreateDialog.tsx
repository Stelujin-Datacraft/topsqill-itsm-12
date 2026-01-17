import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSecurityTemplates, SecurityTemplate } from '@/hooks/useSecurityTemplates';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';


interface UserCreateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (userData: UserCreateData) => Promise<void>;
}

export interface UserCreateData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  nationality?: string;
  password?: string;
  mobile?: string;
  gender?: string;
  timezone?: string;
  securityTemplateId?: string;
  userDomain?: string;
  status: 'active' | 'inactive';
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Pacific/Midway', label: '(GMT-11:00) Midway Island' },
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii' },
  { value: 'America/Anchorage', label: '(GMT-09:00) Alaska' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time (US & Canada)' },
  { value: 'America/Phoenix', label: '(GMT-07:00) Arizona' },
  { value: 'America/Denver', label: '(GMT-07:00) Mountain Time (US & Canada)' },
  { value: 'America/Chicago', label: '(GMT-06:00) Central Time (US & Canada)' },
  { value: 'America/Mexico_City', label: '(GMT-06:00) Mexico City' },
  { value: 'America/New_York', label: '(GMT-05:00) Eastern Time (US & Canada)' },
  { value: 'America/Bogota', label: '(GMT-05:00) Bogota, Lima' },
  { value: 'America/Caracas', label: '(GMT-04:00) Caracas' },
  { value: 'America/Halifax', label: '(GMT-04:00) Atlantic Time (Canada)' },
  { value: 'America/Santiago', label: '(GMT-04:00) Santiago' },
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) Brasilia' },
  { value: 'America/Argentina/Buenos_Aires', label: '(GMT-03:00) Buenos Aires' },
  { value: 'America/St_Johns', label: '(GMT-03:30) Newfoundland' },
  { value: 'Atlantic/Azores', label: '(GMT-01:00) Azores' },
  { value: 'Atlantic/Cape_Verde', label: '(GMT-01:00) Cape Verde Is.' },
  { value: 'Europe/London', label: '(GMT+00:00) London, Dublin' },
  { value: 'Africa/Casablanca', label: '(GMT+00:00) Casablanca' },
  { value: 'Europe/Paris', label: '(GMT+01:00) Paris, Brussels, Madrid' },
  { value: 'Europe/Berlin', label: '(GMT+01:00) Berlin, Rome' },
  { value: 'Africa/Lagos', label: '(GMT+01:00) West Central Africa' },
  { value: 'Europe/Athens', label: '(GMT+02:00) Athens, Istanbul' },
  { value: 'Africa/Cairo', label: '(GMT+02:00) Cairo' },
  { value: 'Europe/Helsinki', label: '(GMT+02:00) Helsinki, Kyiv' },
  { value: 'Asia/Jerusalem', label: '(GMT+02:00) Jerusalem' },
  { value: 'Africa/Johannesburg', label: '(GMT+02:00) Johannesburg' },
  { value: 'Europe/Moscow', label: '(GMT+03:00) Moscow, St. Petersburg' },
  { value: 'Asia/Kuwait', label: '(GMT+03:00) Kuwait, Riyadh' },
  { value: 'Africa/Nairobi', label: '(GMT+03:00) Nairobi' },
  { value: 'Asia/Baghdad', label: '(GMT+03:00) Baghdad' },
  { value: 'Asia/Tehran', label: '(GMT+03:30) Tehran' },
  { value: 'Asia/Dubai', label: '(GMT+04:00) Abu Dhabi, Muscat' },
  { value: 'Asia/Baku', label: '(GMT+04:00) Baku, Tbilisi, Yerevan' },
  { value: 'Asia/Kabul', label: '(GMT+04:30) Kabul' },
  { value: 'Asia/Karachi', label: '(GMT+05:00) Islamabad, Karachi' },
  { value: 'Asia/Tashkent', label: '(GMT+05:00) Tashkent' },
  { value: 'Asia/Kolkata', label: '(GMT+05:30) India Standard Time' },
  { value: 'Asia/Colombo', label: '(GMT+05:30) Sri Jayawardenepura' },
  { value: 'Asia/Kathmandu', label: '(GMT+05:45) Kathmandu' },
  { value: 'Asia/Dhaka', label: '(GMT+06:00) Dhaka' },
  { value: 'Asia/Almaty', label: '(GMT+06:00) Almaty' },
  { value: 'Asia/Yangon', label: '(GMT+06:30) Yangon (Rangoon)' },
  { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok, Hanoi, Jakarta' },
  { value: 'Asia/Shanghai', label: '(GMT+08:00) Beijing, Shanghai' },
  { value: 'Asia/Hong_Kong', label: '(GMT+08:00) Hong Kong' },
  { value: 'Asia/Singapore', label: '(GMT+08:00) Singapore' },
  { value: 'Australia/Perth', label: '(GMT+08:00) Perth' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo, Osaka' },
  { value: 'Asia/Seoul', label: '(GMT+09:00) Seoul' },
  { value: 'Australia/Adelaide', label: '(GMT+09:30) Adelaide' },
  { value: 'Australia/Darwin', label: '(GMT+09:30) Darwin' },
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney, Melbourne' },
  { value: 'Australia/Brisbane', label: '(GMT+10:00) Brisbane' },
  { value: 'Pacific/Guam', label: '(GMT+10:00) Guam, Port Moresby' },
  { value: 'Pacific/Noumea', label: '(GMT+11:00) Solomon Is., New Caledonia' },
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland, Wellington' },
  { value: 'Pacific/Fiji', label: '(GMT+12:00) Fiji' },
  { value: 'Pacific/Tongatapu', label: '(GMT+13:00) Nuku\'alofa' },
];

const NATIONALITY_OPTIONS = [
  { value: 'AF', label: 'Afghanistan' },
  { value: 'AL', label: 'Albania' },
  { value: 'DZ', label: 'Algeria' },
  { value: 'AR', label: 'Argentina' },
  { value: 'AM', label: 'Armenia' },
  { value: 'AU', label: 'Australia' },
  { value: 'AT', label: 'Austria' },
  { value: 'AZ', label: 'Azerbaijan' },
  { value: 'BH', label: 'Bahrain' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'BY', label: 'Belarus' },
  { value: 'BE', label: 'Belgium' },
  { value: 'BR', label: 'Brazil' },
  { value: 'BG', label: 'Bulgaria' },
  { value: 'CA', label: 'Canada' },
  { value: 'CL', label: 'Chile' },
  { value: 'CN', label: 'China' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'HR', label: 'Croatia' },
  { value: 'CU', label: 'Cuba' },
  { value: 'CY', label: 'Cyprus' },
  { value: 'CZ', label: 'Czech Republic' },
  { value: 'DK', label: 'Denmark' },
  { value: 'EG', label: 'Egypt' },
  { value: 'EE', label: 'Estonia' },
  { value: 'ET', label: 'Ethiopia' },
  { value: 'FI', label: 'Finland' },
  { value: 'FR', label: 'France' },
  { value: 'GE', label: 'Georgia' },
  { value: 'DE', label: 'Germany' },
  { value: 'GH', label: 'Ghana' },
  { value: 'GR', label: 'Greece' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'HU', label: 'Hungary' },
  { value: 'IS', label: 'Iceland' },
  { value: 'IN', label: 'India' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'IR', label: 'Iran' },
  { value: 'IQ', label: 'Iraq' },
  { value: 'IE', label: 'Ireland' },
  { value: 'IL', label: 'Israel' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'JO', label: 'Jordan' },
  { value: 'KZ', label: 'Kazakhstan' },
  { value: 'KE', label: 'Kenya' },
  { value: 'KW', label: 'Kuwait' },
  { value: 'LV', label: 'Latvia' },
  { value: 'LB', label: 'Lebanon' },
  { value: 'LT', label: 'Lithuania' },
  { value: 'LU', label: 'Luxembourg' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'MX', label: 'Mexico' },
  { value: 'MA', label: 'Morocco' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'NO', label: 'Norway' },
  { value: 'OM', label: 'Oman' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'PE', label: 'Peru' },
  { value: 'PH', label: 'Philippines' },
  { value: 'PL', label: 'Poland' },
  { value: 'PT', label: 'Portugal' },
  { value: 'QA', label: 'Qatar' },
  { value: 'RO', label: 'Romania' },
  { value: 'RU', label: 'Russia' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'RS', label: 'Serbia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'SK', label: 'Slovakia' },
  { value: 'SI', label: 'Slovenia' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'KR', label: 'South Korea' },
  { value: 'ES', label: 'Spain' },
  { value: 'LK', label: 'Sri Lanka' },
  { value: 'SE', label: 'Sweden' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'TH', label: 'Thailand' },
  { value: 'TR', label: 'Turkey' },
  { value: 'UA', label: 'Ukraine' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'VN', label: 'Vietnam' },
];

// Default password policy when no template is selected
const DEFAULT_PASSWORD_POLICY = {
  password_min_length: 8,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_numbers: true,
  password_require_special: true,
};

interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  checks: {
    label: string;
    passed: boolean;
  }[];
}

const validatePassword = (
  password: string, 
  template: SecurityTemplate | null
): PasswordValidation => {
  const policy = template || DEFAULT_PASSWORD_POLICY;
  const errors: string[] = [];
  const checks: { label: string; passed: boolean }[] = [];

  // Minimum length check
  const minLength = policy.password_min_length || 8;
  const lengthPassed = password.length >= minLength;
  checks.push({ label: `At least ${minLength} characters`, passed: lengthPassed });
  if (!lengthPassed) errors.push(`Password must be at least ${minLength} characters`);

  // Uppercase check
  if (policy.password_require_uppercase) {
    const hasUppercase = /[A-Z]/.test(password);
    checks.push({ label: 'Contains uppercase letter', passed: hasUppercase });
    if (!hasUppercase) errors.push('Password must contain an uppercase letter');
  }

  // Lowercase check
  if (policy.password_require_lowercase) {
    const hasLowercase = /[a-z]/.test(password);
    checks.push({ label: 'Contains lowercase letter', passed: hasLowercase });
    if (!hasLowercase) errors.push('Password must contain a lowercase letter');
  }

  // Numbers check
  if (policy.password_require_numbers) {
    const hasNumber = /[0-9]/.test(password);
    checks.push({ label: 'Contains number', passed: hasNumber });
    if (!hasNumber) errors.push('Password must contain a number');
  }

  // Special character check
  if (policy.password_require_special) {
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    checks.push({ label: 'Contains special character', passed: hasSpecial });
    if (!hasSpecial) errors.push('Password must contain a special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
    checks,
  };
};

const UserCreateDialog = ({ isOpen, onOpenChange, onCreate }: UserCreateDialogProps) => {
  const { templates, loading: templatesLoading, defaultTemplate } = useSecurityTemplates();
  const [formData, setFormData] = useState<UserCreateData>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    nationality: '',
    password: '',
    mobile: '',
    gender: '',
    timezone: 'UTC',
    securityTemplateId: '',
    userDomain: '',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Get the selected template for password validation
  const selectedTemplate = useMemo(() => {
    if (!formData.securityTemplateId) return null;
    return templates.find(t => t.id === formData.securityTemplateId) || null;
  }, [formData.securityTemplateId, templates]);

  // Validate password against selected template (only when template is selected)
  const passwordValidation = useMemo(() => {
    // If no template selected, password validation is not applicable yet
    if (!selectedTemplate) {
      return { isValid: false, errors: [], checks: [] };
    }
    if (!formData.password) {
      return { isValid: false, errors: [], checks: [] };
    }
    return validatePassword(formData.password, selectedTemplate);
  }, [formData.password, selectedTemplate]);

  // Check if form is ready to submit
  const canSubmit = useMemo(() => {
    return formData.securityTemplateId && passwordValidation.isValid;
  }, [formData.securityTemplateId, passwordValidation.isValid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check template and password validation before submitting
    if (!formData.securityTemplateId || !passwordValidation.isValid) {
      return;
    }
    
    setLoading(true);
    
    try {
      await onCreate(formData);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'user',
        nationality: '',
        password: '',
        mobile: '',
        gender: '',
        timezone: 'UTC',
        securityTemplateId: '',
        userDomain: '',
        status: 'active',
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter Password"
                  className={formData.password && !passwordValidation.isValid ? 'border-destructive pr-10' : 'pr-10'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              
              {/* Password Requirements Checklist - only show when template is selected */}
              {selectedTemplate && formData.password && (
                <div className="mt-2 p-3 rounded-md bg-muted/50 border">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">
                    Password Requirements ({selectedTemplate.name}):
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {passwordValidation.checks.map((check, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        {check.passed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className={check.passed ? 'text-muted-foreground' : 'text-destructive'}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Prompt to select template first */}
              {!selectedTemplate && formData.password && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Select a Security Template below to see password requirements
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Select
                value={formData.nationality}
                onValueChange={(value) => setFormData({ ...formData, nationality: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select nationality" />
                </SelectTrigger>
                <SelectContent>
                  {NATIONALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Time Zone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userDomain">User Domain</Label>
              <Input
                id="userDomain"
                value={formData.userDomain}
                onChange={(e) => setFormData({ ...formData, userDomain: e.target.value })}
                placeholder="e.g., sales, engineering, marketing"
              />
            </div>

            <div className="space-y-2">
              <Label>Account Status *</Label>
              <RadioGroup
                value={formData.status}
                onValueChange={(value: 'active' | 'inactive') => setFormData({ ...formData, status: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="active" id="status-active" />
                  <Label htmlFor="status-active" className="cursor-pointer font-normal">Active</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="inactive" id="status-inactive" />
                  <Label htmlFor="status-inactive" className="cursor-pointer font-normal">Inactive</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="securityTemplate">Security Template *</Label>
              <Select
                value={formData.securityTemplateId || ''}
                onValueChange={(value) => setFormData({ ...formData, securityTemplateId: value })}
                disabled={templatesLoading}
                required
              >
                <SelectTrigger className={!formData.securityTemplateId ? 'border-muted-foreground/50' : ''}>
                  <SelectValue placeholder="Select a security template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.is_default && ' (Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.securityTemplateId 
                  ? 'Template settings will be applied to this user'
                  : 'Please select a template to define password requirements'}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserCreateDialog;
