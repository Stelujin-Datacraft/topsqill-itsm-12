/**
 * API key AI Suggest — draft permissions + key settings from natural language.
 * Client heuristic always works; optional LLM (suggest-api-key) can refine.
 */

export const API_KEY_PERMISSION_OPTIONS = {
  forms: ['read', 'create', 'update', 'delete'],
  submissions: ['read', 'create', 'update', 'delete'],
  workflows: ['read', 'create', 'update', 'delete', 'trigger'],
  reports: ['read', 'create', 'update', 'delete'],
  users: ['read'],
} as const;

export type ApiKeyResource = keyof typeof API_KEY_PERMISSION_OPTIONS;

export type ApiKeyPermissions = {
  forms: string[];
  submissions: string[];
  workflows: string[];
  reports: string[];
  users: string[];
};

export type ApiKeySuggestionDraft = {
  name: string;
  description: string;
  permissions: ApiKeyPermissions;
  rateLimit: number;
  allowedIps: string;
  expiresInDays: string;
  explanation: string;
  summary?: string;
};

const emptyPermissions = (): ApiKeyPermissions => ({
  forms: [],
  submissions: [],
  workflows: [],
  reports: [],
  users: [],
});

export function normalizeApiKeyPermissions(raw: unknown): ApiKeyPermissions {
  const out = emptyPermissions();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  (Object.keys(API_KEY_PERMISSION_OPTIONS) as ApiKeyResource[]).forEach((resource) => {
    const allowed = API_KEY_PERMISSION_OPTIONS[resource] as readonly string[];
    const values = Array.isArray(src[resource]) ? src[resource] : [];
    out[resource] = values
      .map((v) => String(v).toLowerCase().trim())
      .filter((v) => allowed.includes(v));
  });
  return out;
}

function titleCaseFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  if (!cleaned) return 'Integration API Key';
  const words = cleaned.split(' ').slice(0, 6);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function extractRateLimit(text: string): number | null {
  const m =
    text.match(/(\d+)\s*(?:req(?:uests?)?\/?\s*(?:min|minute)|rpm)/i)
    || text.match(/rate\s*limit(?:\s*of)?\s*(\d+)/i)
    || text.match(/(\d+)\s*per\s*minute/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(1000, Math.max(1, n));
}

function extractExpiryDays(text: string): string {
  const m =
    text.match(/expir(?:e|es|ing|y)?\s*(?:in\s*)?(\d+)\s*days?/i)
    || text.match(/(\d+)\s*days?\s*(?:expiry|expiration|valid)/i);
  return m ? String(parseInt(m[1], 10)) : '';
}

function extractIps(text: string): string {
  const ips = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
  return [...new Set(ips)].join(', ');
}

function addActions(perms: ApiKeyPermissions, resource: ApiKeyResource, actions: string[]) {
  const allowed = API_KEY_PERMISSION_OPTIONS[resource] as readonly string[];
  const next = new Set(perms[resource]);
  actions.forEach((a) => {
    if (allowed.includes(a)) next.add(a);
  });
  perms[resource] = [...next];
}

/**
 * Deterministic NL → API key draft. Used as primary result or AI fallback.
 */
export function suggestApiKeyFromPrompt(prompt: string): ApiKeySuggestionDraft {
  const text = String(prompt || '').trim();
  const lower = text.toLowerCase();

  const permissions = emptyPermissions();
  const readOnly =
    /\bread[-\s]?only\b/.test(lower)
    || /\bview[-\s]?only\b/.test(lower)
    || /\bjust\s+read\b/.test(lower)
    || /\bno\s+write\b/.test(lower);

  const wantsWrite =
    !readOnly
    && (/\b(write|create|update|delete|mutate|full\s+access|admin)\b/.test(lower)
      || /\bcrud\b/.test(lower));

  const wantsTrigger = /\btrigger\b/.test(lower) || /\brun\s+workflow/.test(lower);

  const mentionForms = /\bforms?\b/.test(lower);
  const mentionSubs =
    /\bsubmissions?\b/.test(lower)
    || /\bform\s+data\b/.test(lower)
    || /\brecords?\b/.test(lower);
  const mentionWorkflows = /\bworkflows?\b/.test(lower) || wantsTrigger;
  const mentionReports =
    /\breports?\b/.test(lower)
    || /\banalytics\b/.test(lower)
    || /\bdashboards?\b/.test(lower);
  const mentionUsers = /\busers?\b/.test(lower) || /\bpeople\b/.test(lower);

  const anyMention =
    mentionForms || mentionSubs || mentionWorkflows || mentionReports || mentionUsers;

  const readActions = ['read'];
  const writeActions = ['read', 'create', 'update', 'delete'];

  const applyResource = (resource: ApiKeyResource, includeTrigger = false) => {
    if (readOnly) {
      addActions(permissions, resource, readActions);
    } else if (wantsWrite) {
      addActions(permissions, resource, writeActions);
    } else {
      addActions(permissions, resource, readActions);
    }
    if (includeTrigger && !readOnly) {
      addActions(permissions, resource, ['trigger']);
    }
  };

  if (!anyMention) {
    // Sensible default: read forms + submissions + reports
    applyResource('forms');
    applyResource('submissions');
    applyResource('reports');
  } else {
    if (mentionForms) applyResource('forms');
    if (mentionSubs) applyResource('submissions');
    if (mentionWorkflows) applyResource('workflows', wantsTrigger || mentionWorkflows);
    if (mentionReports) applyResource('reports');
    if (mentionUsers) addActions(permissions, 'users', ['read']);
  }

  // Ensure at least one permission
  const total = Object.values(permissions).reduce((n, a) => n + a.length, 0);
  if (total === 0) {
    permissions.forms = ['read'];
    permissions.submissions = ['read'];
  }

  const rateLimit = extractRateLimit(lower) ?? (readOnly ? 120 : 60);
  const expiresInDays = extractExpiryDays(lower);
  const allowedIps = extractIps(text);

  const nameHint =
    text.match(/(?:for|named?|called)\s+["']?([A-Za-z0-9][\w\s-]{1,40})["']?/i)?.[1]
    || titleCaseFromPrompt(text);

  const name = `${nameHint.replace(/\s+/g, ' ').trim()} API Key`.slice(0, 80);
  const description =
    text.length > 160 ? `${text.slice(0, 157)}…` : text || 'API key suggested from natural language';

  const permSummary = (Object.keys(permissions) as ApiKeyResource[])
    .filter((r) => permissions[r].length > 0)
    .map((r) => `${r}: ${permissions[r].join(', ')}`)
    .join('; ');

  return {
    name,
    description,
    permissions,
    rateLimit,
    allowedIps,
    expiresInDays,
    explanation: readOnly
      ? `Read-only key inferred from your prompt. Permissions → ${permSummary}.`
      : `Key draft inferred from your prompt. Permissions → ${permSummary}.`,
    summary: 'Review the suggested permissions and limits, then apply to open the create form.',
  };
}

/** Merge AI JSON into a safe draft; falls back to heuristic for missing pieces. */
export function mergeApiKeySuggestion(
  prompt: string,
  ai: Partial<ApiKeySuggestionDraft> | null | undefined,
): ApiKeySuggestionDraft {
  const base = suggestApiKeyFromPrompt(prompt);
  if (!ai || typeof ai !== 'object') return base;

  const permissions = normalizeApiKeyPermissions(ai.permissions ?? base.permissions);
  const total = Object.values(permissions).reduce((n, a) => n + a.length, 0);

  return {
    name: String(ai.name || base.name).trim().slice(0, 80) || base.name,
    description: String(ai.description || base.description).trim().slice(0, 500) || base.description,
    permissions: total > 0 ? permissions : base.permissions,
    rateLimit: (() => {
      const n = Number(ai.rateLimit ?? base.rateLimit);
      if (!Number.isFinite(n)) return base.rateLimit;
      return Math.min(1000, Math.max(1, Math.round(n)));
    })(),
    allowedIps: String(ai.allowedIps ?? base.allowedIps).trim(),
    expiresInDays: String(ai.expiresInDays ?? base.expiresInDays).replace(/[^\d]/g, ''),
    explanation: String(ai.explanation || base.explanation),
    summary: String(ai.summary || base.summary || ''),
  };
}
