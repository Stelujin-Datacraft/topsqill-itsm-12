import { useEffect } from 'react';

const AI_REFERRERS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'claude.ai',
];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Injects optional GSC/Bing verification + GA4.
 * Set VITE_GA_MEASUREMENT_ID, VITE_GSC_VERIFICATION, VITE_BING_VERIFICATION in env.
 * Registers a custom GA4 dimension-friendly event for AI referrals.
 */
export function SiteAnalytics() {
  useEffect(() => {
    const gsc = import.meta.env.VITE_GSC_VERIFICATION as string | undefined;
    const bing = import.meta.env.VITE_BING_VERIFICATION as string | undefined;
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

    if (gsc && !document.querySelector('meta[name="google-site-verification"]')) {
      const meta = document.createElement('meta');
      meta.name = 'google-site-verification';
      meta.content = gsc;
      document.head.appendChild(meta);
    }
    if (bing && !document.querySelector('meta[name="msvalidate.01"]')) {
      const meta = document.createElement('meta');
      meta.name = 'msvalidate.01';
      meta.content = bing;
      document.head.appendChild(meta);
    }

    if (!gaId) return;

    if (!document.getElementById('ga4-gtag')) {
      const script = document.createElement('script');
      script.id = 'ga4-gtag';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer?.push(args);
      };
      window.gtag('js', new Date());
      window.gtag('config', gaId, {
        send_page_view: true,
        // Hint for GA4 custom channel grouping on AI referrers (configure matching
        // channel group in GA4 Admin → Data settings → Channel groups).
        custom_map: { dimension1: 'traffic_source_detail' },
      });
    }

    try {
      const ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
      const aiHit = AI_REFERRERS.find((h) => ref === h || ref.endsWith(`.${h}`));
      if (aiHit && window.gtag) {
        window.gtag('event', 'ai_referral', {
          traffic_source_detail: aiHit,
          referrer_host: ref,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
