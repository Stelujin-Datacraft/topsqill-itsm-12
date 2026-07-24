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



export async function deleteUser(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  

  try {
    const { userId } = body

    if (!userId) {
      throw new Error('User ID is required')
    }

    const supabaseUrl = ctx.getEnv('SUPABASE_URL')
    const supabaseServiceKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabaseAdmin = supabase;

    // Delete user profile and security parameters in parallel, then delete auth user
    const [profileResult, securityResult] = await Promise.all([
      supabaseAdmin.from('user_profiles').delete().eq('id', userId),
      supabaseAdmin.from('user_security_parameters').delete().eq('user_id', userId)
    ])

    if (profileResult.error) {
      console.error('Error deleting profile:', profileResult.error)
    }
    if (securityResult.error) {
      console.error('Error deleting security params:', securityResult.error)
    }

    // Delete from auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      throw new Error(`Failed to delete user: ${authError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error', success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}
