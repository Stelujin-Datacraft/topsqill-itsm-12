// Batched polling: invokes resume-waiting-workflows, run-scheduled-data-feeds,
// and process-workflow-queue concurrently from a single cron tick.
// This reduces cold starts by ~66% vs three separate cron jobs.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TARGETS = [
  'resume-waiting-workflows',
  'run-scheduled-data-feeds',
  'process-workflow-queue',
];

async function callFn(name: string) {
  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ source: 'batch-polling' }),
    });
    const duration = Date.now() - start;
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore non-json */ }
    return { fn: name, status: res.status, ok: res.ok, duration_ms: duration, body };
  } catch (err) {
    return {
      fn: name,
      status: 0,
      ok: false,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const overallStart = Date.now();
  // Run in parallel - they're independent jobs touching different tables
  const results = await Promise.all(TARGETS.map(callFn));
  const total_duration_ms = Date.now() - overallStart;

  const successCount = results.filter((r) => r.ok).length;

  return new Response(
    JSON.stringify({
      success: true,
      total_duration_ms,
      success_count: successCount,
      failure_count: results.length - successCount,
      results,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    },
  );
});
