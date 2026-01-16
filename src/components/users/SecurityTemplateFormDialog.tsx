import { useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Shield, 
  Key, 
  Clock, 
  Lock, 
  Smartphone, 
  Globe, 
  Save,
  FileText
} from 'lucide-react';
import { SecurityTemplate, SecurityTemplateInput } from '@/hooks/useSecurityTemplates';

interface SecurityTemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: SecurityTemplate;
  defaultValues: SecurityTemplateInput;
  onSave: (data: SecurityTemplateInput) => Promise<boolean>;
  saving: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

export function SecurityTemplateFormDialog({
  open,
  onOpenChange,
  template,
  defaultValues,
  onSave,
  saving,
}: SecurityTemplateFormDialogProps) {
  const [formData, setFormData] = useState<SecurityTemplateInput>(
    template ? { ...template } : { ...defaultValues }
  );

  const handleSave = async () => {
    if (!formData.name.trim()) {
      return;
    }
    const success = await onSave(formData);
    if (success) {
      onOpenChange(false);
    }
  };

  const updateField = <K extends keyof SecurityTemplateInput>(
    key: K,
    value: SecurityTemplateInput[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
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
              <DialogTitle className="text-xl">
                {template ? 'Edit Security Template' : 'Create Security Template'}
              </DialogTitle>
              <DialogDescription>
                {template ? 'Modify the security template settings' : 'Create a reusable security profile'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Template Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g., Standard User, Contractor"
                  />
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label htmlFor="is_default">Set as Default</Label>
                  <Switch
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => updateField('is_default', checked)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => updateField('description', e.target.value || null)}
                  placeholder="Describe when this template should be used..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

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
                  <CardTitle className="text-base">Password Complexity</CardTitle>
                  <CardDescription>Configure password strength requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Length</Label>
                      <Input
                        type="number"
                        min={6}
                        max={32}
                        value={formData.password_min_length}
                        onChange={(e) => updateField('password_min_length', parseInt(e.target.value) || 9)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password History</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={formData.password_history_count}
                        onChange={(e) => updateField('password_history_count', parseInt(e.target.value) || 20)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label>Require Uppercase</Label>
                      <Switch
                        checked={formData.password_require_uppercase}
                        onCheckedChange={(checked) => updateField('password_require_uppercase', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Lowercase</Label>
                      <Switch
                        checked={formData.password_require_lowercase}
                        onCheckedChange={(checked) => updateField('password_require_lowercase', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Numbers</Label>
                      <Switch
                        checked={formData.password_require_numbers}
                        onCheckedChange={(checked) => updateField('password_require_numbers', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Special</Label>
                      <Switch
                        checked={formData.password_require_special}
                        onCheckedChange={(checked) => updateField('password_require_special', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Password Lifecycle</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Expiry (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={formData.password_expiry_days}
                        onChange={(e) => updateField('password_expiry_days', parseInt(e.target.value) || 90)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Warning (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={formData.password_expiry_warning_days}
                        onChange={(e) => updateField('password_expiry_warning_days', parseInt(e.target.value) || 14)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Change (hours)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={168}
                        value={formData.password_change_min_hours}
                        onChange={(e) => updateField('password_change_min_hours', parseInt(e.target.value) || 24)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Lockout Tab */}
            <TabsContent value="lockout" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Lockout Policy</CardTitle>
                  <CardDescription>Configure account lockout behavior</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Max Failed Attempts</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.max_failed_login_attempts}
                        onChange={(e) => updateField('max_failed_login_attempts', parseInt(e.target.value) || 3)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lockout Duration (minutes)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={formData.lockout_duration_minutes}
                        onChange={(e) => updateField('lockout_duration_minutes', parseInt(e.target.value) || 30)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Session Management Tab */}
            <TabsContent value="session" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Session Timeout</CardTitle>
                  <CardDescription>Configure session expiration behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Timeout (minutes)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={formData.session_timeout_minutes}
                        onChange={(e) => updateField('session_timeout_minutes', parseInt(e.target.value) || 30)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Warning (seconds)</Label>
                      <Input
                        type="number"
                        min={30}
                        max={300}
                        value={formData.session_timeout_warning_seconds}
                        onChange={(e) => updateField('session_timeout_warning_seconds', parseInt(e.target.value) || 60)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Sessions</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.max_concurrent_sessions}
                        onChange={(e) => updateField('max_concurrent_sessions', parseInt(e.target.value) || 3)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Static Session Timeout</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Force logout after timeout regardless of activity
                      </p>
                    </div>
                    <Switch
                      checked={formData.static_session_timeout}
                      onCheckedChange={(checked) => updateField('static_session_timeout', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Access Restrictions Tab */}
            <TabsContent value="access" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Time-Based Access</CardTitle>
                  <CardDescription>Restrict login to specific hours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Access Start Time</Label>
                      <Input
                        type="time"
                        value={formData.access_start_time ?? ''}
                        onChange={(e) => updateField('access_start_time', e.target.value || null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access End Time</Label>
                      <Input
                        type="time"
                        value={formData.access_end_time ?? ''}
                        onChange={(e) => updateField('access_end_time', e.target.value || null)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Allowed Days</Label>
                    <div className="flex flex-wrap gap-3">
                      {DAYS_OF_WEEK.map((day) => {
                        const isChecked = formData.allowed_days?.includes(day.value) ?? false;
                        return (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`template-${day.value}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  updateField('allowed_days', [...(formData.allowed_days || []), day.value]);
                                } else {
                                  updateField('allowed_days', (formData.allowed_days || []).filter(d => d !== day.value));
                                }
                              }}
                            />
                            <Label htmlFor={`template-${day.value}`} className="text-sm font-normal">
                              {day.label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MFA Settings Tab */}
            <TabsContent value="mfa" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Multi-Factor Authentication</CardTitle>
                  <CardDescription>Configure MFA requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require MFA</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Force users with this template to use MFA
                      </p>
                    </div>
                    <Switch
                      checked={formData.mfa_required}
                      onCheckedChange={(checked) => updateField('mfa_required', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>MFA Method</Label>
                      <Select
                        value={formData.mfa_method}
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
                      <Label>PIN Expiry (minutes)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.mfa_pin_expiry_minutes}
                        onChange={(e) => updateField('mfa_pin_expiry_minutes', parseInt(e.target.value) || 5)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Attempts</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.mfa_max_attempts}
                        onChange={(e) => updateField('mfa_max_attempts', parseInt(e.target.value) || 3)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {template ? 'Update Template' : 'Create Template'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
