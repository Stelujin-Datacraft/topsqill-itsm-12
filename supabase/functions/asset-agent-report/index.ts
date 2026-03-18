import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const agentKey = req.headers.get('x-agent-key');
    if (!agentKey) {
      return new Response(JSON.stringify({ error: 'Missing x-agent-key header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // REGISTER: Agent registers itself
    if (action === 'register') {
      const { organization_id, hostname, os_type, os_version } = body;
      if (!organization_id) {
        return new Response(JSON.stringify({ error: 'organization_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if agent already exists
      const { data: existing } = await supabase
        .from('asset_agents')
        .select('id, asset_id, organization_id')
        .eq('agent_key', agentKey)
        .single();

      if (existing) {
        const nextOrganizationId = organization_id || existing.organization_id;
        const orgChanged = Boolean(
          organization_id && existing.organization_id && existing.organization_id !== organization_id
        );

        // If agent was previously registered with a wrong org, correct it on re-register.
        // This prevents successful reports being invisible to the current org due to RLS.
        if (orgChanged && existing.asset_id) {
          const { error: assetOrgError } = await supabase
            .from('it_assets')
            .update({ organization_id: nextOrganizationId })
            .eq('id', existing.asset_id);

          if (assetOrgError) {
            console.error('Error updating asset organization:', assetOrgError);
            return new Response(JSON.stringify({ error: 'Failed to update existing asset organization' }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const { error: agentUpdateError } = await supabase.from('asset_agents').update({
          organization_id: nextOrganizationId,
          hostname,
          os_type,
          os_version,
          status: 'online',
          last_heartbeat: new Date().toISOString(),
        }).eq('id', existing.id);

        if (agentUpdateError) {
          console.error('Error updating existing agent:', agentUpdateError);
          return new Response(JSON.stringify({ error: 'Failed to update existing agent' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          agent_id: existing.id,
          asset_id: existing.asset_id,
          organization_id: nextOrganizationId,
          message: orgChanged ? 'Agent updated and organization corrected' : 'Agent updated'
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Create new asset
      const { data: asset, error: assetErr } = await supabase.from('it_assets').insert({
        organization_id,
        display_name: hostname || 'Unknown Device',
        hostname,
        asset_type: os_type?.toLowerCase().includes('windows') ? 'workstation' : 
                    os_type?.toLowerCase().includes('linux') ? 'server' : 
                    os_type?.toLowerCase().includes('darwin') ? 'workstation' : 'workstation',
        category: 'hardware',
        status: 'active',
        created_by: '00000000-0000-0000-0000-000000000000',
      }).select('id').single();

      if (assetErr) {
        console.error('Error creating asset:', assetErr);
        return new Response(JSON.stringify({ error: 'Failed to create asset', details: assetErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Register agent
      const { data: agent, error: agentErr } = await supabase.from('asset_agents').insert({
        asset_id: asset.id,
        organization_id,
        agent_key: agentKey,
        hostname, os_type, os_version,
        status: 'online',
        last_heartbeat: new Date().toISOString(),
      }).select('id').single();

      if (agentErr) {
        console.error('Error registering agent:', agentErr);
        return new Response(JSON.stringify({ error: 'Failed to register agent' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, agent_id: agent.id, asset_id: asset.id, message: 'Agent registered' 
      }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // HEARTBEAT
    if (action === 'heartbeat') {
      const { data: agent } = await supabase
        .from('asset_agents')
        .select('id')
        .eq('agent_key', agentKey)
        .single();

      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not registered' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('asset_agents').update({
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        ip_address: body.ip_address || null,
      }).eq('id', agent.id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // REPORT: Full system report
    if (action === 'report') {
      const { data: agent } = await supabase
        .from('asset_agents')
        .select('id, asset_id')
        .eq('agent_key', agentKey)
        .single();

      if (!agent || !agent.asset_id) {
        return new Response(JSON.stringify({ error: 'Agent not registered' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { hardware, software, system } = body;

      // Update asset info
      if (system) {
        await supabase.from('it_assets').update({
          hostname: system.hostname,
          ip_address: system.ip_address,
          mac_address: system.mac_address,
          manufacturer: system.manufacturer,
          model: system.model,
          serial_number: system.serial_number,
          display_name: system.hostname || system.display_name,
        }).eq('id', agent.asset_id);
      }

      // Upsert hardware info
      if (hardware) {
        await supabase.from('asset_hardware_info').upsert({
          asset_id: agent.asset_id,
          cpu_model: hardware.cpu_model,
          cpu_cores: hardware.cpu_cores,
          cpu_speed_mhz: hardware.cpu_speed_mhz,
          ram_total_gb: hardware.ram_total_gb,
          disk_total_gb: hardware.disk_total_gb,
          disk_free_gb: hardware.disk_free_gb,
          gpu_model: hardware.gpu_model,
          os_name: hardware.os_name,
          os_version: hardware.os_version,
          os_architecture: hardware.os_architecture,
          bios_version: hardware.bios_version,
          motherboard_model: hardware.motherboard_model,
          network_adapters: hardware.network_adapters || [],
          display_info: hardware.display_info || [],
          last_boot_time: hardware.last_boot_time,
          uptime_hours: hardware.uptime_hours,
          collected_at: new Date().toISOString(),
        }, { onConflict: 'asset_id' });
      }

      // Replace software inventory
      if (software && Array.isArray(software)) {
        // Delete old software records
        await supabase.from('asset_software')
          .delete()
          .eq('asset_id', agent.asset_id);

        // Insert new
        if (software.length > 0) {
          const softwareRows = software.map((s: any) => ({
            asset_id: agent.asset_id,
            software_name: s.name || s.software_name,
            version: s.version,
            publisher: s.publisher,
            install_date: s.install_date || null,
            install_path: s.install_path || null,
            size_mb: s.size_mb || null,
            is_system_component: s.is_system_component || false,
          }));

          // Insert in batches of 100
          for (let i = 0; i < softwareRows.length; i += 100) {
            await supabase.from('asset_software').insert(softwareRows.slice(i, i + 100));
          }
        }
      }

      // Update agent last report
      await supabase.from('asset_agents').update({
        status: 'online',
        last_report: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        ip_address: system?.ip_address || null,
      }).eq('id', agent.id);

      // Log history
      await supabase.from('asset_history').insert({
        asset_id: agent.asset_id,
        event_type: 'agent_report',
        description: 'Agent submitted system report',
        new_value: { hardware_updated: !!hardware, software_count: software?.length || 0 },
      });

      return new Response(JSON.stringify({ success: true, message: 'Report received' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Agent report error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
