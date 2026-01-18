
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Professional HTML email template with compact footer
function generateWelcomeEmailHtml(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
  loginUrl: string;
}) {
  const { firstName, lastName, email, password, organizationName, loginUrl } = params;
  const year = new Date().getFullYear();
  
  // Using minimal whitespace to avoid =20 encoding issues in email clients
  // Footer is now compact with reduced padding
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to ${organizationName}</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fa;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Welcome to ${organizationName}!</h1><p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Your account has been created successfully</p></td></tr><tr><td style="padding:30px;"><p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.5;">Hi <strong>${firstName} ${lastName}</strong>,</p><p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.5;">We're excited to have you on board! Below are your login credentials:</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><td style="background-color:#f8f9fc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td style="padding:6px 0;"><span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${email}</p></td></tr><tr><td style="padding:12px 0 6px;border-top:1px dashed #e2e8f0;"><span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Temporary Password</span><p style="margin:4px 0 0;"><code style="background-color:#fef3c7;color:#92400e;padding:6px 12px;border-radius:4px;font-size:14px;font-weight:600;display:inline-block;">${password}</code></p></td></tr></table></td></tr></table><table role="presentation" style="width:100%;border-collapse:collapse;margin:15px 0;"><tr><td style="background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:0 6px 6px 0;padding:10px 15px;"><p style="margin:0;color:#991b1b;font-size:13px;"><strong>Security:</strong> Please change your password after first login.</p></td></tr></table><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><td align="center"><a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:6px;font-size:14px;font-weight:600;">Login to Your Account</a></td></tr></table><p style="margin:15px 0 0;color:#333;font-size:14px;">Best regards,<br><strong>The ${organizationName} Team</strong></p></td></tr><tr><td style="background-color:#f8f9fc;padding:12px 20px;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.4;">${organizationName} | &copy; ${year} All rights reserved</p></td></tr></table></td></tr></table></body></html>`;
}

serve(async (req) => {
  console.log('🚀 Function started - Method:', req.method)

  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 Parsing request body...')
    const requestBody = await req.json()
    console.log('📋 Request data received:', JSON.stringify({ ...requestBody, password: '[REDACTED]' }, null, 2))
    
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
      timezone,
      securityTemplateId,
      userDomain,
      status
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
    
    console.log('🔍 Environment check:')
    console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing')

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

    // Check if user already exists in auth by searching for the specific email
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (checkError) {
      console.error('❌ Error checking existing users:', checkError)
      throw new Error(`Failed to check existing users: ${checkError.message}`)
    }

    // Case-insensitive email comparison
    const userExists = existingUsers?.users?.find(user => 
      user.email?.toLowerCase() === email.toLowerCase()
    )
    console.log('🔍 User exists check:', userExists ? '✅ Found in auth' : '❌ Not found')
    
    if (userExists) {
      console.log('👤 User exists in auth, checking profile...')
      
      // Check if profile exists
      const { data: profileData, error: profileCheckError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('id', userExists.id)
        .maybeSingle()
      
      if (profileCheckError) {
        console.error('❌ Error checking profile:', profileCheckError)
        throw new Error(`Failed to check user profile: ${profileCheckError.message}`)
      }
      
      const updateData: any = {
        first_name: firstName,
        last_name: lastName,
        organization_id: organizationId,
        role: role || 'user',
        status: status || 'active'
      }
      
      // Add optional fields if provided
      if (nationality) updateData.nationality = nationality
      if (mobile) updateData.mobile = mobile
      if (gender) updateData.gender = gender
      if (timezone) updateData.timezone = timezone
      if (password) updateData.password = password
      
      if (profileData) {
        // Profile exists, update it
        console.log('📝 Updating existing profile...')
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update(updateData)
          .eq('id', userExists.id)
        
        if (updateError) {
          console.error('❌ Error updating user profile:', updateError)
          throw new Error(`Failed to update user profile: ${updateError.message}`)
        }
        console.log('✅ User profile updated successfully')
      } else {
        // Profile doesn't exist, create it
        console.log('📝 Creating missing profile for existing auth user...')
        updateData.id = userExists.id
        updateData.email = email
        
        const { error: insertError } = await supabaseAdmin
          .from('user_profiles')
          .insert(updateData)
        
        if (insertError) {
          console.error('❌ Error creating user profile:', insertError)
          throw new Error(`Failed to create user profile: ${insertError.message}`)
        }
        console.log('✅ User profile created successfully')
      }
      
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
    const profileDataToInsert: any = {
      id: authUser.user.id,
      email: email,
      first_name: firstName,
      last_name: lastName,
      organization_id: organizationId,
      role: role || 'user',
      status: status || 'active'
    }
    
    // Add optional fields if provided
    if (nationality) profileDataToInsert.nationality = nationality
    if (mobile) profileDataToInsert.mobile = mobile
    if (gender) profileDataToInsert.gender = gender
    if (timezone) profileDataToInsert.timezone = timezone
    if (password) profileDataToInsert.password = password
    
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileDataToInsert)

    if (profileError) {
      console.error('❌ Error creating user profile:', profileError)
      // Clean up the auth user if profile creation fails
      console.log('🧹 Cleaning up auth user due to profile creation failure...')
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw new Error(`Failed to create user profile: ${profileError.message}`)
    }

    console.log('✅ User profile created successfully')

    // Create user security parameters if securityTemplateId is provided or use defaults
    console.log('🔐 Creating user security parameters...')
    const securityParamsData: any = {
      user_id: authUser.user.id,
      organization_id: organizationId,
    }
    
    if (securityTemplateId) {
      securityParamsData.security_template_id = securityTemplateId
      securityParamsData.use_template_settings = true
      console.log('📋 Assigning security template:', securityTemplateId)
    }
    
    const { error: securityError } = await supabaseAdmin
      .from('user_security_parameters')
      .insert(securityParamsData)
    
    if (securityError) {
      console.error('⚠️ Error creating security parameters:', securityError)
      // Don't fail the whole operation, just log the error
    } else {
      console.log('✅ User security parameters created successfully')
    }

    // Return success immediately - email will be sent in background
    const responseData = { 
      success: true, 
      message: 'User created successfully. Welcome email will be sent shortly.',
      userId: authUser.user.id,
      emailSent: false,
      emailError: null
    }

    // Send welcome email in background using EdgeRuntime.waitUntil
    const sendEmailInBackground = async () => {
      try {
        console.log('📧 [Background] Sending welcome email...')
        
        const { data: smtpConfigs } = await supabaseAdmin
          .from('smtp_configs')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
        
        let smtpConfig = null
        if (smtpConfigs && smtpConfigs.length > 0) {
          smtpConfig = smtpConfigs.find(config => 
            config.host?.toLowerCase().includes('hostinger') ||
            config.from_email?.toLowerCase().includes('topsqill.tech')
          ) || smtpConfigs.find(config => 
            !config.host?.toLowerCase().includes('sendgrid')
          )
        }
        
        if (!smtpConfig) {
          console.warn('⚠️ [Background] No suitable SMTP config found')
          return
        }

        const loginUrl = 'https://itsm.topsqill.com'
        const emailHtml = generateWelcomeEmailHtml({
          firstName,
          lastName,
          email,
          password: tempPassword,
          organizationName: organizationName || 'TOPSQILL',
          loginUrl
        })
        
        const client = new SMTPClient({
          connection: {
            hostname: smtpConfig.host,
            port: smtpConfig.port,
            tls: smtpConfig.use_tls,
            auth: {
              username: smtpConfig.username,
              password: smtpConfig.password,
            },
          },
        })
        
        await client.send({
          from: smtpConfig.from_name 
            ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
            : smtpConfig.from_email,
          to: email,
          subject: `Welcome to ${organizationName || 'TOPSQILL'} - Your Account Details`,
          content: "auto",
          html: emailHtml,
        })
        
        await client.close()
        console.log('✅ [Background] Welcome email sent successfully')
      } catch (error) {
        console.error('❌ [Background] Email error:', error)
      }
    }

    // Start background email task
    EdgeRuntime.waitUntil(sendEmailInBackground())

    console.log('🎉 Function completed - returning response immediately')

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('💥 Error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error', success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})