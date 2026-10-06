import { Navigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { isPromotionalTransferUiEnabled } from '@/lib/promotion/feature';
import { promotionApi } from '@/lib/promotion/api';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Blocks Promotional Transfer routes when:
 * - this deployment is Production (client flag), or
 * - Nest reports the feature disabled, or
 * - the user is not a System Administrator
 */
export function PromotionalTransferGate({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const clientEnabled = isPromotionalTransferUiEnabled();
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(clientEnabled ? null : false);
  const [checked, setChecked] = useState(!clientEnabled);

  useEffect(() => {
    if (!clientEnabled) {
      setServerEnabled(false);
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const avail = await promotionApi.availability();
        if (!cancelled) {
          setServerEnabled(!!avail?.enabled);
          setChecked(true);
        }
      } catch {
        // If availability cannot be confirmed, fail closed for non-dev UI builds;
        // for local DEV keep client gate so local work is not blocked by Nest downtime.
        if (!cancelled) {
          setServerEnabled(import.meta.env.DEV ? true : false);
          setChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientEnabled]);

  if (userProfile && userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!clientEnabled) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!checked) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking Promotional Transfer availability…
      </div>
    );
  }

  if (serverEnabled === false) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
