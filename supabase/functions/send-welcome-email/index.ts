
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Function started - Method:', req.method)
  console.log('🔍 Headers:', Object.fromEntries(req.headers.entries()))

  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 Parsing request body...')
    const requestBody = await req.json()
    console.log('📋 Request data received:', JSON.stringify(requestBody, null, 2))
    
    const { 
      email, 
      firstName, 
      lastName, 
      organizationName, 
      organizationId, 
      role,
      nationality,
      password,
      mobile,
      gender,
      timezone
    } = requestBody

    // Validate required fields
    console.log('🔍 Validating required fields...')
    if (!email || !firstName || !lastName || !organizationId) {
      const missingFields = []
      if (!email) missingFields.push('email')
      if (!firstName) missingFields.push('firstName')
      if (!lastName) missingFields.push('lastName')
      if (!organizationId) missingFields.push('organizationId')
      
      console.error('❌ Missing required fields:', missingFields)
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }

    // Check environment variables
    console.log('🔑 Checking environment variables...')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    console.log('🔍 Environment check:')
    console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing')
    console.log('- RESEND_API_KEY:', resendApiKey ? '✅ Set' : '❌ Missing')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables')
      throw new Error('Missing Supabase configuration')
    }

    // Initialize Supabase admin client
    console.log('🔧 Initializing Supabase admin client...')
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    console.log('✅ Supabase admin client initialized')

    console.log('👤 Checking if user already exists:', email)

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers()
    console.log('📊 User list response:', { 
      userCount: existingUser?.users?.length || 0, 
      error: checkError 
    })
    
    if (checkError) {
      console.error('❌ Error checking existing users:', checkError)
      throw new Error(`Failed to check existing users: ${checkError.message}`)
    }

    const userExists = existingUser?.users?.find(user => user.email === email)
    console.log('🔍 User exists check:', userExists ? '✅ Found' : '❌ Not found')
    
    if (userExists) {
      console.log('👤 User already exists, updating profile instead')
      
      // Update existing user profile
      const updateData: any = {
        first_name: firstName,
        last_name: lastName,
        organization_id: organizationId,
        role: role || 'user',
        status: 'active'
      }
      
      // Add optional fields if provided
      if (nationality) updateData.nationality = nationality
      if (mobile) updateData.mobile = mobile
      if (gender) updateData.gender = gender
      if (timezone) updateData.timezone = timezone
      if (password) updateData.password = password
      
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('id', userExists.id)

      if (updateError) {
        console.error('❌ Error updating user profile:', updateError)
        throw new Error(`Failed to update user profile: ${updateError.message}`)
      }

      console.log('✅ User profile updated successfully')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User profile updated successfully (user already existed)',
          userId: userExists.id,
          emailSent: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Use provided password or generate a secure random password
    let tempPassword = password
    
    if (!tempPassword) {
      console.log('🔐 Generating temporary password...')
      const generatePassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 16; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      }
      tempPassword = generatePassword()
      console.log('✅ Temporary password generated (length:', tempPassword.length, ')')
    } else {
      console.log('✅ Using provided password')
    }

    // Create the user in Supabase Auth
    console.log('👤 Creating new user in Supabase Auth...')
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        organization_id: organizationId,
        role: role || 'user'
      }
    })

    if (authError) {
      console.error('❌ Error creating auth user:', authError)
      throw new Error(`Failed to create user account: ${authError.message}`)
    }

    console.log('✅ Auth user created successfully:', authUser.user?.id)

    // Create user profile
    console.log('📝 Creating user profile...')
    const profileData: any = {
      id: authUser.user.id,
      email: email,
      first_name: firstName,
      last_name: lastName,
      organization_id: organizationId,
      role: role || 'user',
      status: 'active'
    }
    
    // Add optional fields if provided
    if (nationality) profileData.nationality = nationality
    if (mobile) profileData.mobile = mobile
    if (gender) profileData.gender = gender
    if (timezone) profileData.timezone = timezone
    if (password) profileData.password = password
    
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileData)

    if (profileError) {
      console.error('❌ Error creating user profile:', profileError)
      // Clean up the auth user if profile creation fails
      console.log('🧹 Cleaning up auth user due to profile creation failure...')
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw new Error(`Failed to create user profile: ${profileError.message}`)
    }

    console.log('✅ User profile created successfully')

    // Try to send welcome email - but don't fail the whole operation if it fails
    let emailSent = false
    let emailError = null

    console.log('📧 Attempting to send welcome email...')
    
    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping email')
      emailError = 'RESEND_API_KEY is not configured'
    } else {
      try {
        const emailData = {
          from: 'DataCraft Pro <onboarding@resend.dev>',
          to: [email],
          subject: `Welcome to ${organizationName || 'DataCraft Pro'}`,
          html: `
            <h2>Welcome to ${organizationName || 'DataCraft Pro'}!</h2>
            <p>Hi ${firstName},</p>
            <p>Your account has been created successfully. Here are your login credentials:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Temporary Password:</strong> <code style="background-color: #e0e0e0; padding: 2px 4px; border-radius: 3px;">${tempPassword}</code></p>
            </div>
            <p>Please log in and change your password as soon as possible for security reasons.</p>
            <p>Welcome to the team!</p>
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">This email was sent by DataCraft Pro. If you believe you received this email in error, please contact your administrator.</p>
          `
        }

        console.log('📤 Sending email to:', email)
        console.log('📧 Email data:', JSON.stringify({ ...emailData, html: '[HTML_CONTENT]' }, null, 2))

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailData)
        })

        console.log('📬 Email response status:', emailResponse.status)
        console.log('📬 Email response headers:', Object.fromEntries(emailResponse.headers.entries()))

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          console.error('❌ Error sending email - Status:', emailResponse.status)
          console.error('❌ Error sending email - Response:', errorText)
          emailError = `Failed to send welcome email: ${errorText}`
        } else {
          const emailResult = await emailResponse.json()
          console.log('✅ Welcome email sent successfully:', emailResult)
          emailSent = true
        }
      } catch (error) {
        console.error('❌ Error in email sending process:', error)
        emailError = error.message
      }
    }

    // Return success even if email failed - user creation is more important
    const responseData = { 
      success: true, 
      message: emailSent 
        ? 'User created and welcome email sent successfully'
        : `User created successfully, but email failed: ${emailError}`,
      userId: authUser.user.id,
      emailSent: emailSent,
      emailError: emailError,
      tempPassword: tempPassword // Include for debugging - remove in production
    }

    console.log('🎉 Function completed successfully')
    console.log('📤 Response data:', JSON.stringify(responseData, null, 2))

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('💥 Error in send-welcome-email function:', error)
    console.error('💥 Error stack:', error.stack)
    
    const errorResponse = { 
      error: error.message || 'Internal server error',
      success: false,
      stack: error.stack
    }
    
    console.log('❌ Error response:', JSON.stringify(errorResponse, null, 2))
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
