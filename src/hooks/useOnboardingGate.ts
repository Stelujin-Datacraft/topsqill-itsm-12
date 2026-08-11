import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { backend as supabase } from '@/services/api';

const storageKeyFor = (userId: string, organizationId: string) =>
  `topsqill-workspace-unlocked:${userId}:${organizationId}`;

function readUnlocked(userId: string, organizationId: string): boolean {
  try {
    return localStorage.getItem(storageKeyFor(userId, organizationId)) === '1';
  } catch {
    return false;
  }
}

function isFormWorkspacePath(pathname: string) {
  return (
    pathname.startsWith('/forms') ||
    pathname.startsWith('/form-builder') ||
    pathname.startsWith('/form-edit') ||
    pathname.startsWith('/form/')
  );
}

/**
 * New-user / onboarding gate:
 * - Fresh start (nothing created yet): AI Builder only, no left nav
 * - After a form is created: unlock via modal CTA ("see more features")
 * - Existing orgs that already have forms are treated as unlocked
 */
export function useOnboardingGate() {
  const { user, userProfile } = useAuth();
  const location = useLocation();
  const organizationId = userProfile?.organization_id;
  const userId = user?.id;

  const [workspaceUnlocked, setWorkspaceUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  const unlockWorkspace = useCallback(() => {
    if (!userId || !organizationId) return;
    try {
      localStorage.setItem(storageKeyFor(userId, organizationId), '1');
    } catch {
      /* ignore */
    }
    setWorkspaceUnlocked(true);
  }, [userId, organizationId]);

  useEffect(() => {
    if (!userId || !organizationId) {
      setWorkspaceUnlocked(false);
      setChecking(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      if (readUnlocked(userId, organizationId)) {
        if (!cancelled) {
          setWorkspaceUnlocked(true);
          setChecking(false);
        }
        return;
      }

      // Returning users who already have forms should not be stuck in AI Builder-only mode.
      try {
        const { count, error } = await supabase
          .from('forms')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId);

        if (!cancelled && !error && (count ?? 0) > 0) {
          try {
            localStorage.setItem(storageKeyFor(userId, organizationId), '1');
          } catch {
            /* ignore */
          }
          setWorkspaceUnlocked(true);
        } else if (!cancelled) {
          setWorkspaceUnlocked(false);
        }
      } catch {
        if (!cancelled) setWorkspaceUnlocked(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [userId, organizationId]);

  // localStorage is the source of truth across hook instances (layout vs AI Builder).
  // Re-read when the route changes so unlock + navigate shows the sidebar immediately.
  const unlocked = useMemo(() => {
    if (workspaceUnlocked) return true;
    if (!userId || !organizationId) return false;
    return readUnlocked(userId, organizationId);
  }, [workspaceUnlocked, userId, organizationId, location.pathname]);

  useEffect(() => {
    if (unlocked && !workspaceUnlocked) {
      setWorkspaceUnlocked(true);
    }
  }, [unlocked, workspaceUnlocked]);

  const inAiBuilderOnly = !!organizationId && !unlocked && !checking;

  return {
    checking,
    hasForms: unlocked,
    /** True until the user unlocks via the form-created modal CTA. */
    isNewUser: inAiBuilderOnly,
    workspaceUnlocked: unlocked,
    unlockWorkspace,
    isFormWorkspacePath: isFormWorkspacePath(location.pathname),
  };
}
