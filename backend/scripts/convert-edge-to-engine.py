#!/usr/bin/env python3
"""Convert Supabase edge functions to NestJS engine modules."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EDGE_DIR = ROOT / "supabase" / "functions"
OUT_DIR = ROOT / "backend" / "src" / "engines"

SKIP = {
    "execute-workflow",
    "resume-waiting-workflows",
    "execute-data-feed",
    "discover-external-fields",
}

EXPORT_NAMES = {
    "accept-user-invitation": "acceptUserInvitation",
    "admin-change-password": "adminChangePassword",
    "ai-assistant": "aiAssistant",
    "ai-copilot-action": "aiCopilotAction",
    "analyze-performance": "analyzePerformance",
    "asset-agent-report": "assetAgentReport",
    "delete-user": "deleteUser",
    "enqueue-workflow": "enqueueWorkflow",
    "form-api": "createFormApiHandler",
    "idp-oauth-callback": "idpOauthCallback",
    "ldap-authenticate": "ldapAuthenticate",
    "ldap-sync": "ldapSync",
    "ldap-test-connection": "ldapTestConnection",
    "notify-failure": "notifyFailure",
    "policy-preview": "policyPreview",
    "policy-review-reminders": "policyReviewReminders",
    "predict-sla-breach": "predictSlaBreach",
    "process-sla-escalations": "processSlaEscalations",
    "process-workflow-queue": "processWorkflowQueue",
    "public-api": "createPublicApiApp",
    "run-scheduled-data-feeds": "runScheduledDataFeeds",
    "send-delegation-email": "sendDelegationEmail",
    "send-invitation-email": "sendInvitationEmail",
    "send-kb-notification-email": "sendKbNotificationEmail",
    "send-mfa-code": "sendMfaCode",
    "send-password-reset": "sendPasswordReset",
    "send-template-email": "sendTemplateEmail",
    "send-user-invitation": "sendUserInvitation",
    "send-welcome-email": "sendWelcomeEmail",
    "terminate-session": "terminateSession",
    "test-smtp-connection": "testSmtpConnection",
    "verify-mfa-code": "verifyMfaCode",
}


def camel(name: str) -> str:
    return EXPORT_NAMES.get(name, "".join(p.title() for p in name.split("-")))


def strip_imports(text: str) -> str:
    text = re.sub(r"import \{ serve \} from [^;]+;\n?", "", text)
    text = re.sub(r"import \{ createClient \} from [^;]+;\n?", "", text)
    text = re.sub(r"import \{ Hono \} from [^;]+;\n?", "", text)
    text = re.sub(r"import \{ SMTPClient \} from [^;]+;\n?", "", text)
    return text


def replace_create_client_assignments(text: str) -> str:
    for var in ("supabaseAdmin", "adminClient", "supabaseClient", "userClient"):
        pattern = rf"const {var} = createClient\("
        while True:
            m = re.search(pattern, text)
            if not m:
                break
            start = m.start()
            paren = text.find("(", m.end() - 1)
            depth = 1
            i = paren + 1
            while i < len(text) and depth > 0:
                ch = text[i]
                if ch in ("'", '"', "`"):
                    quote = ch
                    i += 1
                    while i < len(text):
                        if text[i] == "\\":
                            i += 2
                            continue
                        if text[i] == quote:
                            i += 1
                            break
                        i += 1
                    continue
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                i += 1
            while i < len(text) and text[i] in " \t":
                i += 1
            if i < len(text) and text[i] == ";":
                i += 1
            text = text[:start] + f"const {var} = supabase;" + text[i:]

    while True:
        m = re.search(r"const supabase = createClient\(", text)
        if not m:
            break
        start = m.start()
        paren = text.find("(", m.end() - 1)
        depth = 1
        i = paren + 1
        while i < len(text) and depth > 0:
            ch = text[i]
            if ch in ("'", '"', "`"):
                quote = ch
                i += 1
                while i < len(text):
                    if text[i] == "\\":
                        i += 2
                        continue
                    if text[i] == quote:
                        i += 1
                        break
                    i += 1
                continue
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            i += 1
        while i < len(text) and text[i] in " \t":
            i += 1
        if i < len(text) and text[i] == ";":
            i += 1
        text = text[:start] + text[i:]
    return text


def transform_common(text: str) -> str:
    text = strip_imports(text)
    text = re.sub(r"Deno\.env\.get\('([^']+)'\)", r"ctx.getEnv('\1')", text)
    text = re.sub(r'Deno\.env\.get\("([^"]+)"\)', r'ctx.getEnv("\1")', text)
    text = text.replace("waitUntil(", "ctx.defer(")
    text = re.sub(
        r"req\.headers\.get\('([^']+)'\)",
        r"ctx.getHeader('\1')",
        text,
    )
    text = re.sub(
        r'req\.headers\.get\("([^"]+)"\)',
        r'ctx.getHeader("\1")',
        text,
    )
    text = replace_create_client_assignments(text)
    text = text.replace(
        "const getSupabaseClient = () => {\n  const supabaseUrl = ctx.getEnv('SUPABASE_URL')!;\n  const supabaseKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')!;\n  return createClient(supabaseUrl, supabaseKey);\n};",
        "const getSupabaseClient = () => supabase;",
    )
    text = text.replace(
        "function getServiceClient() {\n  return createClient(supabaseUrl, supabaseServiceKey);\n}",
        "function getServiceClient() { return supabase; }",
    )
    return text


def extract_handler_body(text: str) -> str:
    patterns = [
        r"Deno\.serve\(async \(req\) => \{",
        r"serve\(async \(req\) => \{",
        r"const handler = async \(req(?:: Request)?[^)]*\)(?:: Promise<Response>)? => \{",
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if not m:
            continue
        start = m.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            ch = text[i]
            if ch in ("'", '"', "`"):
                quote = ch
                i += 1
                while i < len(text):
                    if text[i] == "\\":
                        i += 2
                        continue
                    if text[i] == quote:
                        i += 1
                        break
                    i += 1
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            i += 1
        return text[start : i - 1]
    return ""


def extract_preamble(text: str) -> str:
    for marker in ["Deno.serve", "serve(handler)", "serve(async", "const handler = async"]:
        idx = text.find(marker)
        if idx != -1:
            return strip_imports(text[:idx])
    return strip_imports(text)


def remove_options_block(text: str) -> str:
    text = re.sub(
        r"if \(req\.method === ['\"]OPTIONS['\"]\)\s*return new Response\([^;]+;\s*",
        "",
        text,
    )
    marker = re.search(r"if \(req\.method === ['\"]OPTIONS['\"]\)", text)
    if not marker:
        return text
    start = marker.start()
    brace_start = text.find("{", marker.end())
    if brace_start == -1:
        return text
    depth = 1
    i = brace_start + 1
    while i < len(text) and depth > 0:
        ch = text[i]
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            while i < len(text):
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        i += 1
    return text[:start] + text[i:]


def cleanup_handler_tail(inner: str) -> str:
    inner = inner.rstrip()
    inner = re.sub(r"\n\}\);\s*$", "", inner)
    inner = re.sub(r"\n\}\)\s*$", "", inner)
    return inner


def post_process_inner(inner: str) -> str:
    inner = remove_options_block(inner)
    inner = cleanup_handler_tail(inner)
    inner = re.sub(
        r"console\.log\('🚀 Function started - Method:', req\.method\)\s*",
        "",
        inner,
        count=1,
    )
    inner = re.sub(r"await req\.json\(\)", "body", inner)
    inner = re.sub(r"const requestBody = body", "const requestBody = body as any", inner, count=1)
    inner = re.sub(r"const \{([^}]+)\} = await req\.json\(\)", r"const {\1} = body as any", inner)
    inner = re.sub(r"const (\w+): [^=]+ = body;", r"const \1 = body as any;", inner)
    inner = re.sub(r"= /\* supabase injected \*/", "= supabase", inner)
    inner = re.sub(r"\n\s*serve\(handler\);\s*", "\n", inner)
    return inner


def build_standard_engine(fn_name: str, original: str, inner: str) -> str:
    export = camel(fn_name)
    preamble = transform_common(extract_preamble(original))
    inner = post_process_inner(transform_common(inner))

    return f"""// @ts-nocheck
import type {{ SupabaseClient }} from '@supabase/supabase-js';
import type {{ EngineContext }} from './shared/engine-context';
import {{ SMTPClient }} from './shared/smtp-client';

{preamble}

export async function {export}(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {{
{inner}
}}
"""


def build_public_api_engine(original: str) -> str:
    text = transform_common(original)
    text = strip_imports(text)
    text = text.replace(
        "function getServiceClient() {\n  return createClient(supabaseUrl, supabaseServiceKey);\n}",
        "function getServiceClient() { return supabase; }",
    )
    text = re.sub(
        r"async function hashApiKey\(key: string\): Promise<string> \{[\s\S]*?\n\}",
        """async function hashApiKey(key: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(key).digest('hex');
}""",
        text,
    )
    text = re.sub(r"Deno\.serve\(app\.fetch\);?\s*", "", text)
    text = re.sub(r"const supabaseUrl = ctx\.getEnv\('SUPABASE_URL'\)!;\s*", "", text)
    text = re.sub(r"const supabaseServiceKey = ctx\.getEnv\('SUPABASE_SERVICE_ROLE_KEY'\)!;\s*", "", text)
    return f"""// @ts-nocheck
import {{ Hono }} from 'hono';
import type {{ SupabaseClient }} from '@supabase/supabase-js';
import type {{ EngineContext }} from './shared/engine-context';

export function createPublicApiApp(supabase: SupabaseClient, _ctx: EngineContext) {{
{text}
  return app;
}}
"""


def build_form_api_engine(original: str) -> str:
    preamble = transform_common(extract_preamble(original))
    inner = extract_handler_body(original)
    inner = transform_common(inner)
    inner = remove_options_block(inner)
    inner = inner.replace("const supabase = getSupabaseClient();", "")

    return f"""// @ts-nocheck
import type {{ SupabaseClient }} from '@supabase/supabase-js';
import type {{ EngineContext }} from './shared/engine-context';

{preamble}

export function createFormApiHandler(supabase: SupabaseClient, _ctx: EngineContext) {{
  return async (req: Request): Promise<Response> => {{
{inner}
  }};
}}
"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    converted = []
    for fn_dir in sorted(EDGE_DIR.iterdir()):
        if not fn_dir.is_dir():
            continue
        fn_name = fn_dir.name
        if fn_name in SKIP:
            continue
        src = fn_dir / "index.ts"
        if not src.exists():
            continue
        original = src.read_text()
        if fn_name == "public-api":
            out = build_public_api_engine(original)
        elif fn_name == "form-api":
            out = build_form_api_engine(original)
        else:
            inner = extract_handler_body(original)
            if not inner:
                print(f"SKIP (no handler): {fn_name}")
                continue
            out = build_standard_engine(fn_name, original, inner)
        out_path = OUT_DIR / f"{fn_name}.engine.ts"
        out_path.write_text(out)
        converted.append(fn_name)
        print(f"converted {fn_name}")

    index_lines = ["// Auto-generated engine registry"]
    for name in converted:
        exp = camel(name)
        index_lines.append(f"export {{ {exp} }} from './{name}.engine';")
    (OUT_DIR / "index.ts").write_text("\n".join(index_lines) + "\n")
    print(f"Done: {len(converted)} engines")


if __name__ == "__main__":
    main()
