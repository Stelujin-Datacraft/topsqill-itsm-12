import { Link, Navigate, useLocation } from 'react-router-dom';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMarket, isMarketCode, MARKETS } from '@/content/markets';
import { stripMarketPrefix } from '@/lib/seo';

export default function MarketHome() {
  const { pathname } = useLocation();
  const { market: code } = stripMarketPrefix(pathname);
  if (!isMarketCode(code)) return <Navigate to="/" replace />;
  const market = getMarket(code)!;

  return (
    <PublicPageLayout
      eyebrow={market.name}
      title={market.headline}
      description={market.lede}
      contentClassName="max-w-4xl mx-auto"
    >
      <p className="text-sm text-muted-foreground mb-8">{market.localeHint}</p>
      <p className="text-sm font-medium mb-6">{market.currencyNote}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { to: `/${code}/solutions`, title: 'Solutions', body: 'Onboarding, ITSM, GRC, vendor, security, and HR scenarios.' },
          { to: `/${code}/pricing`, title: 'Pricing', body: 'Named tiers with USD and INR list prices.' },
          { to: `/${code}/blog`, title: 'Blog', body: 'Operational guidance and product thinking.' },
          { to: `/${code}/contact`, title: 'Contact', body: 'Book a demo or talk to sales for your market.' },
        ].map((item) => (
          <Card key={item.to} className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">
                <Link to={item.to} className="hover:text-primary">{item.title}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>{item.body}</p>
              <Button asChild variant="outline" size="sm">
                <Link to={item.to}>Open {item.title}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Other markets</h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          <li><Link className="text-primary underline underline-offset-4" to="/">Global</Link></li>
          {MARKETS.filter((m) => m.code !== code).map((m) => (
            <li key={m.code}>
              <Link className="text-primary underline underline-offset-4" to={`/${m.code}`}>{m.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </PublicPageLayout>
  );
}
