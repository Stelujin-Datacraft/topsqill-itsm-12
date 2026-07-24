// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};



export async function terminateSession(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  // Handle CORS preflight requests
  

  try {
    const supabaseUrl = ctx.getEnv("SUPABASE_URL")!;
    const supabaseServiceRoleKey = ctx.getEnv("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = ctx.getEnv("SUPABASE_ANON_KEY")!;

    // Get the authorization header from the request
    const authHeader = ctx.getHeader("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to verify they're authenticated
    const userClient = supabase;

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { sessionId, targetUserId } = body;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const adminClient = supabase;

    // Check if user is admin or owns the session
    const { data: userProfile } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = userProfile?.role === "admin";

    // If not admin, verify user owns the session
    if (!isAdmin) {
      const { data: sessionData } = await adminClient
        .from("user_sessions")
        .select("user_id")
        .eq("id", sessionId)
        .single();

      if (sessionData?.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Not authorized to terminate this session" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get the session to terminate
    const { data: sessionToTerminate } = await adminClient
      .from("user_sessions")
      .select("session_token, user_id")
      .eq("id", sessionId)
      .single();

    if (!sessionToTerminate) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark session as inactive in our table
    const { error: updateError } = await adminClient
      .from("user_sessions")
      .update({ is_active: false })
      .eq("id", sessionId);

    if (updateError) {
      throw updateError;
    }

    // Log the action
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      event_type: "session_terminated",
      event_category: "security",
      description: `Session terminated by ${isAdmin ? "admin" : "user"}`,
      metadata: { 
        session_id: sessionId, 
        target_user_id: sessionToTerminate.user_id,
        terminated_by: user.id
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Session terminated successfully",
        note: "The session has been marked as inactive. The user will be logged out on their next request."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error terminating session:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
