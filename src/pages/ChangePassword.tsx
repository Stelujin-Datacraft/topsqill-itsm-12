import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword, DEFAULT_PASSWORD_POLICY } from '@/utils/passwordValidation';
import { getUserPasswordPolicy } from '@/utils/securityEnforcement';
import { Lock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ChangePassword = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState(DEFAULT_PASSWORD_POLICY);
  const [lastPasswordChange, setLastPasswordChange] = useState<Date | null>(null);
  const [minChangeHours, setMinChangeHours] = useState(24);
  const [canChangePassword, setCanChangePassword] = useState(true);
  const [hoursUntilChange, setHoursUntilChange] = useState(0);
  const [isResetMode, setIsResetMode] = useState(false);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(true);
  const [recoveryUser, setRecoveryUser] = useState<any>(null);

  useEffect(() => {
    // Check if this is a password reset flow (user came from email link)
    const checkRecoveryFlow = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      console.log('ChangePassword: Checking reset mode', { accessToken: !!accessToken, type, hash: window.location.hash });
      
      if (accessToken && type === 'recovery') {
        setIsResetMode(true);
        try {
          // Set the session from the recovery token
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          });
          
          if (error) {
            console.error('Error setting session:', error);
            toast({
              title: 'Session Error',
              description: 'Invalid or expired reset link. Please request a new one.',
              variant: 'destructive',
            });
            navigate('/forgot-password');
          } else if (data.user) {
            console.log('Session set successfully for password reset, user:', data.user.email);
            setRecoveryUser(data.user);
            // Load policy for the recovered user
            loadPasswordPolicyForUser(data.user.id);
          }
        } catch (err) {
          console.error('Recovery flow error:', err);
        }
      }
      setIsCheckingRecovery(false);
    };

    checkRecoveryFlow();
  }, []);

  useEffect(() => {
    if (user && !policyLoaded) {
      loadPasswordPolicyForUser(user.id);
    }
  }, [user, policyLoaded]);

  const loadPasswordPolicyForUser = async (userId: string) => {
    const policy = await getUserPasswordPolicy(userId);
    if (policy) {
      setPasswordPolicy({
        password_min_length: policy.password_min_length,
        password_require_uppercase: policy.password_require_uppercase,
        password_require_lowercase: policy.password_require_lowercase,
        password_require_numbers: policy.password_require_numbers,
        password_require_special: policy.password_require_special,
      });
      setMinChangeHours(policy.password_change_min_hours);
    }
    setPolicyLoaded(true);

    // Only check minimum change time for regular password changes, not resets
    if (!isResetMode) {
      const { data: securityParams } = await supabase
        .from('user_security_parameters')
        .select('last_password_change')
        .eq('user_id', userId)
        .maybeSingle();

      if (securityParams?.last_password_change) {
        const lastChange = new Date(securityParams.last_password_change);
        setLastPasswordChange(lastChange);

        const minMs = (policy?.password_change_min_hours || 24) * 60 * 60 * 1000;
        const timeSinceChange = Date.now() - lastChange.getTime();

        if (timeSinceChange < minMs) {
          setCanChangePassword(false);
          setHoursUntilChange(Math.ceil((minMs - timeSinceChange) / (60 * 60 * 1000)));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeUser = user || recoveryUser;
    
    if (!activeUser && !isResetMode) {
      toast({
        title: 'Error',
        description: 'You must be logged in to change your password',
        variant: 'destructive',
      });
      return;
    }

    if (!canChangePassword && !isResetMode) {
      toast({
        title: 'Password change restricted',
        description: `You must wait ${hoursUntilChange} more hours before changing your password again.`,
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical',
        variant: 'destructive',
      });
      return;
    }

    // Validate password against policy
    const validation = validatePassword(newPassword, passwordPolicy);
    if (!validation.isValid) {
      toast({
        title: 'Password does not meet requirements',
        description: validation.errors[0],
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // For reset mode, we don't need to verify current password
      if (!isResetMode && user) {
        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: currentPassword,
        });

        if (signInError) {
          toast({
            title: 'Current password incorrect',
            description: 'Please enter your correct current password',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast({
          title: 'Password update failed',
          description: updateError.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Get current user after password update
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        // Store password in history
        await supabase
          .from('password_history')
          .insert({
            user_id: currentUser.id,
            password_hash: btoa(newPassword),
          });

        // Update last password change timestamp
        await supabase
          .from('user_security_parameters')
          .update({
            last_password_change: new Date().toISOString(),
          })
          .eq('user_id', currentUser.id);

        // Log audit event
        await supabase.from('audit_logs').insert({
          user_id: currentUser.id,
          event_type: isResetMode ? 'password_reset' : 'password_changed',
          event_category: 'security',
          description: isResetMode ? 'User reset their password' : 'User changed their password',
        });
      }

      toast({
        title: 'Password updated',
        description: 'Your password has been successfully changed',
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  // Show loading while checking for recovery flow
  if (isCheckingRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show login prompt only if not in reset mode and no user
  const activeUser = user || recoveryUser;
  if (!activeUser && !isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-muted-foreground">Please log in to change your password</p>
            <Link to="/login">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isResetMode ? 'Reset Password' : 'Change Password'}
          </CardTitle>
          <CardDescription>
            {isResetMode 
              ? 'Enter your new password below'
              : 'Update your password to keep your account secure'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canChangePassword && !isResetMode && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You must wait {hoursUntilChange} more hours before you can change your password again.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={!canChangePassword}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={!canChangePassword && !isResetMode}
              />
              {newPassword && (
                <PasswordStrengthIndicator
                  password={newPassword}
                  policy={passwordPolicy}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={!canChangePassword && !isResetMode}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || (!canChangePassword && !isResetMode)}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate((user || recoveryUser) ? '/dashboard' : '/login')}
            >
              Cancel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;
