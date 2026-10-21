/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Preferred client-side anon key name */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Legacy alias accepted by rawClient (same value as anon key) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_USE_BACKEND_API?: string;
  readonly VITE_ENVIRONMENT?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_PROMOTIONAL_TRANSFER_ENABLED?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_GSC_VERIFICATION?: string;
  readonly VITE_BING_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
