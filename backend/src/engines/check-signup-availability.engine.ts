// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';

export async function checkSignupAvailability(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  _ctx: EngineContext,
): Promise<Record<string, unknown>> {
  try {
    const email = String(body.email || '').trim().toLowerCase();
    const organizationName = String(body.organization_name || body.organizationName || '').trim();

    if (!email && !organizationName) {
      return {
        success: false,
        error: 'Provide an email and/or organization name to check.',
      };
    }

    let emailAvailable = true;
    let emailError: string | null = null;
    let organizationAvailable = true;
    let organizationError: string | null = null;

    if (email) {
      if (!email.includes('@')) {
        emailAvailable = false;
        emailError = 'Enter a valid email address.';
      } else {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .ilike('email', email)
          .maybeSingle();

        if (existingProfile) {
          emailAvailable = false;
          emailError = `An account already exists for ${email}. Sign in or use Forgot Password.`;
        } else {
          const { data: pending } = await supabase
            .from('pending_signups')
            .select('id')
            .ilike('email', email)
            .is('verified_at', null)
            .maybeSingle();

          // Pending OTP signup is OK to continue (they can resend), but warn if desired.
          // Treat only completed accounts as blocking for pre-validation of "already present".
          if (pending) {
            // Allow continue — user may be retrying OTP. Not marked unavailable.
          }
        }
      }
    }

    if (organizationName) {
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id, name')
        .ilike('name', organizationName)
        .maybeSingle();

      if (existingOrg) {
        organizationAvailable = false;
        organizationError = `Organization "${organizationName}" already exists. Choose a different name.`;
      }
    }

    const available = emailAvailable && organizationAvailable;
    return {
      success: true,
      available,
      email,
      organization_name: organizationName,
      emailAvailable,
      organizationAvailable,
      emailError,
      organizationError,
      error: available
        ? null
        : [emailError, organizationError].filter(Boolean).join(' '),
    };
  } catch (error) {
    console.error('checkSignupAvailability error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Availability check failed',
    };
  }
}
