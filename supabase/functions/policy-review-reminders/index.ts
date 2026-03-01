import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const warningDays = 7;
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + warningDays);

    // Find policies with review dates coming up in the next 7 days or already overdue
    const { data: policies, error } = await supabase
      .from("policies")
      .select("id, name, policy_number, next_review_date, owner_id, created_by, status")
      .in("status", ["published"])
      .not("next_review_date", "is", null)
      .lte("next_review_date", warningDate.toISOString().split("T")[0])
      .order("next_review_date");

    if (error) throw error;

    let notificationCount = 0;

    for (const policy of policies || []) {
      const recipientId = policy.owner_id || policy.created_by;
      if (!recipientId) continue;

      const isOverdue = new Date(policy.next_review_date) < now;

      // Check if we already sent a notification for this policy today
      const today = now.toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", recipientId)
        .eq("type", "policy_review_reminder")
        .gte("created_at", today)
        .contains("data", { policy_id: policy.id })
        .maybeSingle();

      if (existing) continue;

      await supabase.from("notifications").insert({
        user_id: recipientId,
        type: "policy_review_reminder",
        title: isOverdue ? "Policy Review Overdue" : "Policy Review Coming Up",
        message: isOverdue
          ? `Policy "${policy.name}" (${policy.policy_number || "N/A"}) review was due on ${policy.next_review_date}.`
          : `Policy "${policy.name}" (${policy.policy_number || "N/A"}) is due for review on ${policy.next_review_date}.`,
        data: {
          policy_id: policy.id,
          policy_name: policy.name,
          next_review_date: policy.next_review_date,
          is_overdue: isOverdue,
          link: `/policy/${policy.id}`,
        },
      });
      notificationCount++;
    }

    return new Response(
      JSON.stringify({ success: true, notifications_sent: notificationCount, policies_checked: policies?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
