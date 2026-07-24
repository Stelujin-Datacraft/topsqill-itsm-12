// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}



export async function adminChangePassword(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  

  try {
    const { userId, newPassword } = body

    if (!userId || !newPassword) {
      throw new Error('User ID and new password are required')
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    const supabaseUrl = ctx.getEnv('SUPABASE_URL')
    const supabaseServiceKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    // Verify the caller is an admin
    const authHeader = ctx.getHeader('Authorization')
    if (!authHeader) {
      throw new Error('Authorization required')
    }

    const supabaseClient = supabase;
    
    // Get the calling user's token to verify admin role
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !callingUser) {
      throw new Error('Invalid authentication')
    }

    // Check if calling user is admin
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', callingUser.id)
      .single()

    if (profileError || !callerProfile || callerProfile.role !== 'admin') {
      throw new Error('Only administrators can change user passwords')
    }

    // Use admin API to update user password
    const supabaseAdmin = supabase;

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`)
    }

    // Update last_password_change in security parameters
    await supabaseAdmin
      .from('user_security_parameters')
      .update({ last_password_change: new Date().toISOString() })
      .eq('user_id', userId)

    // Log audit event
    await supabaseAdmin.from('audit_logs').insert({
      user_id: callingUser.id,
      event_type: 'admin_password_change',
      event_category: 'security',
      description: `Admin changed password for user ${userId}`,
      metadata: { target_user_id: userId }
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
}
