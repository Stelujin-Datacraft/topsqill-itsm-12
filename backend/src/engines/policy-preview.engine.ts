// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};



export async function policyPreview(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  

  try {
    const url = new URL(req.url);
    const policyId = url.searchParams.get("id");

    if (!policyId) {
      return new Response(JSON.stringify({ error: "Missing policy id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = ctx.getEnv("SUPABASE_URL")!;
    const supabaseKey = ctx.getEnv("SUPABASE_SERVICE_ROLE_KEY")!;
    

    // Fetch policy
    const { data: policy, error } = await supabase
      .from("policies")
      .select("id, name, policy_number, attachments, content, status")
      .eq("id", policyId)
      .single();

    if (error || !policy) {
      return new Response(JSON.stringify({ error: "Policy not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for attached files (PDF or DOCX)
    const attachments = (policy.attachments as any[]) || [];
    const fileAttachment = attachments.find(
      (a: any) =>
        a.url &&
        (a.url.endsWith(".pdf") ||
          a.url.endsWith(".docx") ||
          a.url.endsWith(".doc") ||
          a.type === "file" ||
          a.type === "document")
    );

    if (fileAttachment?.url) {
      const fileUrl = fileAttachment.url;
      const isPdf =
        fileUrl.toLowerCase().endsWith(".pdf") ||
        fileAttachment.name?.toLowerCase().endsWith(".pdf");
      const isDocx =
        fileUrl.toLowerCase().endsWith(".docx") ||
        fileUrl.toLowerCase().endsWith(".doc") ||
        fileAttachment.name?.toLowerCase().endsWith(".docx") ||
        fileAttachment.name?.toLowerCase().endsWith(".doc");

      if (isDocx) {
        // Redirect to Microsoft Office Online Viewer
        const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: viewerUrl,
          },
        });
      }

      if (isPdf) {
        // Fetch the PDF and serve it inline
        try {
          const fileResponse = await fetch(fileUrl);
          if (!fileResponse.ok) {
            throw new Error(`Failed to fetch file: ${fileResponse.status}`);
          }
          const fileBuffer = await fileResponse.arrayBuffer();
          return new Response(fileBuffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="${policy.policy_number || policy.name}.pdf"`,
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch (fetchErr) {
          console.error("Error fetching PDF file:", fetchErr);
          // Fall through to return policy data for client-side generation
        }
      }
    }

    // No suitable file attachment found — return policy data for client-side PDF generation
    return new Response(
      JSON.stringify({
        mode: "client-generate",
        policy: {
          id: policy.id,
          name: policy.name,
          policy_number: policy.policy_number,
          status: policy.status,
          content: policy.content,
          attachments: policy.attachments,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("policy-preview error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
