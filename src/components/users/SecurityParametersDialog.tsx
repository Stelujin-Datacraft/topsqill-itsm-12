import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Shield, 
  Key, 
  Clock, 
  Lock, 
  Smartphone, 
  Globe, 
  AlertTriangle,
  Unlock,
  Save,
  RotateCcw,
  FileText
} from 'lucide-react';
import { useSecurityParameters, UserSecurityParameters } from '@/hooks/useSecurityParameters';
import { useSecurityTemplates } from '@/hooks/useSecurityTemplates';

interface SecurityParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export function SecurityParametersDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
}: SecurityParametersDialogProps) {
  const {
    parameters,
    orgDefaults,
    loading,
    saving,
    saveParameters,
    unlockAccount,
    getEffectiveValue,
    defaultParams,
    refetch,
  } = useSecurityParameters(userId);

  const { templates, loading: templatesLoading } = useSecurityTemplates();

  // Form state
  const [formData, setFormData] = useState<Partial<UserSecurityParameters>>({});

  // Reset form data when dialog opens or when parameters change
  useEffect(() => {
    if (open && parameters) {
      setFormData({ ...parameters });
    } else if (open && !parameters) {
      setFormData({});
    }
  }, [parameters, open]);

  // Refetch when dialog opens with a new userId
  useEffect(() => {
    if (open && userId) {
      refetch();
    }
  }, [open, userId]);

  const handleSave = async () => {
    const success = await saveParameters(formData);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setFormData(parameters ? { ...parameters } : {});
  };

  const updateField = <K extends keyof UserSecurityParameters>(
    key: K,
    value: UserSecurityParameters[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const isAccountLocked = parameters?.account_locked_until 
    ? new Date(parameters.account_locked_until) > new Date()
    : false;

  const handleUnlock = async () => {
    await unlockAccount();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Security Parameters</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                {userName || userEmail}
                {isAccountLocked && (
                  <Badge variant="destructive" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Account Locked
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading || templatesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Template Selection Card */}
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Security Template</h4>
                        <p className="text-xs text-muted-foreground">Apply predefined security policies</p>
                      </div>
                      {formData.security_template_id && (
                        <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-full border">
                          <Label className="text-xs font-medium whitespace-nowrap">Use Template</Label>
                          <Switch
                            checked={formData.use_template_settings ?? false}
                            onCheckedChange={(checked) => updateField('use_template_settings', checked)}
                            className="scale-90"
                          />
                        </div>
                      )}
                    </div>
                    <Select
                      value={formData.security_template_id ?? 'none'}
                      onValueChange={(value) => updateField('security_template_id', value === 'none' ? null : value)}
                    >
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <div className="flex items-center gap-2">
                            <span>No template</span>
                            <span className="text-xs text-muted-foreground">(use organization defaults)</span>
                          </div>
                        </SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              <span>{template.name}</span>
                              {template.is_default && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Default</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.security_template_id && formData.use_template_settings && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                        <Shield className="h-3 w-3" />
                        Template settings are active. Individual parameters below are hidden.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Only show parameter tabs when template is not assigned OR use_template_settings is false */}
            {(!formData.security_template_id || !formData.use_template_settings) && (
            <Tabs defaultValue="password">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="password" className="flex items-center gap-1.5 text-xs">
                  <Key className="h-3.5 w-3.5" />
                  Password
                </TabsTrigger>
                <TabsTrigger value="lockout" className="flex items-center gap-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5" />
                  Lockout
                </TabsTrigger>
                <TabsTrigger value="session" className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Session
                </TabsTrigger>
                <TabsTrigger value="access" className="flex items-center gap-1.5 text-xs">
                  <Globe className="h-3.5 w-3.5" />
                  Access
                </TabsTrigger>
                <TabsTrigger value="mfa" className="flex items-center gap-1.5 text-xs">
                  <Smartphone className="h-3.5 w-3.5" />
                  MFA
                </TabsTrigger>
              </TabsList>

            {/* Password Policy Tab */}
            <TabsContent value="password" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    Password Complexity
                  </CardTitle>
                  <CardDescription>Configure password strength requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password_min_length">Minimum Length</Label>
                      <Input
                        id="password_min_length"
                        type="number"
                        min={6}
                        max={32}
                        value={formData.password_min_length ?? getEffectiveValue('password_min_length')}
                        onChange={(e) => updateField('password_min_length', parseInt(e.target.value) || 9)}
                      />
                      <p className="text-xs text-muted-foreground">Default: {defaultParams.password_min_length}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password_history_count">Password History</Label>
                      <Input
                        id="password_history_count"
                        type="number"
                        min={0}
                        max={50}
                        value={formData.password_history_count ?? getEffectiveValue('password_history_count')}
                        onChange={(e) => updateField('password_history_count', parseInt(e.target.value) || 20)}
                      />
                      <p className="text-xs text-muted-foreground">Prevent reusing last N passwords</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="require_uppercase">Require Uppercase</Label>
                      <Switch
                        id="require_uppercase"
                        checked={formData.password_require_uppercase ?? getEffectiveValue('password_require_uppercase')}
                        onCheckedChange={(checked) => updateField('password_require_uppercase', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="require_lowercase">Require Lowercase</Label>
                      <Switch
                        id="require_lowercase"
                        checked={formData.password_require_lowercase ?? getEffectiveValue('password_require_lowercase')}
                        onCheckedChange={(checked) => updateField('password_require_lowercase', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="require_numbers">Require Numbers</Label>
                      <Switch
                        id="require_numbers"
                        checked={formData.password_require_numbers ?? getEffectiveValue('password_require_numbers')}
                        onCheckedChange={(checked) => updateField('password_require_numbers', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="require_special">Require Special Characters</Label>
                      <Switch
                        id="require_special"
                        checked={formData.password_require_special ?? getEffectiveValue('password_require_special')}
                        onCheckedChange={(checked) => updateField('password_require_special', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Password Lifecycle
                  </CardTitle>
                  <CardDescription>Configure password expiration settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password_expiry_days">Expiry (days)</Label>
                      <Input
                        id="password_expiry_days"
                        type="number"
                        min={0}
                        max={365}
                        value={formData.password_expiry_days ?? getEffectiveValue('password_expiry_days')}
                        onChange={(e) => updateField('password_expiry_days', parseInt(e.target.value) || 90)}
                      />
                      <p className="text-xs text-muted-foreground">0 = never expires</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password_expiry_warning">Warning (days)</Label>
                      <Input
                        id="password_expiry_warning"
                        type="number"
                        min={0}
                        max={30}
                        value={formData.password_expiry_warning_days ?? getEffectiveValue('password_expiry_warning_days')}
                        onChange={(e) => updateField('password_expiry_warning_days', parseInt(e.target.value) || 14)}
                      />
                      <p className="text-xs text-muted-foreground">Days before expiry to warn</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password_change_min_hours">Min Change Interval (hours)</Label>
                      <Input
                        id="password_change_min_hours"
                        type="number"
                        min={0}
                        max={168}
                        value={formData.password_change_min_hours ?? getEffectiveValue('password_change_min_hours')}
                        onChange={(e) => updateField('password_change_min_hours', parseInt(e.target.value) || 24)}
                      />
                      <p className="text-xs text-muted-foreground">Prevent rapid changes</p>
                    </div>
                  </div>

                  {parameters?.last_password_change && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      <Clock className="h-4 w-4" />
                      Last password change: {new Date(parameters.last_password_change).toLocaleDateString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Lockout Tab */}
            <TabsContent value="lockout" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Lockout Policy
                  </CardTitle>
                  <CardDescription>Configure account lockout behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_failed_attempts">Max Failed Attempts</Label>
                      <Input
                        id="max_failed_attempts"
                        type="number"
                        min={1}
                        max={10}
                        value={formData.max_failed_login_attempts ?? getEffectiveValue('max_failed_login_attempts')}
                        onChange={(e) => updateField('max_failed_login_attempts', parseInt(e.target.value) || 3)}
                      />
                      <p className="text-xs text-muted-foreground">Before account lockout</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lockout_duration">Lockout Duration (minutes)</Label>
                      <Input
                        id="lockout_duration"
                        type="number"
                        min={1}
                        max={1440}
                        value={formData.lockout_duration_minutes ?? getEffectiveValue('lockout_duration_minutes')}
                        onChange={(e) => updateField('lockout_duration_minutes', parseInt(e.target.value) || 30)}
                      />
                      <p className="text-xs text-muted-foreground">How long until auto-unlock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Lockout Status */}
              <Card className={isAccountLocked ? 'border-destructive' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${isAccountLocked ? 'text-destructive' : 'text-muted-foreground'}`} />
                    Account Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium">Failed Login Attempts</p>
                      <p className="text-2xl font-bold mt-1">{parameters?.failed_login_count ?? 0}</p>
                      {parameters?.last_failed_login && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last: {new Date(parameters.last_failed_login).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className={`p-4 rounded-lg ${isAccountLocked ? 'bg-destructive/10' : 'bg-emerald-500/10'}`}>
                      <p className="text-sm font-medium">Lock Status</p>
                      <p className={`text-lg font-bold mt-1 ${isAccountLocked ? 'text-destructive' : 'text-emerald-600'}`}>
                        {isAccountLocked ? 'Locked' : 'Active'}
                      </p>
                      {parameters?.account_locked_until && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Until: {new Date(parameters.account_locked_until).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {isAccountLocked && (
                    <Button onClick={handleUnlock} variant="outline" className="w-full" disabled={saving}>
                      <Unlock className="h-4 w-4 mr-2" />
                      Unlock Account
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Session Management Tab */}
            <TabsContent value="session" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Session Timeout
                  </CardTitle>
                  <CardDescription>Configure session expiration behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="session_timeout">Timeout (minutes)</Label>
                      <Input
                        id="session_timeout"
                        type="number"
                        min={1}
                        max={1440}
                        value={formData.session_timeout_minutes ?? getEffectiveValue('session_timeout_minutes')}
                        onChange={(e) => updateField('session_timeout_minutes', parseInt(e.target.value) || 30)}
                      />
                      <p className="text-xs text-muted-foreground">Inactivity timeout</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeout_warning">Warning (seconds)</Label>
                      <Input
                        id="timeout_warning"
                        type="number"
                        min={30}
                        max={300}
                        value={formData.session_timeout_warning_seconds ?? getEffectiveValue('session_timeout_warning_seconds')}
                        onChange={(e) => updateField('session_timeout_warning_seconds', parseInt(e.target.value) || 60)}
                      />
                      <p className="text-xs text-muted-foreground">Before session expires</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_sessions">Max Concurrent Sessions</Label>
                      <Input
                        id="max_sessions"
                        type="number"
                        min={1}
                        max={10}
                        value={formData.max_concurrent_sessions ?? getEffectiveValue('max_concurrent_sessions')}
                        onChange={(e) => updateField('max_concurrent_sessions', parseInt(e.target.value) || 3)}
                      />
                      <p className="text-xs text-muted-foreground">Active sessions allowed</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="static_timeout">Static Session Timeout</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Force logout after timeout regardless of activity
                      </p>
                    </div>
                    <Switch
                      id="static_timeout"
                      checked={formData.static_session_timeout ?? getEffectiveValue('static_session_timeout')}
                      onCheckedChange={(checked) => updateField('static_session_timeout', checked)}
                    />
                  </div>

                  {parameters?.last_login && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      <Clock className="h-4 w-4" />
                      Last login: {new Date(parameters.last_login).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Access Restrictions Tab */}
            <TabsContent value="access" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Time-Based Access
                  </CardTitle>
                  <CardDescription>Restrict login to specific hours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="access_start">Access Start Time</Label>
                      <Input
                        id="access_start"
                        type="time"
                        value={formData.access_start_time ?? ''}
                        onChange={(e) => updateField('access_start_time', e.target.value || null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="access_end">Access End Time</Label>
                      <Input
                        id="access_end"
                        type="time"
                        value={formData.access_end_time ?? ''}
                        onChange={(e) => updateField('access_end_time', e.target.value || null)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Allowed Days</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const currentDays = formData.allowed_days ?? getEffectiveValue('allowed_days') ?? [];
                        const isChecked = currentDays.includes(day.value);
                        
                        return (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={day.value}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  updateField('allowed_days', [...currentDays, day.value]);
                                } else {
                                  updateField('allowed_days', currentDays.filter(d => d !== day.value));
                                }
                              }}
                            />
                            <Label htmlFor={day.value} className="text-sm font-normal">
                              {day.label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    IP Restrictions
                  </CardTitle>
                  <CardDescription>Restrict access by IP address</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip_whitelist">IP Whitelist</Label>
                    <Input
                      id="ip_whitelist"
                      placeholder="192.168.1.1, 10.0.0.0/24"
                      value={(formData.ip_whitelist ?? []).join(', ')}
                      onChange={(e) => {
                        const ips = e.target.value.split(',').map(ip => ip.trim()).filter(Boolean);
                        updateField('ip_whitelist', ips.length > 0 ? ips : null);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated IPs or CIDR ranges. Leave empty for no restriction.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ip_blacklist">IP Blacklist</Label>
                    <Input
                      id="ip_blacklist"
                      placeholder="192.168.1.100, 10.0.0.50"
                      value={(formData.ip_blacklist ?? []).join(', ')}
                      onChange={(e) => {
                        const ips = e.target.value.split(',').map(ip => ip.trim()).filter(Boolean);
                        updateField('ip_blacklist', ips.length > 0 ? ips : null);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Block specific IPs even if whitelisted</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MFA Settings Tab */}
            <TabsContent value="mfa" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    Multi-Factor Authentication
                  </CardTitle>
                  <CardDescription>Configure MFA requirements for this user</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="mfa_required">Require MFA</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Force this user to use multi-factor authentication
                      </p>
                    </div>
                    <Switch
                      id="mfa_required"
                      checked={formData.mfa_required ?? getEffectiveValue('mfa_required')}
                      onCheckedChange={(checked) => updateField('mfa_required', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mfa_method">MFA Method</Label>
                      <Select
                        value={formData.mfa_method ?? getEffectiveValue('mfa_method')}
                        onValueChange={(value) => updateField('mfa_method', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="totp">Authenticator App</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfa_pin_expiry">PIN Expiry (minutes)</Label>
                      <Input
                        id="mfa_pin_expiry"
                        type="number"
                        min={1}
                        max={30}
                        value={formData.mfa_pin_expiry_minutes ?? getEffectiveValue('mfa_pin_expiry_minutes')}
                        onChange={(e) => updateField('mfa_pin_expiry_minutes', parseInt(e.target.value) || 5)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfa_max_attempts">Max Attempts</Label>
                      <Input
                        id="mfa_max_attempts"
                        type="number"
                        min={1}
                        max={10}
                        value={formData.mfa_max_attempts ?? getEffectiveValue('mfa_max_attempts')}
                        onChange={(e) => updateField('mfa_max_attempts', parseInt(e.target.value) || 3)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
            )}

            {/* Show message when template settings are active */}
            {formData.security_template_id && formData.use_template_settings && (
              <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Template Settings Active</p>
                  <p className="text-xs text-muted-foreground">
                    Security parameters from the assigned template are being used. 
                    Turn off "Use Template Settings" to customize individual parameters.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Parameters
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
