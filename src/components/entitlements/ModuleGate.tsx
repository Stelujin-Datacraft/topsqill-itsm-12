import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useEntitlements } from '@/hooks/useEntitlements';
import { MODULES, moduleBanner, moduleForPath, type AccessLevel, type ModuleKey } from '@/lib/entitlements/modules';

export function LockedModule({ module, compact = false }: { module: ModuleKey; compact?: boolean }) {
  const info = MODULES[module];
  return (
    <div className={compact ? 'py-8' : 'flex flex-1 items-center justify-center p-6 sm:p-10'}>
      <Card className="w-full max-w-xl">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{info.name}</h2>
              <p className="text-sm text-muted-foreground">Not included in your organisation's plan</p>
            </div>
          </div>
          <p className="text-muted-foreground">{info.summary}</p>
          <ul className="space-y-2">
            {info.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
            To add {info.name}, ask your organisation administrator to contact your Topsqill account manager.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ModuleStatusBanner({ module }: { module: ModuleKey }) {
  const entitlements = useEntitlements();
  const banner = moduleBanner(entitlements, module);
  if (!banner) return null;
  return (
    <Alert variant={banner.tone === 'warning' ? 'destructive' : 'default'} className="mb-4">
      {banner.tone === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      <AlertTitle>{banner.title}</AlertTitle>
      <AlertDescription>{banner.text}</AlertDescription>
    </Alert>
  );
}

export function ModuleGate({ module, children, compact = false }: { module: ModuleKey; children: ReactNode; compact?: boolean }) {
  const { levelOf } = useEntitlements();
  const level: AccessLevel = levelOf(module);
  if (level === 'none') return <LockedModule module={module} compact={compact} />;
  return (
    <>
      <div className={compact ? '' : 'px-4 pt-4 sm:px-6 empty:hidden'}>
        <ModuleStatusBanner module={module} />
      </div>
      {children}
    </>
  );
}

/** Wraps the routed page: any URL that belongs to a paid module is gated in one place. */
export function ModulePathGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const module = moduleForPath(pathname);
  if (!module) return <>{children}</>;
  return <ModuleGate module={module}>{children}</ModuleGate>;
}
