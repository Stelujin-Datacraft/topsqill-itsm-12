/**
 * Server-side Supabase client for VIS persistence.
 * Uses the service-role key only. Never the anon key, and never a browser client.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSupabaseConfigured } from './vis-persistence-mode';

export interface VisSupabaseQuery {
  select(columns?: string): this;
  insert(row: Record<string, unknown> | Record<string, unknown>[]): this;
  update(patch: Record<string, unknown>): this;
  upsert(row: Record<string, unknown>, options?: { onConflict?: string }): this;
  delete(): this;
  eq(column: string, value: unknown): this;
  is(column: string, value: null): this;
  order(column: string, options?: { ascending?: boolean }): this;
  range(from: number, to: number): this;
  limit(count: number): this;
  single(): Promise<{ data: any; error: any }>;
  maybeSingle(): Promise<{ data: any; error: any }>;
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

/** Minimal surface VisStore uses, implemented by @supabase/supabase-js. */
export interface VisSupabaseClient {
  from(table: string): VisSupabaseQuery;
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: any }>;
}

let override: VisSupabaseClient | null = null;
let singleton: SupabaseClient | null = null;

export function setVisSupabaseClientForTests(client: VisSupabaseClient | null): void {
  override = client;
  singleton = null;
}

export function getVisSupabase(): VisSupabaseClient {
  if (override) return override;
  if (!singleton) {
    assertSupabaseConfigured();
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    singleton = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return singleton as unknown as VisSupabaseClient;
}
