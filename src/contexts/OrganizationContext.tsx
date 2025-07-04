
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
  description: string;
  domain: string;
  logo_url?: string;
  admin_email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  loading: boolean;
  addOrganization: (org: Omit<Organization, 'id' | 'created_at' | 'updated_at'>) => void;
  updateOrganization: (id: string, updates: Partial<Organization>) => void;
  deleteOrganization: (id: string) => void;
  setCurrentOrganization: (org: Organization) => void;
  loadOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      console.log('Loading organizations...');

      if (!userProfile?.id) {
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }

      // Only load organizations the user is part of
      const { data: orgsData, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userProfile.organization_id)
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error loading organizations:', error);
        return;
      }

      console.log('Organizations loaded:', orgsData);
      setOrganizations(orgsData || []);

      // Set current organization based on user profile
      if (userProfile?.organization_id && orgsData) {
        const userOrg = orgsData.find(org => org.id === userProfile.organization_id);
        if (userOrg) {
          console.log('Setting current organization:', userOrg);
          setCurrentOrganization(userOrg);
        }
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load organizations when user profile changes
  useEffect(() => {
    if (userProfile?.organization_id) {
      loadOrganizations();
    } else {
      setLoading(false);
    }
  }, [userProfile?.organization_id]);

  const addOrganization = (org: Omit<Organization, 'id' | 'created_at' | 'updated_at'>) => {
    const newOrg = { 
      ...org, 
      id: `org-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setOrganizations(prev => [...prev, newOrg]);
  };

  const updateOrganization = (id: string, updates: Partial<Organization>) => {
    setOrganizations(prev => 
      prev.map(org => org.id === id ? { ...org, ...updates } : org)
    );
  };

  const deleteOrganization = (id: string) => {
    setOrganizations(prev => prev.filter(org => org.id !== id));
  };

  return (
    <OrganizationContext.Provider value={{
      organizations,
      currentOrganization,
      loading,
      addOrganization,
      updateOrganization,
      deleteOrganization,
      setCurrentOrganization,
      loadOrganizations
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
