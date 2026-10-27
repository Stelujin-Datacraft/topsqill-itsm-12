/**
 * Shared lead field normalisation for ALL RE ingest sources.
 */

export type NormalizeLeadInput = {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  budgetText?: string | null;
  customAnswers?: Record<string, unknown> | null;
  sourceLabel?: string | null;
  defaultCountryCode?: string; // e.g. '+91'
};

export type NormalizedLeadFields = {
  contactName: string;
  nameNormalized: string;
  contactEmail: string | null;
  emailNormalized: string | null;
  emailInvalid: boolean;
  phoneRaw: string | null;
  phoneE164: string | null;
  phoneInvalid: boolean;
  budgetRaw: string | null;
  budgetInr: number | null;
  customAnswers: Record<string, unknown>;
};

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Normalize phone to E.164. Default country +91. */
export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultCountryCode = '+91',
): { e164: string | null; raw: string | null; invalid: boolean } {
  if (raw == null || String(raw).trim() === '') {
    return { e164: null, raw: null, invalid: false };
  }
  const original = String(raw).trim();
  let digits = original.replace(/[^\d+]/g, '');

  // 0091… → +91…
  if (digits.startsWith('0091')) digits = `+91${digits.slice(4)}`;
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;

  // Strip spaces already handled; remove leading 0 after country
  const cc = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
  const ccDigits = cc.replace(/\D/g, '');

  if (digits.startsWith('+')) {
    let rest = digits.slice(1).replace(/\D/g, '');
    // Strip trunk 0 after known country code (e.g. +91 09876543210)
    if (rest.startsWith(ccDigits)) {
      let national = rest.slice(ccDigits.length).replace(/^0+/, '');
      if (national.length >= 8 && national.length <= 12 && !/^0+$/.test(national)) {
        return { e164: `+${ccDigits}${national}`, raw: original, invalid: false };
      }
    }
    // Generic: drop a single trunk 0 after 1–3 digit country code
    const m = rest.match(/^([1-9]\d{0,2})0+(\d{8,12})$/);
    if (m) rest = `${m[1]}${m[2]}`;
    if (rest.length < 8 || rest.length > 15 || /^0+$/.test(rest)) {
      return { e164: null, raw: original, invalid: true };
    }
    return { e164: `+${rest}`, raw: original, invalid: false };
  }

  let local = digits.replace(/\D/g, '');
  // 91XXXXXXXXXX without +
  if (local.startsWith(ccDigits) && local.length > ccDigits.length + 6) {
    local = local.slice(ccDigits.length);
  }
  // leading 0 trunk
  if (local.startsWith('0')) local = local.replace(/^0+/, '');

  if (local.length < 8 || local.length > 12 || /^0+$/.test(local)) {
    return { e164: null, raw: original, invalid: true };
  }
  return { e164: `+${ccDigits}${local}`, raw: original, invalid: false };
}

export function normalizeEmail(raw: string | null | undefined): {
  email: string | null;
  normalized: string | null;
  invalid: boolean;
} {
  if (raw == null || String(raw).trim() === '') {
    return { email: null, normalized: null, invalid: false };
  }
  const trimmed = String(raw).trim();
  const normalized = trimmed.toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  return { email: trimmed, normalized, invalid: !ok };
}

export function normalizeName(
  raw: string | null | undefined,
  sourceLabel?: string | null,
): { display: string; normalized: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    const label = sourceLabel ? String(sourceLabel).replace(/_/g, ' ') : 'source';
    const display = `Unknown (${label})`;
    return { display, normalized: display.toLowerCase() };
  }
  const display = titleCase(trimmed);
  return { display, normalized: display.toLowerCase() };
}

/**
 * Parse Indian budget strings into INR number.
 * Supports: "1.5 Cr", "80 L", "80 lakh", "₹1,20,00,000", "1200000", "2 crore"
 */
export function parseBudgetInr(raw: string | null | undefined): {
  budgetRaw: string | null;
  budgetInr: number | null;
} {
  if (raw == null || String(raw).trim() === '') {
    return { budgetRaw: null, budgetInr: null };
  }
  const budgetRaw = String(raw).trim();
  let s = budgetRaw.toLowerCase().replace(/₹/g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();

  const crore = s.match(/^([\d.]+)\s*(cr|crore|crores)\b/);
  if (crore) {
    return { budgetRaw, budgetInr: Math.round(parseFloat(crore[1]) * 10_000_000) };
  }
  const lakh = s.match(/^([\d.]+)\s*(l|lac|lacs|lakh|lakhs)\b/);
  if (lakh) {
    return { budgetRaw, budgetInr: Math.round(parseFloat(lakh[1]) * 100_000) };
  }
  const plain = s.match(/^([\d.]+)$/);
  if (plain) {
    return { budgetRaw, budgetInr: Math.round(parseFloat(plain[1])) };
  }
  // embedded number e.g. "around 90 lakh only"
  const embeddedCr = s.match(/([\d.]+)\s*(cr|crore)/);
  if (embeddedCr) {
    return { budgetRaw, budgetInr: Math.round(parseFloat(embeddedCr[1]) * 10_000_000) };
  }
  const embeddedL = s.match(/([\d.]+)\s*(l|lac|lakh)/);
  if (embeddedL) {
    return { budgetRaw, budgetInr: Math.round(parseFloat(embeddedL[1]) * 100_000) };
  }
  return { budgetRaw, budgetInr: null };
}

export function normalizeLeadFields(input: NormalizeLeadInput): NormalizedLeadFields {
  const country = input.defaultCountryCode || '+91';
  const name = normalizeName(input.contactName, input.sourceLabel);
  const email = normalizeEmail(input.contactEmail);
  const phone = normalizePhoneE164(input.contactPhone, country);
  const budget = parseBudgetInr(input.budgetText);
  return {
    contactName: name.display,
    nameNormalized: name.normalized,
    contactEmail: email.email,
    emailNormalized: email.normalized,
    emailInvalid: email.invalid,
    phoneRaw: phone.raw,
    phoneE164: phone.e164,
    phoneInvalid: phone.invalid,
    budgetRaw: budget.budgetRaw,
    budgetInr: budget.budgetInr,
    customAnswers: { ...(input.customAnswers || {}) },
  };
}

/** Pull budget-like keys from custom answers if present. */
export function extractBudgetFromAnswers(answers: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(answers || {})) {
    if (/budget|price|consideration/i.test(k) && v != null && String(v).trim()) {
      return String(v);
    }
  }
  return null;
}
