import { Navigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { isReLeadgenUiEnabled } from '@/lib/re/feature';
import { reApi } from '@/lib/re/api';

/**
 * Blocks /re routes when the client or Nest feature flag is off.
 * Existing TopSqill routes are unaffected.
 */
export function ReLeadgenGate({ children }: { children: ReactNode }) {
  const clientEnabled = isReLeadgenUiEnabled();
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
        const avail = await reApi.availability();
        if (!cancelled) {
          setServerEnabled(!!avail?.enabled);
          setChecked(true);
        }
      } catch {
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

  if (!checked || serverEnabled === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Checking Real Estate access…
      </div>
    );
  }

  if (!clientEnabled || !serverEnabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
