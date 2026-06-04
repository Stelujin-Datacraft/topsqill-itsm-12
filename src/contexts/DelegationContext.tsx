import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface DelegationRow {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  scope: 'all' | 'form' | 'project' | 'submission';
  scope_form_id: string | null;
  scope_project_id: string | null;
  scope_submission_id?: string | null;
  starts_at: string;
  ends_at: string;
  include_approvals: boolean;
  active: boolean;
}

export interface DelegatorOption {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  delegations: DelegationRow[];
}

interface DelegationContextType {
  loading: boolean;
  /** Active delegations where current user is the delegate */
  delegationsForMe: DelegationRow[];
  /** Active delegations where current user is the delegator */
  myDelegations: DelegationRow[];
  /** Distinct delegators the user can currently act on behalf of */
  delegators: DelegatorOption[];
  /** Currently selected delegator (null = act as self) */
  actingAs: DelegatorOption | null;
  setActingAs: (delegator: DelegatorOption | null) => void;
  /** True if the current user is acting on behalf of someone */
  isActingOnBehalf: boolean;
  /** Returns true if the current delegation covers the given form/project/submission */
  delegationCoversScope: (formId?: string | null, projectId?: string | null, submissionId?: string | null) => boolean;
  reload: () => Promise<void>;
}

const DelegationContext = createContext<DelegationContextType | undefined>(undefined);

const STORAGE_KEY = 'lovable:acting-as-delegator';

export const DelegationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [delegationsForMe, setDelegationsForMe] = useState<DelegationRow[]>([]);
  const [myDelegations, setMyDelegations] = useState<DelegationRow[]>([]);
  const [delegators, setDelegators] = useState<DelegatorOption[]>([]);
  const [actingAs, setActingAsState] = useState<DelegatorOption | null>(null);
  const [loading, setLoading] = useState(true);

  const isWindowActive = (row: DelegationRow) => {
    const now = Date.now();
    return row.active && new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() > now;
  };

  const load = useCallback(async () => {
    if (!userProfile?.id) {
      setDelegationsForMe([]); setMyDelegations([]); setDelegators([]); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [recvRes, mineRes] = await Promise.all([
        supabase.from('record_delegations').select('*').eq('delegate_user_id', userProfile.id).eq('active', true),
        supabase.from('record_delegations').select('*').eq('delegator_user_id', userProfile.id).eq('active', true),
      ]);
      if (recvRes.error) throw recvRes.error;
      if (mineRes.error) throw mineRes.error;

      const recv = (recvRes.data || []).filter(isWindowActive) as DelegationRow[];
      const mine = (mineRes.data || []).filter(isWindowActive) as DelegationRow[];

      setDelegationsForMe(recv);
      setMyDelegations(mine);

      // Build delegators list
      const ids = Array.from(new Set(recv.map(r => r.delegator_user_id)));
      if (ids.length) {
        const { data: usrs } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name')
          .in('id', ids);
        const opts: DelegatorOption[] = (usrs || []).map(u => ({
          ...u,
          delegations: recv.filter(r => r.delegator_user_id === u.id),
        }));
        setDelegators(opts);

        // Restore acting-as from storage if still valid
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const match = opts.find(o => o.id === stored);
          if (match) setActingAsState(match);
          else sessionStorage.removeItem(STORAGE_KEY);
        }
      } else {
        setDelegators([]);
        setActingAsState(null);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e: any) {
      console.error('DelegationContext load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when delegations change for this user
  useEffect(() => {
    if (!userProfile?.id) return;
    const channel = supabase
      .channel(`delegations:${userProfile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'record_delegations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfile?.id, load]);

  const setActingAs = useCallback((d: DelegatorOption | null) => {
    setActingAsState(d);
    if (d) {
      sessionStorage.setItem(STORAGE_KEY, d.id);
      const name = d.first_name || d.last_name ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() : d.email;
      toast.success(`Now acting on behalf of ${name}`);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success('Stopped acting on behalf');
    }
  }, []);

  const delegationCoversScope = useCallback((formId?: string | null, projectId?: string | null, submissionId?: string | null) => {
    if (!actingAs) return false;
    return actingAs.delegations.some(d => {
      if (d.scope === 'all') return true;
      if (d.scope === 'form' && formId && d.scope_form_id === formId) return true;
      if (d.scope === 'project' && projectId && d.scope_project_id === projectId) return true;
      if (d.scope === 'submission' && submissionId && d.scope_submission_id === submissionId) return true;
      return false;
    });
  }, [actingAs]);

  const value = useMemo<DelegationContextType>(() => ({
    loading,
    delegationsForMe,
    myDelegations,
    delegators,
    actingAs,
    setActingAs,
    isActingOnBehalf: !!actingAs,
    delegationCoversScope,
    reload: load,
  }), [loading, delegationsForMe, myDelegations, delegators, actingAs, setActingAs, delegationCoversScope, load]);

  return <DelegationContext.Provider value={value}>{children}</DelegationContext.Provider>;
};

export const useDelegation = (): DelegationContextType => {
  const ctx = useContext(DelegationContext);
  if (!ctx) {
    return {
      loading: false,
      delegationsForMe: [],
      myDelegations: [],
      delegators: [],
      actingAs: null,
      setActingAs: () => {},
      isActingOnBehalf: false,
      delegationCoversScope: () => false,
      reload: async () => {},
    };
  }
  return ctx;
};