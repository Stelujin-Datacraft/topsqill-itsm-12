
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSecurityTemplates, SecurityTemplate } from '@/hooks/useSecurityTemplates';
import { Eye, EyeOff, Check, X, Shield, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserInviteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (data: { 
    email: string; 
    firstName: string; 
    lastName: string; 
    role: string;
    password: string;
    securityTemplateId?: string;
    mobile?: string;
    gender?: string;
    nationality?: string;
    timezone?: string;
  }) => void;
  organizationName?: string;
  isLoading?: boolean;
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
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const UserInviteDialog = ({ isOpen, onOpenChange, onInvite, organizationName, isLoading }: UserInviteDialogProps) => {
  const { templates, loading: templatesLoading } = useSecurityTemplates();
  const [showPassword, setShowPassword] = useState(false);
  
  const [inviteData, setInviteData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    password: '',
    securityTemplateId: '',
    mobile: '',
    gender: '',
    nationality: '',
    timezone: '',
  });

  // Get selected template for password validation
  const selectedTemplate = useMemo(() => {
    if (!inviteData.securityTemplateId) return null;
    return templates.find(t => t.id === inviteData.securityTemplateId);
  }, [inviteData.securityTemplateId, templates]);

  // Password validation based on template
  const passwordValidation = useMemo(() => {
    const password = inviteData.password;
    const template = selectedTemplate;
    
    const minLength = template?.password_min_length || 9;
    const requireUppercase = template?.password_require_uppercase ?? true;
    const requireLowercase = template?.password_require_lowercase ?? true;
    const requireNumbers = template?.password_require_numbers ?? true;
    const requireSpecial = template?.password_require_special ?? true;

    const checks = [
      { 
        label: `At least ${minLength} characters`, 
        passed: password.length >= minLength 
      },
    ];
    
    if (requireUppercase) {
      checks.push({ 
        label: 'Contains uppercase letter', 
        passed: /[A-Z]/.test(password) 
      });
    }
    
    if (requireLowercase) {
      checks.push({ 
        label: 'Contains lowercase letter', 
        passed: /[a-z]/.test(password) 
      });
    }
    
    if (requireNumbers) {
      checks.push({ 
        label: 'Contains number', 
        passed: /\d/.test(password) 
      });
    }
    
    if (requireSpecial) {
      checks.push({ 
        label: 'Contains special character', 
        passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) 
      });
    }

    return {
      checks,
      isValid: checks.every(c => c.passed) && password.length > 0,
    };
  }, [inviteData.password, selectedTemplate]);

  // Set default template when templates load
  useEffect(() => {
    if (templates.length > 0 && !inviteData.securityTemplateId) {
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      setInviteData(prev => ({ ...prev, securityTemplateId: defaultTemplate.id }));
    }
  }, [templates]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValidation.isValid) return;
    
    onInvite({
      email: inviteData.email,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      role: inviteData.role,
      password: inviteData.password,
      securityTemplateId: inviteData.securityTemplateId || undefined,
      mobile: inviteData.mobile || undefined,
      gender: inviteData.gender || undefined,
      nationality: inviteData.nationality || undefined,
      timezone: inviteData.timezone || undefined,
    });
  };

  const handleClose = () => {
    setInviteData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'user',
      password: '',
      securityTemplateId: templates.find(t => t.is_default)?.id || '',
      mobile: '',
      gender: '',
      nationality: '',
      timezone: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Create a new user account and send an invitation email to join {organizationName || 'the organization'}.
            The user will receive an email with login credentials and an Accept button.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={inviteData.firstName}
                    onChange={(e) => setInviteData({ ...inviteData, firstName: e.target.value })}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={inviteData.lastName}
                    onChange={(e) => setInviteData({ ...inviteData, lastName: e.target.value })}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={inviteData.mobile}
                    onChange={(e) => setInviteData({ ...inviteData, mobile: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={inviteData.gender} onValueChange={(value) => setInviteData({ ...inviteData, gender: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    type="text"
                    value={inviteData.nationality}
                    onChange={(e) => setInviteData({ ...inviteData, nationality: e.target.value })}
                    placeholder="e.g., American"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={inviteData.timezone} onValueChange={(value) => setInviteData({ ...inviteData, timezone: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Role & Security */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Role & Security</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select value={inviteData.role} onValueChange={(value) => setInviteData({ ...inviteData, role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="securityTemplate">Security Template</Label>
                  <Select 
                    value={inviteData.securityTemplateId} 
                    onValueChange={(value) => setInviteData({ ...inviteData, securityTemplateId: value })}
                    disabled={templatesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={templatesLoading ? "Loading..." : "Select template"} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} {template.is_default && '(Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password">Initial Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={inviteData.password}
                    onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                    placeholder="Enter a secure password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Password Requirements */}
                {inviteData.password && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Password Requirements {selectedTemplate && `(${selectedTemplate.name})`}:
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {passwordValidation.checks.map((check, index) => (
                        <div key={index} className="flex items-center gap-1.5 text-xs">
                          {check.passed ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <X className="h-3 w-3 text-red-500" />
                          )}
                          <span className={cn(
                            check.passed ? 'text-green-600' : 'text-muted-foreground'
                          )}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!passwordValidation.isValid || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Invitation...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserInviteDialog;
