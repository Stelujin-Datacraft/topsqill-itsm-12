import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Mail, Smartphone, RefreshCw, CheckCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MfaSettings {
  mfa_required: boolean;
  mfa_method: string;
}

const MfaSetup: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<string>('email');
  const [hasSecurityParams, setHasSecurityParams] = useState(false);

  useEffect(() => {
    fetchMfaSettings();
  }, [user]);

  const fetchMfaSettings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_security_parameters')
        .select('mfa_required, mfa_method')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setMfaEnabled(data.mfa_required || false);
        setMfaMethod(data.mfa_method || 'email');
        setHasSecurityParams(true);
      } else {
        setHasSecurityParams(false);
      }
    } catch (error) {
      console.error('Error fetching MFA settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMfaSettings = async () => {
    if (!user || !userProfile?.organization_id) {
      toast.error('User or organization not found');
      return;
    }

    setSaving(true);
    try {
      if (hasSecurityParams) {
        const { error } = await supabase
          .from('user_security_parameters')
          .update({
            mfa_required: mfaEnabled,
            mfa_method: mfaMethod,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_security_parameters')
          .insert({
            user_id: user.id,
            organization_id: userProfile.organization_id,
            mfa_required: mfaEnabled,
            mfa_method: mfaMethod
          });

        if (error) throw error;
        setHasSecurityParams(true);
      }

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'mfa_settings_updated',
        event_category: 'security',
        description: `MFA ${mfaEnabled ? 'enabled' : 'disabled'} with method: ${mfaMethod}`,
        metadata: { mfa_enabled: mfaEnabled, mfa_method: mfaMethod }
      });

      toast.success('MFA settings saved successfully');
    } catch (error) {
      console.error('Error saving MFA settings:', error);
      toast.error('Failed to save MFA settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Multi-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account by requiring a verification code when signing in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${mfaEnabled ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
              <Shield className={`h-5 w-5 ${mfaEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <Label htmlFor="mfa-toggle" className="text-base font-medium">
                Enable MFA
              </Label>
              <p className="text-sm text-muted-foreground">
                Require a verification code when signing in
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mfaEnabled && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
            <Switch
              id="mfa-toggle"
              checked={mfaEnabled}
              onCheckedChange={setMfaEnabled}
            />
          </div>
        </div>

        {mfaEnabled && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <Label>Verification Method</Label>
            <Select value={mfaMethod} onValueChange={setMfaMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Email OTP</span>
                  </div>
                </SelectItem>
                <SelectItem value="sms" disabled>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span>SMS OTP (Coming soon)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="p-3 rounded-lg bg-background border">
              {mfaMethod === 'email' && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Email Verification</p>
                    <p className="text-sm text-muted-foreground">
                      A 6-digit code will be sent to your email ({userProfile?.email}) when you sign in.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Button onClick={saveMfaSettings} disabled={saving} className="w-full">
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save MFA Settings'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default MfaSetup;
