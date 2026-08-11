
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { backend as supabase, clearAuthTokenCache } from '@/services/api';
import { rawSupabase } from '@/integrations/supabase/rawClient';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchDefaultProjectPermissions } from '@/utils/prefetchPermissions';
 import { usePermissionRealtimeSync } from '@/hooks/usePermissionRealtimeSync';
import { 
  checkAccountLockout, 
  recordFailedLogin, 
  recordSuccessfulLogin,
  checkAccessTimeRestrictions,
  checkMfaRequired,
  checkPasswordExpiry,
  checkConcurrentSessions,
  createSession,
  invalidateSession,
} from '@/utils/securityEnforcement';

interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  organization_id?: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'suspended';
  mobile?: string;
  nationality?: string;
  gender?: string;
  timezone?: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  domain: string;
  description?: string;
  logo_url?: string;
  admin_email: string;
  status: 'active' | 'suspended' | 'pending';
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  organization: Organization | null;
  session: Session | null;
  isLoading: boolean;
  profileError: string | null;
  pendingMfa: { userId: string; email: string } | null;
  passwordExpired: boolean;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; organization_id: string }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any; requiresMfa?: boolean; passwordExpired?: boolean }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  registerOrganization: (orgData: {
    name: string;
    domain?: string;
    description?: string;
    admin_email: string;
    admin_password: string;
    admin_first_name: string;
    admin_last_name: string;
  }) => Promise<{ error: any; needsEmailVerification?: boolean }>;
  requestToJoinOrganization: (orgId: string, userData: { email: string; first_name: string; last_name: string; message?: string }) => Promise<{ error: any }>;
  completeMfaVerification: () => void;
  clearPasswordExpired: () => void;
  retryProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pendingMfa, setPendingMfa] = useState<{ userId: string; email: string } | null>(null);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const latestProfileRequestRef = useRef(0);
  const previousUserIdRef = useRef<string | null>(null);
  const sessionValidationInFlightRef = useRef(false);
  
  // Get query client for prefetching - wrapped in try/catch for safety
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // QueryClient not available (e.g., during SSR or outside provider)
  }

  const loadUserProfile = async (userId: string, retryCount = 0, requestId?: number) => {
    const MAX_RETRIES = 3;
    const activeRequestId = requestId ?? latestProfileRequestRef.current + 1;
    if (requestId === undefined) {
      latestProfileRequestRef.current = activeRequestId;
    }

    const isStaleRequest = () => latestProfileRequestRef.current !== activeRequestId;

    setProfileError(null);
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error loading user profile:', error.message, `(attempt ${retryCount + 1})`);
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          return loadUserProfile(userId, retryCount + 1, activeRequestId);
        }
        if (isStaleRequest()) return;
        setProfileError(error.message);
        return;
      }

      if (isStaleRequest()) return;

      if (!profile) {
        // Auto-create profile for OAuth users (e.g., Google SSO)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.app_metadata?.provider && authUser.app_metadata.provider !== 'email') {
          const email = authUser.email || '';
          const metadata = authUser.user_metadata || {};
          const domain = email.split('@')[1];

          // Try to find org by email domain
          let orgId: string | null = null;
          if (domain) {
            const { data: org } = await supabase
              .from('organizations')
              .select('id')
              .eq('domain', domain)
              .maybeSingle();
            if (org) orgId = org.id;
          }

          const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: userId,
              email,
              first_name: metadata.full_name?.split(' ')[0] || metadata.given_name || '',
              last_name: metadata.full_name?.split(' ').slice(1).join(' ') || metadata.family_name || '',
              organization_id: orgId,
              role: 'user',
              status: 'active',
            })
            .select()
            .single();

          if (!insertError && newProfile) {
            if (isStaleRequest()) return;
            setUserProfile(newProfile as UserProfile);
            if (orgId) {
              const { data: org } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', orgId)
                .maybeSingle();
              if (isStaleRequest()) return;
              setOrganization(org as Organization || null);
            }
            return;
          }
        }
        if (isStaleRequest()) return;
        setUserProfile(null);
        setOrganization(null);
        return;
      }

      if (isStaleRequest()) return;
      setUserProfile(profile as UserProfile);

      if (profile.organization_id) {
        // Prefetch permissions in the background (non-blocking)
        if (queryClient) {
          setTimeout(() => {
            prefetchDefaultProjectPermissions(
              queryClient!,
              userId,
              profile.organization_id
            );
          }, 0);
        }

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle();

        if (isStaleRequest()) return;

        if (orgError) {
          setOrganization(null);
        } else if (org) {
          setOrganization(org as Organization);
        } else {
          setOrganization(null);
        }
      } else {
        setOrganization(null);
      }
    } catch (error) {
      if (isStaleRequest()) return;
      setUserProfile(null);
      setOrganization(null);
    }
  };

  // Function to check if the current session is still valid in the database
  const validateSessionInDb = async (userId: string, accessToken: string) => {
    try {
      // First try to find by exact token match
      let { data: sessionData, error } = await supabase
        .from('user_sessions')
        .select('id, is_active, session_token')
        .eq('session_token', accessToken)
        .maybeSingle();

      // If no exact match, find the most recent active session for this user
      if (!sessionData) {
        const { data: userSession } = await supabase
          .from('user_sessions')
          .select('id, is_active, session_token')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (userSession) {
          // Update the session with the new token (token was refreshed)
          await supabase
            .from('user_sessions')
            .update({ 
              session_token: accessToken,
              last_activity: new Date().toISOString()
            })
            .eq('id', userSession.id);
          return true;
        }
        
        // No active session found for this user - create a new session record
        // This handles cases where user is logged in via Supabase but has no tracked session
        console.log('No active session found, creating new session record');
        await createSession(userId, accessToken);
        return true;
      }

      // If session exists and is inactive, sign out the user
      if (sessionData && sessionData.is_active === false) {
        console.log('Session terminated by admin, logging out');
        await supabase.auth.signOut();
        return false;
      }
      
      // Update last activity
      if (sessionData) {
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', sessionData.id);
      }
      
      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      return true; // Don't log out on validation errors
    }
  };

  useEffect(() => {
    let initialSessionHandled = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION — handled by getSession below
        if (event === 'INITIAL_SESSION') return;

        const nextUserId = session?.user?.id ?? null;
        const previousUserId = previousUserIdRef.current;
        const isSameUserSessionRefresh =
          !!nextUserId &&
          previousUserId === nextUserId &&
          (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN');

        setSession(session);
        setUser(session?.user ?? null);
        previousUserIdRef.current = nextUserId;

        if (session?.user) {
          if (isSameUserSessionRefresh) {
            setIsLoading(false);
            return;
          }

          setTimeout(async () => {
            const isValid = await validateSessionInDb(session.user.id, session.access_token);
            if (isValid) {
              await loadUserProfile(session.user.id);
            }
          }, 100);
        } else {
          setUserProfile(null);
          setOrganization(null);
        }
        setIsLoading(false);
      }
    );

    // Then restore session from storage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (initialSessionHandled) return;
      initialSessionHandled = true;

      setSession(session);
      setUser(session?.user ?? null);
      previousUserIdRef.current = session?.user?.id ?? null;
      if (session?.user) {
        const isValid = await validateSessionInDb(session.user.id, session.access_token);
        if (isValid) {
          await loadUserProfile(session.user.id);
        }
      }
      setIsLoading(false);
    });

    // Periodically check session validity
    const intervalId = setInterval(async () => {
      if (sessionValidationInFlightRef.current) return;

      sessionValidationInFlightRef.current = true;
      const { data: { session } } = await supabase.auth.getSession();
      try {
        if (session?.user?.id && session?.access_token) {
          await validateSessionInDb(session.user.id, session.access_token);
        }
      } finally {
        sessionValidationInFlightRef.current = false;
      }
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  const signUp = async (email: string, password: string, userData: { first_name: string; last_name: string; organization_id: string }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            organization_id: userData.organization_id,
          }
        }
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            first_name: userData.first_name,
            last_name: userData.last_name,
            organization_id: userData.organization_id,
            role: 'user',
            status: 'active'
          });

        if (profileError) {
          return { error: profileError };
        }
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Check account lockout before attempting login
      const lockoutCheck = await checkAccountLockout(email);
      if (!lockoutCheck.allowed) {
        return { 
          error: { 
            message: lockoutCheck.reason || 'Account is locked',
            code: 'account_locked'
          } 
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        // Record failed login attempt
        await recordFailedLogin(email);
        // Log failed login audit event
        await supabase.from('audit_logs').insert({
          event_type: 'login_failed',
          event_category: 'authentication',
          description: `Failed login attempt for ${email}`,
          metadata: { email, error_code: error.code },
        });
        return { error };
      }

      if (data.user) {
        // Check access time restrictions
        const accessCheck = await checkAccessTimeRestrictions(data.user.id);
        if (!accessCheck.allowed) {
          // Sign out immediately if access is restricted
          await supabase.auth.signOut();
          return { 
            error: { 
              message: accessCheck.reason || 'Access is restricted at this time',
              code: 'access_restricted'
            } 
          };
        }

        // Check concurrent sessions
        const sessionCheck = await checkConcurrentSessions(data.user.id);
        if (!sessionCheck.allowed) {
          await supabase.auth.signOut();
          return { 
            error: { 
              message: sessionCheck.reason || 'Maximum concurrent sessions reached',
              code: 'session_limit'
            } 
          };
        }

        // Check if MFA is required
        const mfaRequired = await checkMfaRequired(data.user.id);
        if (mfaRequired) {
          // Don't complete login yet - wait for MFA verification
          setPendingMfa({ userId: data.user.id, email: data.user.email! });
          return { error: null, requiresMfa: true };
        }

        // Check password expiry
        const expiryCheck = await checkPasswordExpiry(data.user.id);
        if (!expiryCheck.allowed && expiryCheck.passwordExpired) {
          setPasswordExpired(true);
          // Record successful login but flag password expiry
          await recordSuccessfulLogin(data.user.id);
          return { error: null, passwordExpired: true };
        }

        // Create session record
        if (data.session) {
          await createSession(data.user.id, data.session.access_token);
        }

        // Record successful login
        await recordSuccessfulLogin(data.user.id);

        // Log audit event
        await supabase.from('audit_logs').insert({
          user_id: data.user.id,
          event_type: 'login_success',
          event_category: 'authentication',
          description: 'User logged in successfully',
        });

        // If signup finished auth but org bootstrap was deferred (e.g. email confirm),
        // complete it now from user metadata.
        const meta = data.user.user_metadata || {};
        if (meta.organization_name) {
          const { data: existingProfile } = await rawSupabase
            .from('user_profiles')
            .select('organization_id')
            .eq('id', data.user.id)
            .maybeSingle();
          if (!existingProfile?.organization_id) {
            const { error: rpcError } = await rawSupabase.rpc('register_new_organization', {
              p_name: meta.organization_name,
              p_domain: meta.organization_domain || null,
              p_description: null,
              p_admin_first_name: meta.first_name || null,
              p_admin_last_name: meta.last_name || null,
            });
            if (rpcError) {
              try {
                await bootstrapOrganizationDirect({
                  userId: data.user.id,
                  email: data.user.email || '',
                  name: meta.organization_name,
                  firstName: meta.first_name || '',
                  lastName: meta.last_name || '',
                  preferredDomain: meta.organization_domain,
                });
              } catch (e) {
                console.warn('Deferred organization bootstrap failed:', e);
              }
            }
          }
        }
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Log audit event before signing out
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          event_type: 'logout',
          event_category: 'authentication',
          description: 'User logged out',
        });
      }
      
      // Invalidate session record
      if (session?.access_token) {
        await invalidateSession(session.access_token);
      }
      
      await supabase.auth.signOut();
      clearAuthTokenCache();
      setUser(null);
      setUserProfile(null);
      setOrganization(null);
      setSession(null);
      setPendingMfa(null);
      setPasswordExpired(false);
    } catch (error) {
      // Silent error handling
    }
  };

  const buildOrgDomain = (orgName: string, email: string, suffix?: string) => {
    const emailDomain = email.split('@')[1]?.trim().toLowerCase() || '';
    const fromName = orgName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const base = fromName || emailDomain.split('.')[0] || 'organization';
    return suffix ? `${base}-${suffix}` : `${base}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const bootstrapOrganizationDirect = async (args: {
    userId: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    preferredDomain?: string;
  }) => {
    // Domain/description are DB columns — not signup form fields.
    // Domain is required by schema; description stays null.
    let lastError: any = null;
    let org: { id: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const domain =
        attempt === 0 && args.preferredDomain
          ? args.preferredDomain
          : buildOrgDomain(args.name, args.email);

      const { data, error } = await rawSupabase
        .from('organizations')
        .insert({
          name: args.name,
          domain,
          description: null,
          admin_email: args.email,
          status: 'active',
        })
        .select('id')
        .single();

      if (!error && data) {
        org = data;
        break;
      }

      lastError = error;
      // Retry on unique/duplicate domain collisions
      const msg = String(error?.message || '');
      if (!/duplicate|unique|already exists/i.test(msg)) {
        break;
      }
    }

    if (!org) {
      throw lastError || new Error('Failed to create organization');
    }

    const { error: profileError } = await rawSupabase
      .from('user_profiles')
      .upsert(
        {
          id: args.userId,
          email: args.email,
          first_name: args.firstName,
          last_name: args.lastName,
          organization_id: org.id,
          role: 'admin',
          status: 'active',
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      throw profileError;
    }

    // Membership (best effort — trigger may already create it)
    await rawSupabase
      .from('user_organizations')
      .upsert(
        {
          user_id: args.userId,
          organization_id: org.id,
          role: 'admin',
        },
        { onConflict: 'user_id,organization_id' },
      );

    // Default project so form creation works immediately
    const { data: project, error: projectError } = await rawSupabase
      .from('projects')
      .insert({
        name: 'Default Project',
        description: null,
        organization_id: org.id,
        created_by: args.userId,
        status: 'active',
      })
      .select('id')
      .single();

    if (!projectError && project?.id) {
      await rawSupabase.from('project_users').insert({
        project_id: project.id,
        user_id: args.userId,
        role: 'admin',
        assigned_by: args.userId,
      });
    }

    return org.id as string;
  };

  const registerOrganization = async (orgData: {
    name: string;
    domain?: string;
    description?: string;
    admin_email: string;
    admin_password: string;
    admin_first_name: string;
    admin_last_name: string;
  }) => {
    try {
      const email = orgData.admin_email.trim();
      const orgName = orgData.name.trim();
      // Auto domain for DB only — never collected from the signup form.
      const autoDomain = buildOrgDomain(orgName, email);

      const { data: authData, error: authError } = await rawSupabase.auth.signUp({
        email,
        password: orgData.admin_password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: orgData.admin_first_name,
            last_name: orgData.admin_last_name,
            role: 'admin',
            organization_name: orgName,
            organization_domain: autoDomain,
          },
        },
      });

      if (authError) {
        const msg = (authError as any)?.message || '';
        if (
          (authError as any)?.code === 'user_already_exists' ||
          /already\s+registered|already\s+exists/i.test(msg)
        ) {
          return {
            error: new Error(
              `An account already exists for ${email}. Use "Forgot Password" to reset it, or sign in with the existing password.`,
            ),
          };
        }
        return { error: authError };
      }

      if (!authData.user) {
        return { error: new Error('Sign up did not return a user account.') };
      }

      // Prefer the signup session; otherwise try password sign-in.
      let session = authData.session;
      if (!session) {
        const { data: signInData, error: signInError } = await rawSupabase.auth.signInWithPassword({
          email,
          password: orgData.admin_password,
        });
        if (!signInError && signInData.session) {
          session = signInData.session;
        }
      }

      // Email confirmation enabled: auth user exists but no session yet.
      // Treat as success — org bootstrap completes on first verified sign-in.
      if (!session) {
        return { error: null, needsEmailVerification: true };
      }

      // Keep backend client auth state in sync
      setSession(session);
      setUser(session.user);

      // 1) Prefer secure RPC (works even with org RLS enabled)
      const { data: orgIdFromRpc, error: rpcError } = await rawSupabase.rpc(
        'register_new_organization',
        {
          p_name: orgName,
          p_domain: autoDomain,
          p_description: null,
          p_admin_first_name: orgData.admin_first_name,
          p_admin_last_name: orgData.admin_last_name,
        },
      );

      if (!rpcError && orgIdFromRpc) {
        await loadUserProfile(session.user.id);
        return { error: null };
      }

      // 2) Fallback: direct inserts (works when org RLS is disabled / permissive)
      try {
        await bootstrapOrganizationDirect({
          userId: session.user.id,
          email,
          name: orgName,
          firstName: orgData.admin_first_name,
          lastName: orgData.admin_last_name,
          preferredDomain: autoDomain,
        });
        await loadUserProfile(session.user.id);
        return { error: null };
      } catch (directError: any) {
        const rpcMsg = rpcError?.message ? `RPC: ${rpcError.message}. ` : '';
        const directMsg = directError?.message || String(directError);
        return {
          error: new Error(
            `${rpcMsg}Organization setup failed: ${directMsg}`,
          ),
        };
      }
    } catch (error) {
      return { error };
    }
  };

  const requestToJoinOrganization = async (orgId: string, userData: { 
    email: string; 
    first_name: string; 
    last_name: string; 
    message?: string 
  }) => {
    try {
      const { error } = await supabase
        .from('organization_requests')
        .insert({
          organization_id: orgId,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          message: userData.message,
          status: 'pending'
        });

      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const completeMfaVerification = async () => {
    if (pendingMfa && user) {
      // MFA verified - record successful login and create session
      await recordSuccessfulLogin(user.id);
      
      // Get the current session from Supabase (state might not be updated yet)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        await createSession(user.id, currentSession.access_token);
      } else if (session) {
        // Fallback to state if available
        await createSession(user.id, session.access_token);
      }
      
      // Log audit event for successful login after MFA verification
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'login_success',
        event_category: 'authentication',
        description: 'User logged in successfully (MFA verified)',
      });
      
      setPendingMfa(null);
    }
  };

  const clearPasswordExpired = () => {
    setPasswordExpired(false);
  };

  const retryProfile = async () => {
    if (user) {
      setProfileError(null);
      await loadUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      organization,
      session,
      isLoading,
      profileError,
      pendingMfa,
      passwordExpired,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      registerOrganization,
      requestToJoinOrganization,
      completeMfaVerification,
      clearPasswordExpired,
      retryProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return a default safe object during hot reload instead of throwing
    return {
      user: null,
      userProfile: null,
      organization: null,
      session: null,
      isLoading: true,
      profileError: null,
      pendingMfa: null,
      passwordExpired: false,
      signUp: async () => ({ error: new Error('AuthProvider not mounted') }),
      signIn: async () => ({ error: new Error('AuthProvider not mounted') }),
      signInWithGoogle: async () => ({ error: new Error('AuthProvider not mounted') }),
      signOut: async () => {},
      registerOrganization: async () => ({ error: new Error('AuthProvider not mounted') }),
      requestToJoinOrganization: async () => ({ error: new Error('AuthProvider not mounted') }),
      completeMfaVerification: () => {},
      clearPasswordExpired: () => {},
      retryProfile: async () => {},
    } as AuthContextType;
  }
  return context;
};
 
 /**
  * Hook to enable real-time permission sync.
  * Call this once at the app root level (e.g., in App.tsx or a layout component).
  */
 export { usePermissionRealtimeSync };
