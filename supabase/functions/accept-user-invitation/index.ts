import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Accept User Invitation - Started');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    
    if (!token) {
      throw new Error('Missing invitation token');
    }

    console.log('📋 Processing invitation token');

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('organization_requests')
      .select('*')
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      console.error('❌ Invitation not found:', invitationError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invitation not found, already used, or expired',
          code: 'INVITATION_NOT_FOUND'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      console.error('❌ Invitation expired');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'This invitation has expired. Please contact your administrator for a new invitation.',
          code: 'INVITATION_EXPIRED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('✅ Invitation found for:', invitation.email);

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => 
      u.email?.toLowerCase() === invitation.email.toLowerCase()
    );

    if (existingUser) {
      console.log('⚠️ User already exists in auth, updating status only');
      
      // Update invitation status
      await supabaseAdmin
        .from('organization_requests')
        .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Your account already exists. Please log in with your credentials.',
          email: invitation.email,
          alreadyExists: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Create user in Supabase Auth
    console.log('👤 Creating user in Supabase Auth...');
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: invitation.password_hash, // Using stored password
      email_confirm: true,
      user_metadata: {
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        organization_id: invitation.organization_id,
        role: invitation.role || 'user'
      }
    });

    if (authError) {
      console.error('❌ Error creating auth user:', authError);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }

    console.log('✅ Auth user created:', authUser.user?.id);

    // Create user profile
    console.log('📝 Creating user profile...');
    const profileData: Record<string, any> = {
      id: authUser.user.id,
      email: invitation.email,
      first_name: invitation.first_name,
      last_name: invitation.last_name,
      organization_id: invitation.organization_id,
      role: invitation.role || 'user',
      status: 'active'
    };

    // Add optional fields
    if (invitation.mobile) profileData.mobile = invitation.mobile;
    if (invitation.gender) profileData.gender = invitation.gender;
    if (invitation.nationality) profileData.nationality = invitation.nationality;
    if (invitation.timezone) profileData.timezone = invitation.timezone;

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileData);

    if (profileError) {
      console.error('❌ Error creating profile:', profileError);
      // Clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    console.log('✅ User profile created');

    // Create user security parameters
    if (invitation.security_template_id) {
      console.log('🔐 Creating security parameters with template:', invitation.security_template_id);
      await supabaseAdmin
        .from('user_security_parameters')
        .insert({
          user_id: authUser.user.id,
          organization_id: invitation.organization_id,
          security_template_id: invitation.security_template_id,
          use_template_settings: true
        });
    } else {
      console.log('🔐 Creating default security parameters');
      await supabaseAdmin
        .from('user_security_parameters')
        .insert({
          user_id: authUser.user.id,
          organization_id: invitation.organization_id,
          use_template_settings: true
        });
    }

    // Update invitation status to accepted
    await supabaseAdmin
      .from('organization_requests')
      .update({ 
        status: 'accepted', 
        reviewed_at: new Date().toISOString() 
      })
      .eq('id', invitation.id);

    console.log('✅ Invitation accepted, user account created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Your account has been created successfully! You can now log in.',
        email: invitation.email,
        firstName: invitation.first_name,
        lastName: invitation.last_name,
        organizationId: invitation.organization_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('💥 Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to accept invitation'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
