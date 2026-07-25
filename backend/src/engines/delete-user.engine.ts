// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';

export async function deleteUser(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {
  try {
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    const authHeader = ctx.getHeader('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !callingUser) {
      throw new Error('Invalid authentication');
    }

    if (callingUser.id === userId) {
      throw new Error('You cannot delete your own account');
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('user_profiles')
      .select('role, organization_id')
      .eq('id', callingUser.id)
      .single();

    if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
      throw new Error('Only administrators can delete users');
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('user_profiles')
      .select('id, organization_id, email')
      .eq('id', userId)
      .single();

    if (targetProfileError || !targetProfile) {
      throw new Error('User not found');
    }

    if (targetProfile.organization_id !== callerProfile.organization_id) {
      throw new Error('You can only delete users in your organization');
    }

    // Remove dependent rows that may block profile/auth deletion
    const cleanupTables = [
      { table: 'user_role_assignments', column: 'user_id' },
      { table: 'project_users', column: 'user_id' },
      { table: 'user_organizations', column: 'user_id' },
      { table: 'user_security_parameters', column: 'user_id' },
      { table: 'notifications', column: 'user_id' },
      { table: 'saved_queries', column: 'user_id' },
    ] as const;

    for (const { table, column } of cleanupTables) {
      const { error } = await supabase.from(table).delete().eq(column, userId);
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
      }
    }

    const { error: profileDeleteError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      throw new Error(`Failed to delete user profile: ${profileDeleteError.message}`);
    }

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      throw new Error(`Failed to delete user: ${authDeleteError.message}`);
    }

    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    console.error('delete-user error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return { success: false, error: message };
  }
}
