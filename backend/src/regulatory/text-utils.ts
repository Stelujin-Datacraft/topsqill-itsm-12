export function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _;
    });
}

export function collapseWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function stripHtml(value: string): string {
  return collapseWhitespace(decodeHtml(value));
}

/** Sentences that contain an explicit "shall", excluding definitional formulae. */
export function explicitShallSentences(text: string): string[] {
  const cleaned = collapseWhitespace(text).replace(/\s+/g, ' ');
  if (!cleaned) return [];
  const parts = cleaned.split(/(?<=[.;])\s+/);
  const out: string[] = [];
  for (const part of parts) {
    const sentence = part.trim();
    if (!sentence || !/\bshall\b/i.test(sentence)) continue;
    if (/\bshall mean\b/i.test(sentence)) continue;
    if (/\bshall be construed\b/i.test(sentence)) continue;
    if (/\bshall have the (?:same )?meaning\b/i.test(sentence)) continue;
    out.push(sentence);
  }
  return out;
}
