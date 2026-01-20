import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Clock, Key, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface SecuritySettings {
  mfa_required: boolean | null;
  max_concurrent_sessions: number | null;
  session_timeout_minutes: number | null;
  access_start_time: string | null;
  access_end_time: string | null;
  allowed_days: string[] | null;
  security_template_name: string | null;
  use_template_settings: boolean | null;
  account_locked_until: string | null;
  last_login: string | null;
  last_password_change: string | null;
}

interface SecurityTabProps {
  securitySettings: SecuritySettings | null;
  loading?: boolean;
}

export function SecurityTab({ securitySettings, loading }: SecurityTabProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!securitySettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No security parameters configured for this user</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLocked = securitySettings.account_locked_until && 
    new Date(securitySettings.account_locked_until) > new Date();

  return (
    <div className="space-y-6">
      {/* Account Status */}
      {isLocked && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-medium">Account Locked</p>
                <p className="text-sm">
                  Until {format(new Date(securitySettings.account_locked_until!), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Configuration</CardTitle>
          <CardDescription>
            {securitySettings.use_template_settings 
              ? `Settings inherited from template: ${securitySettings.security_template_name || 'Unknown'}`
              : 'Custom security settings'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* MFA Status */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Key className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">MFA Required</p>
                <Badge variant={securitySettings.mfa_required ? 'default' : 'secondary'}>
                  {securitySettings.mfa_required ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>

            {/* Session Limits */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Max Concurrent Sessions</p>
                <p className="text-lg font-semibold">
                  {securitySettings.max_concurrent_sessions || 'Unlimited'}
                </p>
              </div>
            </div>

            {/* Session Timeout */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Session Timeout</p>
                <p className="text-lg font-semibold">
                  {securitySettings.session_timeout_minutes 
                    ? `${securitySettings.session_timeout_minutes} min`
                    : 'Default'}
                </p>
              </div>
            </div>

            {/* Access Time Restrictions */}
            {(securitySettings.access_start_time || securitySettings.access_end_time) && (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Access Hours</p>
                  <p className="text-sm">
                    {securitySettings.access_start_time || '00:00'} - {securitySettings.access_end_time || '23:59'}
                  </p>
                </div>
              </div>
            )}

            {/* Allowed Days */}
            {securitySettings.allowed_days && securitySettings.allowed_days.length > 0 && (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg md:col-span-2">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Allowed Days</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {securitySettings.allowed_days.map((day) => (
                      <Badge key={day} variant="outline" className="capitalize">
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Last Login</p>
              <p className="font-medium">
                {securitySettings.last_login 
                  ? format(new Date(securitySettings.last_login), 'MMM d, yyyy HH:mm')
                  : 'Never'}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Last Password Change</p>
              <p className="font-medium">
                {securitySettings.last_password_change 
                  ? format(new Date(securitySettings.last_password_change), 'MMM d, yyyy')
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
