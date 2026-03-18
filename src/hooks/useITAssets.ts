import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface ITAsset {
  id: string;
  organization_id: string;
  project_id?: string;
  asset_tag?: string;
  hostname?: string;
  display_name: string;
  asset_type: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  status: string;
  condition?: string;
  assigned_to?: string;
  department?: string;
  location?: string;
  purchase_date?: string;
  purchase_cost?: number;
  warranty_expiry?: string;
  ip_address?: string;
  mac_address?: string;
  notes?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AssetAgent {
  id: string;
  asset_id?: string;
  organization_id: string;
  agent_key: string;
  hostname?: string;
  os_type?: string;
  os_version?: string;
  agent_version?: string;
  status: string;
  last_heartbeat?: string;
  last_report?: string;
  ip_address?: string;
  registered_at: string;
}

export interface AssetHardwareInfo {
  id: string;
  asset_id: string;
  cpu_model?: string;
  cpu_cores?: number;
  cpu_speed_mhz?: number;
  ram_total_gb?: number;
  disk_total_gb?: number;
  disk_free_gb?: number;
  gpu_model?: string;
  os_name?: string;
  os_version?: string;
  os_architecture?: string;
  bios_version?: string;
  motherboard_model?: string;
  network_adapters?: any[];
  display_info?: any[];
  last_boot_time?: string;
  uptime_hours?: number;
  collected_at: string;
}

export interface AssetSoftware {
  id: string;
  asset_id: string;
  software_name: string;
  version?: string;
  publisher?: string;
  install_date?: string;
  install_path?: string;
  size_mb?: number;
  is_system_component?: boolean;
  collected_at: string;
}

export interface AssetHistory {
  id: string;
  asset_id: string;
  event_type: string;
  description?: string;
  old_value?: any;
  new_value?: any;
  performed_by?: string;
  performed_at: string;
}

export function useITAssets() {
  const { userProfile } = useAuth();
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [agents, setAgents] = useState<AssetAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssets = useCallback(async () => {
    if (!userProfile?.organization_id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('it_assets')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets((data as any[]) || []);
    } catch (e: any) {
      console.error('Error loading assets:', e);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id]);

  const loadAgents = useCallback(async () => {
    if (!userProfile?.organization_id) return;
    try {
      const { data, error } = await supabase
        .from('asset_agents')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('last_heartbeat', { ascending: false });

      if (error) throw error;
      setAgents((data as any[]) || []);
    } catch (e: any) {
      console.error('Error loading agents:', e);
    }
  }, [userProfile?.organization_id]);

  const createAsset = async (asset: Partial<ITAsset>) => {
    if (!userProfile) return;
    try {
      const { error } = await supabase.from('it_assets').insert({
        ...asset,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id,
      } as any);
      if (error) throw error;
      toast({ title: 'Asset created', description: 'IT asset has been added successfully.' });
      await loadAssets();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const updateAsset = async (id: string, updates: Partial<ITAsset>) => {
    try {
      const { error } = await supabase.from('it_assets').update(updates as any).eq('id', id);
      if (error) throw error;
      toast({ title: 'Asset updated' });
      await loadAssets();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase.from('it_assets').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Asset deleted' });
      await loadAssets();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const getAssetDetails = async (assetId: string) => {
    const [hwRes, swRes, histRes] = await Promise.all([
      supabase.from('asset_hardware_info').select('*').eq('asset_id', assetId).single(),
      supabase.from('asset_software').select('*').eq('asset_id', assetId).order('software_name'),
      supabase.from('asset_history').select('*').eq('asset_id', assetId).order('performed_at', { ascending: false }).limit(50),
    ]);

    return {
      hardware: (hwRes.data as AssetHardwareInfo | null),
      software: (swRes.data as AssetSoftware[] | null) || [],
      history: (histRes.data as AssetHistory[] | null) || [],
    };
  };

  useEffect(() => {
    loadAssets();
    loadAgents();
  }, [loadAssets, loadAgents]);

  return {
    assets, agents, loading,
    loadAssets, loadAgents,
    createAsset, updateAsset, deleteAsset,
    getAssetDetails,
  };
}
