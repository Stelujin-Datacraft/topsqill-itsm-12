export type BlogPostRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content_html: string;
  cover_image_url: string | null;
  author_name: string;
  author_title: string | null;
  tags: string[];
  /** FAQ Q&A pairs for visible FAQs + FAQPage JSON-LD */
  faqs?: BlogFaqItem[] | null;
  published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Present in Blog admin only — demo seed vs saved CMS post */
  origin?: 'cms' | 'demo';
};

export type BlogFaqItem = { question: string; answer: string };

export function isDemoBlogId(id: string | undefined | null): boolean {
  return Boolean(id && String(id).startsWith('demo:'));
}

/** Unified shape for public /blog rendering (DB + static). */
export type DisplayBlogPost = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  authorName: string;
  authorTitle?: string;
  publishedAt: string;
  modifiedAt: string;
  tags: string[];
  coverImageUrl?: string;
  faqs?: BlogFaqItem[];
  /** TipTap / HTML body from CMS */
  contentHtml?: string;
  /** Legacy static paragraph body */
  body?: string[];
  source: 'db' | 'static';
};

export type BlogPostInput = {
  slug: string;
  title: string;
  description?: string;
  content_html?: string;
  cover_image_url?: string | null;
  author_name?: string;
  author_title?: string | null;
  tags?: string[];
  faqs?: BlogFaqItem[] | null;
  published?: boolean;
  published_at?: string | null;
};

/** Normalize unknown FAQ JSON into clean {question, answer} pairs. */
export function normalizeFaqItems(raw: unknown): BlogFaqItem[] {
  if (!raw) return [];
  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: BlogFaqItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const question = String((item as BlogFaqItem).question || '').trim();
    const answer = String((item as BlogFaqItem).answer || '').trim();
    if (!question || !answer) continue;
    out.push({ question, answer });
  }
  return out;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function recordToDisplay(row: BlogPostRecord): DisplayBlogPost {
  const publishedAt = (row.published_at || row.created_at || '').slice(0, 10);
  const modifiedAt = (row.updated_at || row.published_at || row.created_at || '').slice(0, 10);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    authorName: row.author_name || 'TopSqill Team',
    authorTitle: row.author_title || undefined,
    publishedAt,
    modifiedAt,
    tags: row.tags || [],
    coverImageUrl: row.cover_image_url || undefined,
    faqs: normalizeFaqItems(row.faqs),
    contentHtml: row.content_html || '',
    source: 'db',
  };
}
