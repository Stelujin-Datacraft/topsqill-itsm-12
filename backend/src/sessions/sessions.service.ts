import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { User } from '@supabase/supabase-js';

@Injectable()
export class SessionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async terminateSession(sessionId: string, user: User) {
    const adminClient = this.supabaseService.getServiceClient();

    const { data: userProfile } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    if (!isAdmin) {
      const { data: sessionData } = await adminClient
        .from('user_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single();

      if (sessionData?.user_id !== user.id) {
        throw new ForbiddenException('Not authorized to terminate this session');
      }
    }

    const { data: sessionToTerminate } = await adminClient
      .from('user_sessions')
      .select('session_token, user_id')
      .eq('id', sessionId)
      .single();

    if (!sessionToTerminate) {
      throw new NotFoundException('Session not found');
    }

    const { error: updateError } = await adminClient
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'session_terminated',
      event_category: 'security',
      description: `Session terminated by ${isAdmin ? 'admin' : 'user'}`,
      metadata: {
        session_id: sessionId,
        target_user_id: sessionToTerminate.user_id,
        terminated_by: user.id,
      },
    });

    return {
      success: true,
      message: 'Session terminated successfully',
      note: 'The session has been marked as inactive. The user will be logged out on their next request.',
    };
  }
}
