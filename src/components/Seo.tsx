import { Helmet } from 'react-helmet-async';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  absoluteAssetUrl,
  absoluteUrl,
} from '@/lib/seo';
import { marketAlternates } from '@/lib/structuredData';

export type SeoProps = {
  title?: string;
  description?: string;
  /** Pathname used for canonical + og:url (e.g. `/about`). Defaults to `/`. */
  path?: string;
  image?: string;
  noindex?: boolean;
  ogType?: string;
  /** JSON-LD objects to embed */
  jsonLd?: Array<Record<string, unknown> | object>;
  /** Emit hreflang matrix for multi-market URLs */
  hreflang?: boolean;
  /** Path without market prefix for hreflang pairing (e.g. `/about`) */
  hreflangPath?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
};

/**
 * Sets document title, description, canonical, Open Graph / Twitter tags,
 * optional JSON-LD, and optional hreflang alternates.
 */
export function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image,
  noindex = false,
  ogType = 'website',
  jsonLd = [],
  hreflang = true,
  hreflangPath,
  publishedTime,
  modifiedTime,
  author,
}: SeoProps) {
  const canonical = absoluteUrl(path);
  const ogImage = absoluteAssetUrl(image || DEFAULT_OG_IMAGE);
  const alternates = hreflang && !noindex
    ? marketAlternates(hreflangPath || stripMarketPrefix(path))
    : [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {alternates.map((alt) => (
        <link key={alt.hreflang} rel="alternate" hrefLang={alt.hreflang} href={alt.href} />
      ))}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="TopSqill" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {author && <meta property="article:author" content={author} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@topsqill" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}

function stripMarketPrefix(pathname: string): string {
  const m = pathname.match(/^\/(in|ae|sa|sg|ar)(\/|$)/);
  if (!m) return pathname || '/';
  const rest = pathname.slice(m[0].length - (m[2] === '/' ? 1 : 0));
  // m[0] is like "/in/" or "/in"
  if (m[2] === '') return '/';
  const stripped = pathname.replace(/^\/(in|ae|sa|sg|ar)/, '') || '/';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}
