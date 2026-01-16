import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionTimeoutSettings } from '@/utils/securityEnforcement';

export function SessionTimeoutWarning() {
  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [settings, setSettings] = useState<{
    timeoutMinutes: number;
    warningSeconds: number;
    staticTimeout: boolean;
  } | null>(null);
  
  const lastActivityRef = useRef(Date.now());
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.id) {
        const userSettings = await getSessionTimeoutSettings(user.id);
        setSettings(userSettings);
      }
    };
    loadSettings();
  }, [user?.id]);

  // Reset activity timer
  const resetActivityTimer = useCallback(() => {
    if (!settings || settings.staticTimeout) return; // Don't reset if static timeout
    
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    
    // Clear existing timeouts
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    // Set new warning timeout
    const warningTime = (settings.timeoutMinutes * 60 - settings.warningSeconds) * 1000;
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(settings.warningSeconds);
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningTime);
  }, [settings]);

  // Setup activity listeners
  useEffect(() => {
    if (!settings || !user) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      if (!settings.staticTimeout) {
        resetActivityTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Initial setup
    resetActivityTimer();

    // For static timeout, set up the timer once
    if (settings.staticTimeout) {
      const warningTime = (settings.timeoutMinutes * 60 - settings.warningSeconds) * 1000;
      warningTimeoutRef.current = setTimeout(() => {
        setShowWarning(true);
        setCountdown(settings.warningSeconds);
        
        countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownIntervalRef.current!);
              handleLogout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, warningTime);
    }

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [settings, user, resetActivityTimer]);

  const handleLogout = async () => {
    setShowWarning(false);
    await signOut();
    window.location.href = '/login?reason=timeout';
  };

  const handleExtendSession = () => {
    setShowWarning(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    resetActivityTimer();
  };

  if (!settings || !user) return null;

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Session Expiring Soon
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Your session will expire in{' '}
              <span className="font-bold text-foreground">{countdown} seconds</span> due to inactivity.
            </p>
            <p className="text-sm">
              Click "Stay Logged In" to continue your session, or you will be automatically logged out.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout Now
          </Button>
          <AlertDialogAction onClick={handleExtendSession}>
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
