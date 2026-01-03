import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationRequest {
  email: string
  firstName: string
  lastName: string
  role: string
  organizationName: string
  inviterName: string
}

serve(async (req) => {
  console.log('🚀 Send Invitation Email - Started')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody: InvitationRequest = await req.json()
    console.log('📋 Request data:', JSON.stringify(requestBody, null, 2))

    const { email, firstName, lastName, role, organizationName, inviterName } = requestBody

    // Validate required fields
    if (!email || !firstName || !lastName) {
      throw new Error('Missing required fields: email, firstName, lastName')
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured',
          emailSent: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Send invitation email
    const emailData = {
      from: 'DataCraft Pro <onboarding@resend.dev>',
      to: [email],
      subject: `You're invited to join ${organizationName || 'our organization'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
            
            <p style="font-size: 16px;">${inviterName || 'Someone'} has invited you to join <strong>${organizationName || 'their organization'}</strong> as a <strong>${role || 'member'}</strong>.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                <strong>What happens next?</strong><br>
                Your invitation is pending approval. Once approved, you'll receive another email with your login credentials.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666;">If you didn't expect this invitation or have any questions, please contact the person who invited you.</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This email was sent by DataCraft Pro.<br>
              If you believe you received this email in error, please ignore it.
            </p>
          </div>
        </body>
        </html>
      `
    }

    console.log('📤 Sending invitation email to:', email)

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('❌ Failed to send email:', errorText)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send email: ${errorText}`,
          emailSent: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const emailResult = await emailResponse.json()
    console.log('✅ Invitation email sent successfully:', emailResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation email sent successfully',
        emailSent: true,
        emailId: emailResult.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('💥 Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        emailSent: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
