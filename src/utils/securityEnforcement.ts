// Security enforcement utilities

import { supabase } from '@/integrations/supabase/client';

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  remainingLockoutMinutes?: number;
  requiresMfa?: boolean;
  passwordExpired?: boolean;
  userId?: string;
}

/**
 * Check if user account is locked
 */
export async function checkAccountLockout(email: string): Promise<SecurityCheckResult> {
  try {
    // First get the user ID from email
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      return { allowed: true }; // User doesn't exist, let Supabase handle the error
    }

    // Get security parameters
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('account_locked_until, failed_login_count, max_failed_login_attempts')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (!securityParams) {
      return { allowed: true }; // No security params, allow login
    }

    // Check if account is locked
    if (securityParams.account_locked_until) {
      const lockedUntil = new Date(securityParams.account_locked_until);
      const now = new Date();

      if (lockedUntil > now) {
        const remainingMs = lockedUntil.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / 60000);

        return {
          allowed: false,
          reason: `Account is locked. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
          remainingLockoutMinutes: remainingMinutes,
        };
      }
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking account lockout:', error);
    return { allowed: true }; // On error, allow login attempt
  }
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(email: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, organization_id')
      .eq('email', email)
      .maybeSingle();

    if (!profile) return;

    // Get or create security parameters
    let { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('id, failed_login_count, max_failed_login_attempts, lockout_duration_minutes')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (!securityParams) {
      // Create default security parameters
      const { data: newParams } = await supabase
        .from('user_security_parameters')
        .insert({
          user_id: profile.id,
          organization_id: profile.organization_id,
        })
        .select('id, failed_login_count, max_failed_login_attempts, lockout_duration_minutes')
        .single();

      securityParams = newParams;
    }

    if (!securityParams) return;

    const newFailedCount = (securityParams.failed_login_count || 0) + 1;
    const maxAttempts = securityParams.max_failed_login_attempts || 3;
    const lockoutDuration = securityParams.lockout_duration_minutes || 30;

    // Check if we need to lock the account
    let accountLockedUntil = null;
    if (newFailedCount >= maxAttempts) {
      accountLockedUntil = new Date(Date.now() + lockoutDuration * 60 * 1000).toISOString();
    }

    await supabase
      .from('user_security_parameters')
      .update({
        failed_login_count: newFailedCount,
        last_failed_login: new Date().toISOString(),
        account_locked_until: accountLockedUntil,
      })
      .eq('id', securityParams.id);
  } catch (error) {
    console.error('Error recording failed login:', error);
  }
}

/**
 * Record a successful login
 */
export async function recordSuccessfulLogin(userId: string): Promise<void> {
  try {
    await supabase
      .from('user_security_parameters')
      .update({
        failed_login_count: 0,
        account_locked_until: null,
        last_login: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error recording successful login:', error);
  }
}

/**
 * Check time-based access restrictions
 */
export async function checkAccessTimeRestrictions(userId: string): Promise<SecurityCheckResult> {
  try {
    // Fetch user security params with template data to respect use_template_settings
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select(`
        access_start_time, 
        access_end_time, 
        allowed_days,
        use_template_settings,
        security_template_id,
        security_templates (
          access_start_time,
          access_end_time,
          allowed_days
        )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (!securityParams) {
      return { allowed: true };
    }

    // Determine effective values based on use_template_settings
    const template = securityParams.security_templates;
    const useTemplate = securityParams.use_template_settings && template;
    
    const effectiveAllowedDays = useTemplate && template.allowed_days 
      ? template.allowed_days 
      : securityParams.allowed_days;
    
    const effectiveStartTime = useTemplate && template.access_start_time 
      ? template.access_start_time 
      : securityParams.access_start_time;
    
    const effectiveEndTime = useTemplate && template.access_end_time 
      ? template.access_end_time 
      : securityParams.access_end_time;

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Check allowed days
    if (effectiveAllowedDays && effectiveAllowedDays.length > 0) {
      if (!effectiveAllowedDays.includes(currentDay)) {
        return {
          allowed: false,
          reason: `Access is not permitted on ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}s.`,
        };
      }
    }

    // Check time restrictions
    if (effectiveStartTime && effectiveEndTime) {
      if (currentTime < effectiveStartTime || currentTime > effectiveEndTime) {
        return {
          allowed: false,
          reason: `Access is only permitted between ${effectiveStartTime} and ${effectiveEndTime}.`,
        };
      }
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking access time restrictions:', error);
    return { allowed: true };
  }
}

/**
 * Check if MFA is required for user
 */
export async function checkMfaRequired(userId: string): Promise<boolean> {
  try {
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('mfa_required')
      .eq('user_id', userId)
      .maybeSingle();

    return securityParams?.mfa_required ?? false;
  } catch (error) {
    console.error('Error checking MFA requirement:', error);
    return false;
  }
}

/**
 * Check if password has expired
 */
export async function checkPasswordExpiry(userId: string): Promise<SecurityCheckResult> {
  try {
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('password_expiry_days, last_password_change')
      .eq('user_id', userId)
      .maybeSingle();

    if (!securityParams || !securityParams.password_expiry_days) {
      return { allowed: true };
    }

    const lastChange = securityParams.last_password_change 
      ? new Date(securityParams.last_password_change)
      : null;

    // If no password change recorded, don't force change on first login
    // Only enforce expiry if there's a last_password_change and it has expired
    if (!lastChange) {
      return { allowed: true };
    }

    const expiryDate = new Date(lastChange.getTime() + securityParams.password_expiry_days * 24 * 60 * 60 * 1000);
    
    if (new Date() > expiryDate) {
      return { 
        allowed: false, 
        passwordExpired: true,
        reason: 'Your password has expired. Please set a new password.'
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking password expiry:', error);
    return { allowed: true };
  }
}

/**
 * Check IP restrictions (whitelist/blacklist)
 */
export async function checkIpRestrictions(userId: string, clientIp: string): Promise<SecurityCheckResult> {
  try {
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('ip_whitelist, ip_blacklist')
      .eq('user_id', userId)
      .maybeSingle();

    if (!securityParams) {
      return { allowed: true };
    }

    // Check blacklist first
    if (securityParams.ip_blacklist && securityParams.ip_blacklist.length > 0) {
      if (securityParams.ip_blacklist.includes(clientIp)) {
        return {
          allowed: false,
          reason: 'Access from your IP address is not permitted.',
        };
      }
    }

    // Check whitelist (if configured, only whitelisted IPs are allowed)
    if (securityParams.ip_whitelist && securityParams.ip_whitelist.length > 0) {
      if (!securityParams.ip_whitelist.includes(clientIp)) {
        return {
          allowed: false,
          reason: 'Access is only permitted from approved IP addresses.',
        };
      }
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking IP restrictions:', error);
    return { allowed: true };
  }
}

/**
 * Check concurrent session limit
 */
export async function checkConcurrentSessions(userId: string): Promise<SecurityCheckResult> {
  try {
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('max_concurrent_sessions')
      .eq('user_id', userId)
      .maybeSingle();

    const maxSessions = securityParams?.max_concurrent_sessions || 3;

    // Count active sessions
    const { count, error } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error counting sessions:', error);
      return { allowed: true };
    }

    if ((count || 0) >= maxSessions) {
      return {
        allowed: false,
        reason: `Maximum of ${maxSessions} concurrent sessions reached. Please log out from another device.`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking concurrent sessions:', error);
    return { allowed: true };
  }
}

/**
 * Create a new session record
 */
export async function createSession(userId: string, sessionToken: string): Promise<void> {
  try {
    // Get session timeout from security params
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('session_timeout_minutes')
      .eq('user_id', userId)
      .maybeSingle();

    const timeoutMinutes = securityParams?.session_timeout_minutes || 30;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

    // Capture user agent from browser
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        expires_at: expiresAt,
        user_agent: userAgent,
      });
  } catch (error) {
    console.error('Error creating session:', error);
  }
}

/**
 * Invalidate a session
 */
export async function invalidateSession(sessionToken: string): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('session_token', sessionToken);
  } catch (error) {
    console.error('Error invalidating session:', error);
  }
}

/**
 * Invalidate all sessions for a user (except current)
 */
export async function invalidateOtherSessions(userId: string, currentSessionToken?: string): Promise<void> {
  try {
    let query = supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (currentSessionToken) {
      query = query.neq('session_token', currentSessionToken);
    }

    await query;
  } catch (error) {
    console.error('Error invalidating sessions:', error);
  }
}

/**
 * Get user's session timeout settings
 */
export async function getSessionTimeoutSettings(userId: string): Promise<{
  timeoutMinutes: number;
  warningSeconds: number;
  staticTimeout: boolean;
} | null> {
  try {
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('session_timeout_minutes, session_timeout_warning_seconds, static_session_timeout')
      .eq('user_id', userId)
      .maybeSingle();

    if (!securityParams) {
      return {
        timeoutMinutes: 30,
        warningSeconds: 60,
        staticTimeout: false,
      };
    }

    return {
      timeoutMinutes: securityParams.session_timeout_minutes || 30,
      warningSeconds: securityParams.session_timeout_warning_seconds || 60,
      staticTimeout: securityParams.static_session_timeout || false,
    };
  } catch (error) {
    console.error('Error getting session timeout settings:', error);
    return null;
  }
}

/**
 * Fetch user's password policy
 */
export async function getUserPasswordPolicy(userId: string): Promise<{
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  password_history_count: number;
  password_change_min_hours: number;
} | null> {
  try {
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('password_min_length, password_require_uppercase, password_require_lowercase, password_require_numbers, password_require_special, password_history_count, password_change_min_hours')
      .eq('user_id', userId)
      .maybeSingle();

    if (!securityParams) {
      return {
        password_min_length: 9,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_special: true,
        password_history_count: 5,
        password_change_min_hours: 24,
      };
    }

    return {
      password_min_length: securityParams.password_min_length || 9,
      password_require_uppercase: securityParams.password_require_uppercase ?? true,
      password_require_lowercase: securityParams.password_require_lowercase ?? true,
      password_require_numbers: securityParams.password_require_numbers ?? true,
      password_require_special: securityParams.password_require_special ?? true,
      password_history_count: securityParams.password_history_count ?? 5,
      password_change_min_hours: securityParams.password_change_min_hours ?? 24,
    };
  } catch (error) {
    console.error('Error getting password policy:', error);
    return null;
  }
}

/**
 * Get organization password policy for signup (before user exists)
 */
export async function getOrganizationPasswordPolicy(organizationId: string): Promise<{
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
} | null> {
  try {
    const { data: orgDefaults } = await supabase
      .from('organization_security_defaults')
      .select('password_min_length, password_require_uppercase, password_require_lowercase, password_require_numbers, password_require_special')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!orgDefaults) {
      return {
        password_min_length: 9,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_special: true,
      };
    }

    return {
      password_min_length: orgDefaults.password_min_length || 9,
      password_require_uppercase: orgDefaults.password_require_uppercase ?? true,
      password_require_lowercase: orgDefaults.password_require_lowercase ?? true,
      password_require_numbers: orgDefaults.password_require_numbers ?? true,
      password_require_special: orgDefaults.password_require_special ?? true,
    };
  } catch (error) {
    console.error('Error getting organization password policy:', error);
    return null;
  }
}

/**
 * Send MFA code via edge function
 */
export async function sendMfaCode(email: string, userId: string): Promise<{ success: boolean; error?: string; expiryMinutes?: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-mfa-code', {
      body: { email, userId },
    });

    if (error) {
      console.error('Error sending MFA code:', error);
      return { success: false, error: 'Failed to send verification code' };
    }

    return { success: true, expiryMinutes: data.expiryMinutes };
  } catch (error) {
    console.error('Error invoking send-mfa-code:', error);
    return { success: false, error: 'Failed to send verification code' };
  }
}

/**
 * Verify MFA code via edge function
 */
export async function verifyMfaCode(userId: string, code: string): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-mfa-code', {
      body: { userId, code },
    });

    if (error) {
      console.error('Error verifying MFA code:', error);
      return { success: false, error: 'Failed to verify code' };
    }

    if (!data.success) {
      return { 
        success: false, 
        error: data.error,
        remainingAttempts: data.remainingAttempts 
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error invoking verify-mfa-code:', error);
    return { success: false, error: 'Failed to verify code' };
  }
}
