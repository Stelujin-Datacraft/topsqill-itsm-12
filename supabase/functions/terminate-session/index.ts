import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to verify they're authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { sessionId, targetUserId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

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
});
