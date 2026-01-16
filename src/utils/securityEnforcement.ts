// Security enforcement utilities

import { supabase } from '@/integrations/supabase/client';

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  remainingLockoutMinutes?: number;
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
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('access_start_time, access_end_time, allowed_days')
      .eq('user_id', userId)
      .maybeSingle();

    if (!securityParams) {
      return { allowed: true };
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Check allowed days
    if (securityParams.allowed_days && securityParams.allowed_days.length > 0) {
      if (!securityParams.allowed_days.includes(currentDay)) {
        return {
          allowed: false,
          reason: `Access is not permitted on ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}s.`,
        };
      }
    }

    // Check time restrictions
    if (securityParams.access_start_time && securityParams.access_end_time) {
      if (currentTime < securityParams.access_start_time || currentTime > securityParams.access_end_time) {
        return {
          allowed: false,
          reason: `Access is only permitted between ${securityParams.access_start_time} and ${securityParams.access_end_time}.`,
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
} | null> {
  try {
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('password_min_length, password_require_uppercase, password_require_lowercase, password_require_numbers, password_require_special')
      .eq('user_id', userId)
      .maybeSingle();

    if (!securityParams) {
      return {
        password_min_length: 9,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_special: true,
      };
    }

    return {
      password_min_length: securityParams.password_min_length || 9,
      password_require_uppercase: securityParams.password_require_uppercase ?? true,
      password_require_lowercase: securityParams.password_require_lowercase ?? true,
      password_require_numbers: securityParams.password_require_numbers ?? true,
      password_require_special: securityParams.password_require_special ?? true,
    };
  } catch (error) {
    console.error('Error getting password policy:', error);
    return null;
  }
}
