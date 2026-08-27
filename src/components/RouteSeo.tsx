import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/components/Seo';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  isNoIndexPath,
  resolvePublicSeo,
} from '@/lib/seo';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
} from '@/lib/structuredData';
import { getPost } from '@/content/blog/posts';
import { getMarket } from '@/content/markets';

/**
 * Applies per-route SEO for public pages; noindex for app/auth/unknown paths.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const resolved = resolvePublicSeo(pathname);

  if (resolved) {
    let title = resolved.title;
    let description = resolved.description;
    const basePath = resolved.hreflangPath;

    if (basePath === '/' && !resolved.market) {
      title = t('landing.title', { defaultValue: resolved.title });
      description = t('landing.heroDescription', { defaultValue: resolved.description });
    } else if (basePath === '/solutions') {
      title = t('solutionsPage.metaTitle', { defaultValue: resolved.title });
      description = t('solutionsPage.metaDescription', { defaultValue: resolved.description });
    }

    const jsonLd: object[] = [organizationJsonLd()];
    const homePath = resolved.market ? `/${resolved.market}` : '/';
    const crumbs = [{ name: 'Home', path: homePath }];

    if (basePath === '/' && !resolved.market) {
      jsonLd.push(softwareApplicationJsonLd(), faqPageJsonLd());
    } else if (basePath === '/' && resolved.market) {
      const market = getMarket(resolved.market);
      jsonLd.push(softwareApplicationJsonLd());
      if (market) crumbs.push({ name: market.name, path: pathname });
    } else if (basePath === '/pricing') {
      jsonLd.push(softwareApplicationJsonLd());
      crumbs.push({ name: 'Pricing', path: pathname });
    } else if (basePath === '/about') {
      crumbs.push({ name: 'About', path: pathname });
    } else if (basePath === '/contact') {
      crumbs.push({ name: 'Contact', path: pathname });
    } else if (basePath === '/solutions') {
      crumbs.push({ name: 'Solutions', path: pathname });
    } else if (basePath === '/blog') {
      crumbs.push({ name: 'Blog', path: pathname });
    } else if (basePath.startsWith('/blog/')) {
      const slug = basePath.slice('/blog/'.length);
      const post = getPost(slug);
      if (post) {
        jsonLd.push(articleJsonLd(post));
        crumbs.push({ name: 'Blog', path: `${homePath === '/' ? '' : homePath}/blog` });
        crumbs.push({ name: post.title, path: pathname });
      }
    }

    jsonLd.push(
      breadcrumbJsonLd(
        crumbs.length > 1 ? crumbs : [{ name: 'Home', path: pathname }],
      ),
    );

    const post = basePath.startsWith('/blog/') ? getPost(basePath.slice('/blog/'.length)) : undefined;

    return (
      <Seo
        title={title}
        description={description}
        path={pathname}
        jsonLd={jsonLd}
        hreflang
        hreflangPath={basePath}
        ogType={post ? 'article' : 'website'}
        publishedTime={post?.publishedAt}
        modifiedTime={post?.modifiedAt}
        author={post?.authorName}
      />
    );
  }

  if (isNoIndexPath(pathname)) {
    return (
      <Seo
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        path={pathname}
        noindex
        hreflang={false}
        jsonLd={[organizationJsonLd()]}
      />
    );
  }

  return (
    <Seo
      title="Page Not Found — TopSqill"
      description="The page you requested could not be found on TopSqill."
      path={pathname}
      noindex
      hreflang={false}
    />
  );
}
