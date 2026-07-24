// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


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



export async function ldapSync(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  

  try {
    const { configId } = body;
    
    if (!configId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Configuration ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = ctx.getHeader('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = ctx.getEnv('SUPABASE_URL')!;
    const supabaseServiceKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')!;
    

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
 
       // OPTIMIZATION: Process LDAP users in parallel batches instead of sequentially
       const BATCH_SIZE = 10; // Process 10 users concurrently
       
       for (let i = 0; i < ldapUsers.length; i += BATCH_SIZE) {
         const batch = ldapUsers.slice(i, i + BATCH_SIZE);
         
         const batchResults = await Promise.allSettled(
           batch.map(async (ldapUser) => {
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
 
                 // Parallel updates for profile and LDAP link
                 await Promise.all([
                   supabase
                     .from('user_profiles')
                     .update(updates)
                     .eq('id', existingProfile.id),
                   supabase
                     .from('ldap_user_links')
                     .upsert({
                       user_id: existingProfile.id,
                       ldap_config_id: configId,
                       ldap_dn: ldapUser.dn,
                       ldap_username: ldapUser.username,
                       ldap_groups: ldapUser.groups,
                       last_synced_at: new Date().toISOString(),
                     }, { onConflict: 'user_id' })
                 ]);
 
                 // Apply group mappings
                 if (groupMappings && groupMappings.length > 0) {
                   await applyGroupMappings(supabase, groupMappings, existingProfile.id, ldapUser.groups);
                 }
 
                 return { type: 'updated', email: ldapUser.email };
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
                   throw new Error(`Failed to create auth user: ${authError.message}`);
                 }
 
                 // Parallel inserts for profile and LDAP link
                 await Promise.all([
                   supabase
                     .from('user_profiles')
                     .insert({
                       id: authUser.user.id,
                       email: ldapUser.email.toLowerCase(),
                       first_name: ldapUser.firstName,
                       last_name: ldapUser.lastName,
                       organization_id: profile.organization_id,
                       role: 'user',
                       status: ldapUser.isEnabled ? 'active' : 'inactive',
                     }),
                   supabase
                     .from('ldap_user_links')
                     .insert({
                       user_id: authUser.user.id,
                       ldap_config_id: configId,
                       ldap_dn: ldapUser.dn,
                       ldap_username: ldapUser.username,
                       ldap_groups: ldapUser.groups,
                       last_synced_at: new Date().toISOString(),
                     })
                 ]);
 
                 // Apply group mappings
                 if (groupMappings && groupMappings.length > 0) {
                   await applyGroupMappings(supabase, groupMappings, authUser.user.id, ldapUser.groups);
                 }
 
                 return { type: 'created', email: ldapUser.email };
               }
               
               return { type: 'skipped', email: ldapUser.email };
             } catch (userError: any) {
               throw { email: ldapUser.email, message: userError.message };
             }
           })
         );
         
         // Process batch results
         for (const result of batchResults) {
           if (result.status === 'fulfilled') {
             const value = result.value;
             if (value.type === 'updated') {
               syncResults.usersUpdated++;
               syncResults.log.push(`Updated user: ${value.email}`);
             } else if (value.type === 'created') {
               syncResults.usersCreated++;
               syncResults.log.push(`Created user: ${value.email}`);
             }
           } else {
             syncResults.errorsCount++;
             syncResults.errors.push(`Error processing ${result.reason.email}: ${result.reason.message}`);
           }
         }
         
         // Log batch progress
         console.log(`📊 Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ldapUsers.length / BATCH_SIZE)}`);
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
}
