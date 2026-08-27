import { Helmet } from 'react-helmet-async';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  absoluteAssetUrl,
  absoluteUrl,
} from '@/lib/seo';

export type SeoProps = {
  title?: string;
  description?: string;
  /** Pathname used for canonical + og:url (e.g. `/about`). Defaults to `/`. */
  path?: string;
  image?: string;
  noindex?: boolean;
  ogType?: string;
};

/**
 * Sets document title, description, canonical, and Open Graph / Twitter tags.
 * Always emits absolute canonical and og:image URLs (non-www topsqill.com).
 */
export function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image,
  noindex = false,
  ogType = 'website',
}: SeoProps) {
  const canonical = absoluteUrl(path);
  const ogImage = absoluteAssetUrl(image || DEFAULT_OG_IMAGE);

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

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="TopSqill" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@topsqill" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
