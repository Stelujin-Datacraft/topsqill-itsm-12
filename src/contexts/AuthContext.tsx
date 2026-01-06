
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

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
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; organization_id: string }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  registerOrganization: (orgData: { name: string; domain: string; description?: string; admin_email: string; admin_password: string; admin_first_name: string; admin_last_name: string }) => Promise<{ error: any }>;
  requestToJoinOrganization: (orgId: string, userData: { email: string; first_name: string; last_name: string; message?: string }) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      setOrganization(null);
      setSession(null);
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

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      organization,
      session,
      isLoading,
      signUp,
      signIn,
      signOut,
      registerOrganization,
      requestToJoinOrganization,
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
