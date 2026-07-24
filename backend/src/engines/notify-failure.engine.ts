// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLDOWN_MINUTES = 30;

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function normalizeError(err: string): string {
  // Strip UUIDs, numbers, timestamps so the hash matches recurring failures
  return (err || 'unknown')
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID')
    .replace(/\d{4}-\d{2}-\d{2}t[\d:.+\-z]+/g, 'TS')
    .replace(/\b\d+\b/g, 'N')
    .slice(0, 500);
}



export async function notifyFailure(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  try {
    const { entity_type, entity_id, error, context } = body;

    if (!entity_type || !entity_id || !['workflow', 'data_feed'].includes(entity_type)) {
      return new Response(JSON.stringify({ error: 'Invalid entity_type or entity_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    

    // Load the entity to check toggle and resolve org/name
    const table = entity_type === 'workflow' ? 'workflows' : 'data_feeds';
    const { data: entity, error: entityErr } = await supabase
      .from(table)
      .select('id, name, notify_on_failure, organization_id, project_id, created_by')
      .eq('id', entity_id)
      .maybeSingle();

    if (entityErr || !entity) {
      return new Response(JSON.stringify({ skipped: 'entity_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (entity.notify_on_failure === false) {
      return new Response(JSON.stringify({ skipped: 'notifications_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const errorText = typeof error === 'string' ? error : JSON.stringify(error ?? 'unknown error');
    const errorHash = await sha256(normalizeError(errorText));

    // Dedup check
    const { data: existing } = await supabase
      .from('failure_notifications')
      .select('id, last_notified_at, occurrence_count')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .eq('error_hash', errorHash)
      .maybeSingle();

    const cooldownAgo = Date.now() - COOLDOWN_MINUTES * 60 * 1000;

    if (existing) {
      const lastMs = new Date(existing.last_notified_at).getTime();
      if (lastMs > cooldownAgo) {
        // Within cooldown — bump count, do not notify again
        await supabase
          .from('failure_notifications')
          .update({
            occurrence_count: (existing.occurrence_count || 1) + 1,
            updated_at: new Date().toISOString(),
            last_error: errorText.slice(0, 1000),
          })
          .eq('id', existing.id);
        return new Response(JSON.stringify({ skipped: 'cooldown', occurrence_count: existing.occurrence_count + 1 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Targeted recipients: entity owner + project owner (Set auto-dedupes if same person)
    const recipientIds = new Set<string>();
    if (entity.created_by) recipientIds.add(entity.created_by);

    if (entity.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', entity.project_id)
        .maybeSingle();
      if (project?.created_by) recipientIds.add(project.created_by);
    }

    if (recipientIds.size === 0) {
      return new Response(JSON.stringify({ skipped: 'no_recipients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const entityLabel = entity_type === 'workflow' ? 'Workflow' : 'Data Feed';
    const title = `${entityLabel} failed: ${entity.name || entity_id.slice(0, 8)}`;
    const message = errorText.length > 200 ? errorText.slice(0, 200) + '…' : errorText;

    const rows = Array.from(recipientIds).map((uid) => ({
      user_id: uid,
      type: entity_type === 'workflow' ? 'workflow_failure' : 'data_feed_failure',
      title,
      message,
      data: {
        entity_type,
        entity_id,
        entity_name: entity.name,
        error: errorText,
        context: context || null,
      },
      read: false,
    }));

    const { error: insertErr } = await supabase.from('notifications').insert(rows);
    if (insertErr) {
      console.error('notify-failure: insert error', insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert dedup record
    if (existing) {
      await supabase
        .from('failure_notifications')
        .update({
          last_notified_at: new Date().toISOString(),
          occurrence_count: (existing.occurrence_count || 1) + 1,
          last_error: errorText.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('failure_notifications').insert({
        entity_type,
        entity_id,
        error_hash: errorHash,
        last_notified_at: new Date().toISOString(),
        occurrence_count: 1,
        last_error: errorText.slice(0, 1000),
      });
    }

    return new Response(JSON.stringify({ notified: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('notify-failure error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
