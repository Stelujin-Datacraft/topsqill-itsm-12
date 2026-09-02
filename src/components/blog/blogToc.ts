export type BlogTocItem = {
  id: string;
  label: string;
  level: 2 | 3;
};

function slugifyHeading(text: string, used: Set<string>): string {
  const base = text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Ensure h2/h3 in HTML have ids; return TOC entries. */
export function prepareHtmlWithToc(html: string): { html: string; toc: BlogTocItem[] } {
  if (!html?.trim()) return { html: html || '', toc: [] };

  const used = new Set<string>();
  const toc: BlogTocItem[] = [];
  const nextHtml = html.replace(
    /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, attrs = '', inner: string) => {
      const level = tag.toLowerCase() === 'h3' ? 3 : 2;
      const label = stripTags(inner);
      if (!label) return `<${tag}${attrs || ''}>${inner}</${tag}>`;

      const existingId = /\sid=["']([^"']+)["']/i.exec(attrs || '');
      const id = existingId?.[1] || slugifyHeading(label, used);
      if (!existingId) used.add(id);

      toc.push({ id, label, level: level as 2 | 3 });
      const withoutId = (attrs || '').replace(/\s+id=["'][^"']*["']/i, '');
      return `<${tag}${withoutId} id="${id}">${inner}</${tag}>`;
    },
  );

  return { html: nextHtml, toc };
}

/** Build TOC from plain paragraph body (static seed posts). */
export function tocFromParagraphs(paragraphs: string[]): BlogTocItem[] {
  const used = new Set<string>();
  return (paragraphs || []).map((para, index) => {
    const cleaned = para.replace(/\s+/g, ' ').trim();
    const label = cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}…` : cleaned;
    const id = slugifyHeading(cleaned.slice(0, 40) || `section-${index + 1}`, used);
    return { id, label: label || `Section ${index + 1}`, level: 2 as const };
  });
}
