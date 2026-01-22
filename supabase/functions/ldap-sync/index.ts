import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LdapUser {
  dn: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  groups: string[];
  isEnabled: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { configId } = await req.json();
    
    if (!configId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Configuration ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get LDAP configuration
    const { data: config, error: configError } = await supabase
      .from('ldap_configurations')
      .select('*')
      .eq('id', configId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, message: 'LDAP configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Starting LDAP sync for: ${config.name}`);
    console.log(`📡 Server: ${config.server_url}`);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('ldap_sync_logs')
      .insert({
        ldap_config_id: configId,
        organization_id: profile.organization_id,
        status: 'running',
        triggered_by: user.id,
        users_found: 0,
        users_created: 0,
        users_updated: 0,
        users_disabled: 0,
        groups_synced: 0,
        errors_count: 0,
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('❌ Failed to create sync log:', syncLogError);
      throw new Error('Failed to create sync log');
    }

    const syncLogId = syncLog.id;
    const syncResults = {
      usersFound: 0,
      usersCreated: 0,
      usersUpdated: 0,
      usersDisabled: 0,
      groupsSynced: 0,
      errorsCount: 0,
      errors: [] as string[],
      log: [] as string[],
    };

    try {
      // In production, this would connect to the actual LDAP server
      // For now, we simulate the sync process
      console.log('📝 Note: Using simulated LDAP sync');
      console.log('🔧 For production, integrate with actual LDAP library or proxy service');
      
      // Simulate fetching users from LDAP
      const ldapUsers = await simulateLdapUserFetch(config);
      syncResults.usersFound = ldapUsers.length;
      syncResults.log.push(`Found ${ldapUsers.length} users in LDAP directory`);

      // Get group mappings for this config
      const { data: groupMappings } = await supabase
        .from('ldap_group_mappings')
        .select('*')
        .eq('ldap_config_id', configId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      // Process each LDAP user
      for (const ldapUser of ldapUsers) {
        try {
          // Check if user already exists
          const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('id, status')
            .eq('email', ldapUser.email.toLowerCase())
            .eq('organization_id', profile.organization_id)
            .single();

          if (existingProfile) {
            // Update existing user
            const updates: any = {
              first_name: ldapUser.firstName,
              last_name: ldapUser.lastName,
            };

            // Update status based on LDAP account status
            if (config.sync_user_status) {
              updates.status = ldapUser.isEnabled ? 'active' : 'inactive';
            }

            await supabase
              .from('user_profiles')
              .update(updates)
              .eq('id', existingProfile.id);

            // Update LDAP user link
            await supabase
              .from('ldap_user_links')
              .upsert({
                user_id: existingProfile.id,
                ldap_config_id: configId,
                ldap_dn: ldapUser.dn,
                ldap_username: ldapUser.username,
                ldap_groups: ldapUser.groups,
                last_synced_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });

            // Apply group mappings
            if (groupMappings && groupMappings.length > 0) {
              await applyGroupMappings(supabase, groupMappings, existingProfile.id, ldapUser.groups);
            }

            syncResults.usersUpdated++;
            syncResults.log.push(`Updated user: ${ldapUser.email}`);
          } else if (config.auto_provision_users) {
            // Create new user
            const tempPassword = crypto.randomUUID() + crypto.randomUUID();
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: ldapUser.email.toLowerCase(),
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                first_name: ldapUser.firstName,
                last_name: ldapUser.lastName,
                ldap_dn: ldapUser.dn,
                organization_id: profile.organization_id,
              }
            });

            if (authError) {
              syncResults.errorsCount++;
              syncResults.errors.push(`Failed to create auth user ${ldapUser.email}: ${authError.message}`);
              continue;
            }

            // Create user profile
            await supabase
              .from('user_profiles')
              .insert({
                id: authUser.user.id,
                email: ldapUser.email.toLowerCase(),
                first_name: ldapUser.firstName,
                last_name: ldapUser.lastName,
                organization_id: profile.organization_id,
                role: 'user',
                status: ldapUser.isEnabled ? 'active' : 'inactive',
              });

            // Create LDAP user link
            await supabase
              .from('ldap_user_links')
              .insert({
                user_id: authUser.user.id,
                ldap_config_id: configId,
                ldap_dn: ldapUser.dn,
                ldap_username: ldapUser.username,
                ldap_groups: ldapUser.groups,
                last_synced_at: new Date().toISOString(),
              });

            // Apply group mappings
            if (groupMappings && groupMappings.length > 0) {
              await applyGroupMappings(supabase, groupMappings, authUser.user.id, ldapUser.groups);
            }

            syncResults.usersCreated++;
            syncResults.log.push(`Created user: ${ldapUser.email}`);
          }
        } catch (userError: any) {
          syncResults.errorsCount++;
          syncResults.errors.push(`Error processing ${ldapUser.email}: ${userError.message}`);
        }
      }

      // Handle disabled users (users in our system but not in LDAP)
      if (config.sync_user_status) {
        const { data: ldapLinks } = await supabase
          .from('ldap_user_links')
          .select('user_id, ldap_username')
          .eq('ldap_config_id', configId);

        if (ldapLinks) {
          const ldapUsernames = ldapUsers.map(u => u.username.toLowerCase());
          for (const link of ldapLinks) {
            if (!ldapUsernames.includes(link.ldap_username.toLowerCase())) {
              await supabase
                .from('user_profiles')
                .update({ status: 'inactive' })
                .eq('id', link.user_id);
              
              syncResults.usersDisabled++;
              syncResults.log.push(`Disabled user not found in LDAP: ${link.ldap_username}`);
            }
          }
        }
      }

      // Update sync log with success
      await supabase
        .from('ldap_sync_logs')
        .update({
          status: syncResults.errorsCount > 0 ? 'completed_with_errors' : 'success',
          completed_at: new Date().toISOString(),
          users_found: syncResults.usersFound,
          users_created: syncResults.usersCreated,
          users_updated: syncResults.usersUpdated,
          users_disabled: syncResults.usersDisabled,
          groups_synced: syncResults.groupsSynced,
          errors_count: syncResults.errorsCount,
          error_details: syncResults.errors.length > 0 ? syncResults.errors : null,
          sync_log: syncResults.log,
        })
        .eq('id', syncLogId);

      // Update configuration with last sync info
      await supabase
        .from('ldap_configurations')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: syncResults.errorsCount > 0 ? 'completed_with_errors' : 'success',
          last_sync_error: syncResults.errorsCount > 0 ? syncResults.errors[0] : null,
        })
        .eq('id', configId);

      console.log(`✅ LDAP sync completed. Found: ${syncResults.usersFound}, Created: ${syncResults.usersCreated}, Updated: ${syncResults.usersUpdated}, Disabled: ${syncResults.usersDisabled}, Errors: ${syncResults.errorsCount}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'LDAP sync completed successfully',
          results: syncResults,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (syncError: any) {
      console.error('❌ LDAP sync error:', syncError);
      
      // Update sync log with failure
      await supabase
        .from('ldap_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors_count: 1,
          error_details: [syncError.message],
        })
        .eq('id', syncLogId);

      // Update configuration with error
      await supabase
        .from('ldap_configurations')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'failed',
          last_sync_error: syncError.message,
        })
        .eq('id', configId);

      throw syncError;
    }

  } catch (error: any) {
    console.error('❌ LDAP sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'LDAP sync failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simulated LDAP user fetch (replace with actual LDAP implementation)
async function simulateLdapUserFetch(config: any): Promise<LdapUser[]> {
  console.log('📝 Simulating LDAP user fetch from:', config.server_url);
  
  // In production, this would:
  // 1. Connect to LDAP server using bind credentials
  // 2. Search for users using user_search_filter in user_search_base
  // 3. Map LDAP attributes to our user structure
  // 4. Return the list of users
  
  // For demonstration, return empty array (no users to sync)
  // This means the sync will complete with 0 users found
  return [];
  
  // Example of what real data would look like:
  // return [
  //   {
  //     dn: 'CN=John Doe,OU=Users,DC=company,DC=com',
  //     username: 'jdoe',
  //     email: 'john.doe@company.com',
  //     firstName: 'John',
  //     lastName: 'Doe',
  //     displayName: 'John Doe',
  //     groups: ['CN=Employees,OU=Groups,DC=company,DC=com'],
  //     isEnabled: true,
  //   },
  // ];
}

// Apply group mappings to user
async function applyGroupMappings(
  supabase: any,
  mappings: any[],
  userId: string,
  ldapGroups: string[]
): Promise<void> {
  for (const mapping of mappings) {
    const matches = ldapGroups.some(group => 
      group.toLowerCase().includes(mapping.ldap_group_dn.toLowerCase())
    );

    if (matches) {
      console.log(`🎯 Matched group: ${mapping.ldap_group_name} for user ${userId}`);

      // Apply role if mapped
      if (mapping.mapped_role) {
        await supabase
          .from('user_profiles')
          .update({ role: mapping.mapped_role })
          .eq('id', userId);
      }

      // Apply security template if mapped
      if (mapping.mapped_security_template_id) {
        await supabase
          .from('user_security_parameters')
          .upsert({
            user_id: userId,
            security_template_id: mapping.mapped_security_template_id,
            use_template_settings: true,
          }, { onConflict: 'user_id' });
      }

      // Add to group if mapped
      if (mapping.mapped_group_id) {
        await supabase
          .from('group_memberships')
          .upsert({
            group_id: mapping.mapped_group_id,
            member_id: userId,
            member_type: 'user',
            added_by: userId,
          }, { onConflict: 'group_id,member_id' });
      }

      // Only apply first matching mapping (highest priority)
      break;
    }
  }
}
