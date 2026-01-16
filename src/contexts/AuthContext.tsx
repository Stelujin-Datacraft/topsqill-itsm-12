
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
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
  pendingMfa: { userId: string; email: string } | null;
  passwordExpired: boolean;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; organization_id: string }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any; requiresMfa?: boolean; passwordExpired?: boolean }>;
  signOut: () => Promise<void>;
  registerOrganization: (orgData: { name: string; domain: string; description?: string; admin_email: string; admin_password: string; admin_first_name: string; admin_last_name: string }) => Promise<{ error: any }>;
  requestToJoinOrganization: (orgId: string, userData: { email: string; first_name: string; last_name: string; message?: string }) => Promise<{ error: any }>;
  completeMfaVerification: () => void;
  clearPasswordExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMfa, setPendingMfa] = useState<{ userId: string; email: string } | null>(null);
  const [passwordExpired, setPasswordExpired] = useState(false);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return;
      }

      if (!profile) {
        setUserProfile(null);
        setOrganization(null);
        return;
      }

      setUserProfile(profile as UserProfile);

      if (profile.organization_id) {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle();

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
      setUserProfile(null);
      setOrganization(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            loadUserProfile(session.user.id);
          }, 100);
        } else {
          setUserProfile(null);
          setOrganization(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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

  const registerOrganization = async (orgData: { 
    name: string; 
    domain: string; 
    description?: string; 
    admin_email: string; 
    admin_password: string; 
    admin_first_name: string; 
    admin_last_name: string 
  }) => {
    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgData.name,
          domain: orgData.domain,
          description: orgData.description,
          admin_email: orgData.admin_email,
          status: 'active'
        })
        .select()
        .single();

      if (orgError) {
        return { error: orgError };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: orgData.admin_email,
        password: orgData.admin_password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: orgData.admin_first_name,
            last_name: orgData.admin_last_name,
            organization_id: org.id,
            role: 'admin'
          }
        }
      });

      if (authError) {
        return { error: authError };
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email: authData.user.email!,
            first_name: orgData.admin_first_name,
            last_name: orgData.admin_last_name,
            organization_id: org.id,
            role: 'admin',
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

  const completeMfaVerification = async () => {
    if (pendingMfa && user) {
      // MFA verified - record successful login and create session
      await recordSuccessfulLogin(user.id);
      if (session) {
        await createSession(user.id, session.access_token);
      }
      setPendingMfa(null);
    }
  };

  const clearPasswordExpired = () => {
    setPasswordExpired(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      organization,
      session,
      isLoading,
      pendingMfa,
      passwordExpired,
      signUp,
      signIn,
      signOut,
      registerOrganization,
      requestToJoinOrganization,
      completeMfaVerification,
      clearPasswordExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
