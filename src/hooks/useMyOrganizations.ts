import { useCallback, useEffect, useState } from "react";
import { backend as supabase } from '@/services/api';
import { useAuth } from "@/contexts/AuthContext";

export interface MyOrganization {
  organization_id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  role: string;
  is_active: boolean;
  joined_at: string;
}

export function useMyOrganizations() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_my_organizations");
      if (error) throw error;
      setOrganizations((data || []) as MyOrganization[]);
    } catch (e) {
      console.error("Failed to load user organizations", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const switchOrganization = useCallback(async (organizationId: string) => {
    const { data, error } = await supabase.rpc("switch_active_organization", {
      _org_id: organizationId,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result?.success) throw new Error(result?.error || "Failed to switch organization");
    return result;
  }, []);

  return { organizations, loading, reload: load, switchOrganization };
}
