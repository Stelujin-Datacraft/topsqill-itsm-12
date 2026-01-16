import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Clock } from 'lucide-react';

const PasswordExpiryWarning: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!user || hasChecked) return;

    const checkPasswordExpiry = async () => {
      try {
        // Get user security parameters
        const { data: securityParams, error: securityError } = await supabase
          .from('user_security_parameters')
          .select('last_password_change, password_expiry_days, password_expiry_warning_days')
          .eq('user_id', user.id)
          .single();

        if (securityError && securityError.code !== 'PGRST116') {
          console.error('Error checking password expiry:', securityError);
          return;
        }

        if (!securityParams?.last_password_change || !securityParams?.password_expiry_days) {
          return;
        }

        const lastPasswordChange = new Date(securityParams.last_password_change);
        const expiryDays = securityParams.password_expiry_days;
        const warningDays = securityParams.password_expiry_warning_days || 7;

        const expiryDate = new Date(lastPasswordChange);
        expiryDate.setDate(expiryDate.getDate() + expiryDays);

        const now = new Date();
        const timeDiff = expiryDate.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        // Show warning if within warning period but not yet expired
        if (daysUntilExpiry > 0 && daysUntilExpiry <= warningDays) {
          setDaysRemaining(daysUntilExpiry);
          setShowWarning(true);
        }
      } catch (error) {
        console.error('Error checking password expiry:', error);
      } finally {
        setHasChecked(true);
      }
    };

    // Delay the check to avoid blocking the initial render
    const timer = setTimeout(checkPasswordExpiry, 2000);
    return () => clearTimeout(timer);
  }, [user, hasChecked]);

  const handleChangePassword = () => {
    setShowWarning(false);
    navigate('/change-password');
  };

  const handleDismiss = () => {
    setShowWarning(false);
  };

  if (!showWarning || daysRemaining === null) return null;

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Password Expiring Soon
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Clock className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {daysRemaining === 1
                    ? 'Your password expires tomorrow!'
                    : `Your password expires in ${daysRemaining} days`}
                </span>
              </div>
              <p className="text-muted-foreground">
                For security reasons, we recommend changing your password before it expires.
                You will be required to change your password after it expires to continue using the application.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss}>Remind me later</AlertDialogCancel>
          <AlertDialogAction onClick={handleChangePassword}>
            Change Password Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PasswordExpiryWarning;
