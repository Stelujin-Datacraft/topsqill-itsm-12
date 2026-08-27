import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_ORIGIN } from '@/lib/seo';
import { LANDING_FAQS } from '@/content/faq';
import { PRICING_PLANS } from '@/content/pricing';
import type { BlogPost } from '@/content/blog/posts';
import { MARKETS } from '@/content/markets';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TopSqill',
    legalName: 'TopSqill Pvt Ltd',
    url: SITE_ORIGIN,
    logo: DEFAULT_OG_IMAGE,
    email: 'contact@topsqill.com',
    sameAs: [
      'https://www.linkedin.com/company/topsqill-pvt-ltd/',
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'B-439, Bhutani Technopark, Sector 127',
      addressLocality: 'Noida',
      postalCode: '201313',
      addressCountry: 'IN',
    },
  };
}

export function softwareApplicationJsonLd() {
  const offers = PRICING_PLANS.filter((p) => p.priceUsd !== null).map((p) => ({
    '@type': 'Offer',
    name: p.name,
    price: String(p.priceUsd ?? 0),
    priceCurrency: 'USD',
    description: p.description,
    url: absoluteUrl('/pricing'),
  }));

  // Mirror INR offers for India market discoverability
  const inrOffers = PRICING_PLANS.filter((p) => p.priceInr !== null).map((p) => ({
    '@type': 'Offer',
    name: `${p.name} (INR)`,
    price: String(p.priceInr ?? 0),
    priceCurrency: 'INR',
    description: p.description,
    url: absoluteUrl('/pricing'),
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TopSqill BPM',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_ORIGIN,
    image: DEFAULT_OG_IMAGE,
    description:
      'Enterprise BPM platform with form management, workflow automation, analytics, and SQL querying',
    offers: [...offers, ...inrOffers],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '150',
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqPageJsonLd(faqs = LANDING_FAQS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}

export function articleJsonLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.modifiedAt,
    author: {
      '@type': 'Person',
      name: post.authorName,
      jobTitle: post.authorTitle,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TopSqill',
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_OG_IMAGE,
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    image: DEFAULT_OG_IMAGE,
  };
}

export function marketAlternates(pathWithoutMarket: string) {
  const base = pathWithoutMarket === '/' ? '' : pathWithoutMarket;
  return [
    { hreflang: 'x-default', href: absoluteUrl(pathWithoutMarket) },
    { hreflang: 'en', href: absoluteUrl(pathWithoutMarket) },
    ...MARKETS.map((m) => ({
      hreflang: m.hreflang,
      href: absoluteUrl(`/${m.code}${base}`),
    })),
  ];
}
