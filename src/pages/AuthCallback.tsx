import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl } from "@/services/api/apiClient";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * OIDC callback page. Exchanges the authorization code at the
 * NestJS LDAP OAuth callback endpoint, then signs the user in via the
 * returned magic-link token.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Finalizing sign-in…");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errorParam) {
          setStatus("error");
          setMessage(errorParam);
          return;
        }
        if (!code || !state) {
          setStatus("error");
          setMessage("Missing authorization code or state in callback URL.");
          return;
        }

        // Clear any stale/invalid session from prior failed attempts so the
        // edge function gateway doesn't reject our call with 401 due to a
        // bad Authorization header.
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }

        // Use a direct fetch instead of supabase.functions.invoke so the
        // browser never re-attaches a stale auth session token to this public
        // callback exchange request.
        const response = await fetch(`${getApiBaseUrl()}/ldap/oauth-callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state, redirectUri: window.location.origin + '/auth/callback' }),
        });

        const raw = await response.text();
        const data = raw ? JSON.parse(raw) : null;
        if (!response.ok) {
          throw new Error(data?.message || `Sign-in failed (${response.status})`);
        }
        if (!data?.success) throw new Error(data?.message || "Sign-in failed");

        const hashedToken: string | undefined = data.verification?.hashedToken;
        const email: string | undefined = data.email;
        if (hashedToken && email) {
          const { error: verifyErr } = await supabase.auth.verifyOtp({
            type: "email",
            token_hash: hashedToken,
          });
          if (verifyErr) throw verifyErr;
          navigate("/dashboard", { replace: true });
          return;
        }

        // Fallback: open the action_link directly
        if (data.verification?.actionLink) {
          window.location.href = data.verification.actionLink;
          return;
        }

        throw new Error("No sign-in token returned");
      } catch (err: any) {
        console.error("OIDC callback error:", err);
        setStatus("error");
        setMessage(err?.message || "Could not complete sign-in.");
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-4 border rounded-lg p-8 bg-card">
        {status === "working" ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Signing you in</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        ) : (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Sign-in failed</h1>
            <p className="text-sm text-muted-foreground break-words">{message}</p>
            <Button onClick={() => navigate("/auth", { replace: true })}>Back to sign-in</Button>
          </>
        )}
      </div>
    </div>
  );
}