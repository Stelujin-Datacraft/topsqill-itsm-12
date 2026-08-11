import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const storageKeyFor = (userId: string, organizationId: string) =>
  `topsqill-workspace-unlocked:${userId}:${organizationId}`;

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
 * - AI Builder (`/build`) stays chat-only with no left nav
 * - Left nav unlocks only after the user opens a created form (See Form)
 */
export function useOnboardingGate() {
  const { user, userProfile } = useAuth();
  const location = useLocation();
  const organizationId = userProfile?.organization_id;
  const userId = user?.id;

  const [workspaceUnlocked, setWorkspaceUnlocked] = useState(false);

  useEffect(() => {
    if (!userId || !organizationId) {
      setWorkspaceUnlocked(false);
      return;
    }
    try {
      setWorkspaceUnlocked(localStorage.getItem(storageKeyFor(userId, organizationId)) === '1');
    } catch {
      setWorkspaceUnlocked(false);
    }
  }, [userId, organizationId]);

  const unlockWorkspace = useCallback(() => {
    if (!userId || !organizationId) return;
    try {
      localStorage.setItem(storageKeyFor(userId, organizationId), '1');
    } catch {
      /* ignore */
    }
    setWorkspaceUnlocked(true);
  }, [userId, organizationId]);

  // Opening a form is the unlock moment for the full left nav / modules.
  useEffect(() => {
    if (!userId || !organizationId) return;
    if (isFormWorkspacePath(location.pathname)) {
      unlockWorkspace();
    }
  }, [location.pathname, userId, organizationId, unlockWorkspace]);

  const inAiBuilderOnly = !!organizationId && !workspaceUnlocked;

  return {
    checking: false,
    hasForms: workspaceUnlocked,
    /** True until the user opens a created form — AI Builder has no left nav. */
    isNewUser: inAiBuilderOnly,
    workspaceUnlocked,
    unlockWorkspace,
    isFormWorkspacePath: isFormWorkspacePath(location.pathname),
  };
}
