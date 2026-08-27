import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/components/Seo';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  PUBLIC_ROUTE_SEO,
  isKnownPublicPath,
  isNoIndexPath,
} from '@/lib/seo';

/**
 * Applies per-route SEO for public pages; noindex for app/auth/unknown (soft-404) paths.
 * Mount once inside BrowserRouter.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  if (isKnownPublicPath(pathname)) {
    const entry = PUBLIC_ROUTE_SEO[pathname];
    let title = entry.title;
    let description = entry.description;

    // Prefer i18n where the product already defines localized meta.
    if (pathname === '/') {
      title = t('landing.title', { defaultValue: entry.title });
      description = t('landing.heroDescription', { defaultValue: entry.description });
    } else if (pathname === '/solutions') {
      title = t('solutionsPage.metaTitle', { defaultValue: entry.title });
      description = t('solutionsPage.metaDescription', { defaultValue: entry.description });
    }

    return <Seo title={title} description={description} path={pathname} />;
  }

  if (isNoIndexPath(pathname)) {
    return (
      <Seo
        title={`${DEFAULT_TITLE}`}
        description={DEFAULT_DESCRIPTION}
        path={pathname}
        noindex
      />
    );
  }

  // Unmatched public-looking URL → treat as soft 404 for crawlers (noindex).
  return (
    <Seo
      title="Page Not Found — TopSqill"
      description="The page you requested could not be found on TopSqill."
      path={pathname}
      noindex
    />
  );
}
