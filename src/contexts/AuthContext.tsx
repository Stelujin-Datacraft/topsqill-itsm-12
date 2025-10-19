
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
      console.log('Loading user profile for user:', userId);
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle to handle null case gracefully

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      // Handle null case - user profile doesn't exist yet
      if (!profile) {
        console.log('No user profile found for user:', userId);
        setUserProfile(null);
        setOrganization(null);
        return;
      }

      console.log('User profile loaded:', profile);
      setUserProfile(profile as UserProfile);

      // Load organization if user has one
      if (profile.organization_id) {
        console.log('Loading organization for user:', profile.organization_id);
        
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle(); // Use maybeSingle to handle null case gracefully

        if (orgError) {
          console.error('Error loading organization:', orgError);
          setOrganization(null);
        } else if (org) {
          console.log('Organization loaded:', org);
          setOrganization(org as Organization);
        } else {
          console.log('No organization found with id:', profile.organization_id);
          setOrganization(null);
        }
      } else {
        console.log('User has no organization_id');
        setOrganization(null);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      setUserProfile(null);
      setOrganization(null);
    }
  };

  useEffect(() => {
    console.log('Setting up auth state listener');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Small delay to ensure user profile is created if it's a new user
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

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email || 'No session');
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
      console.log('Signing up user:', email);
      
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
        console.error('Sign up error:', error);
        return { error };
      }

      // Create user profile
      if (data.user) {
        console.log('Creating user profile for:', data.user.id);
        
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
          console.error('Error creating user profile:', profileError);
          return { error: profileError };
        }
        
        console.log('User profile created successfully');
      }

      return { error: null };
    } catch (error) {
      console.error('Error in signUp:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in user:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Sign in error:', error);
      }
      
      return { error };
    } catch (error) {
      console.error('Error in signIn:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out user');
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      setOrganization(null);
      setSession(null);
    } catch (error) {
      console.error('Error in signOut:', error);
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
      console.log('Registering organization:', orgData.name);
      
      // First create the organization
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
        console.error('Error creating organization:', orgError);
        return { error: orgError };
      }

      console.log('Organization created:', org.id);

      // Then create the admin user
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
        console.error('Error creating auth user:', authError);
        return { error: authError };
      }

      console.log('Admin user created:', authData.user?.id);

      // Create admin user profile
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
          console.error('Error creating admin profile:', profileError);
          return { error: profileError };
        }
        
        console.log('Admin profile created successfully');
      }

      return { error: null };
    } catch (error) {
      console.error('Error in registerOrganization:', error);
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
      console.log('Requesting to join organization:', orgId);
      
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

      if (error) {
        console.error('Error creating join request:', error);
      }

      return { error };
    } catch (error) {
      console.error('Error in requestToJoinOrganization:', error);
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
