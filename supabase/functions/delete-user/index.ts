import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Delete User Function started - Method:', req.method)

  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 Parsing request body...')
    const { userId } = await req.json()
    console.log('📋 Request to delete user ID:', userId)

    if (!userId) {
      throw new Error('User ID is required')
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🗑️ Deleting user profile from user_profiles table...')
    // First delete from user_profiles
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('❌ Error deleting user profile:', profileError)
      // Continue anyway to try to delete from auth
    } else {
      console.log('✅ User profile deleted successfully')
    }

    console.log('🗑️ Deleting user from auth.users...')
    // Then delete from auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('❌ Error deleting auth user:', authError)
      throw new Error(`Failed to delete user from authentication: ${authError.message}`)
    }

    console.log('✅ User deleted successfully from auth')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully from both auth and user_profiles'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('💥 Error in delete-user function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
