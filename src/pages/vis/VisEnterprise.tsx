import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Activity, Boxes, Sparkles } from 'lucide-react';
import { VisPageHeader, VisPageShell, VisSubnav } from '@/components/vis/VisPageShell';
import { cn } from '@/lib/utils';

type Tab =
  | 'overview'
  | 'users'
  | 'roles'
  | 'credentials'
  | 'connectors'
  | 'integrations'
  | 'approvals'
  | 'deployments'
  | 'alerts'
  | 'reconciliation'
  | 'drift'
  | 'audit'
  | 'healing';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'drift', label: 'Schema drift' },
  { id: 'audit', label: 'Audit' },
  { id: 'healing', label: 'Self-healing' },
];

export default function VisEnterprise() {
  const [data, setData] = useState<any>(null);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  const reload = () => {
    setLoading(true);
    Promise.all([
      visApi.enterpriseDashboard(),
      visApi.listConnectors().catch(() => []),
      visApi.listIntegrations().catch(() => []),
      visApi.listAudit().catch(() => []),
    ])
      .then(([dash, cons, ints, aud]) => {
        setData(dash);
        setConnectors(Array.isArray(cons) ? cons : []);
        setIntegrations(Array.isArray(ints) ? ints : []);
        setAudit(Array.isArray(aud) ? aud : []);
      })
      .catch((e) => setError(e.message || 'Failed to load enterprise admin'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  if (loading) {
    return (
      <VisPageShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading enterprise admin…
        </div>
      </VisPageShell>
    );
  }

  if (error) {
    return (
      <VisPageShell>
        <VisSubnav active="enterprise" />
        <p className="text-destructive font-medium py-8">{error}</p>
        <Button variant="outline" onClick={() => { setError(null); reload(); }}>Retry</Button>
      </VisPageShell>
    );
  }

  const health = data?.health?.status || 'UNKNOWN';
  const healthTone =
    health === 'HEALTHY'
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
      : health === 'DEGRADED'
        ? 'bg-amber-500/15 text-amber-800 border-amber-500/30'
        : health === 'FAILING'
          ? 'bg-red-500/15 text-red-700 border-red-500/30'
          : 'bg-muted text-muted-foreground border-border';

  return (
    <VisPageShell>
      <VisPageHeader
        title="Enterprise admin"
        description="Users, roles, credentials, connectors, governance, alerts, reconciliation, drift, and self-healing."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/vis">Studio home</Link>
          </Button>
        }
      />
      <VisSubnav active="enterprise" />

      <nav className="flex flex-wrap gap-1 border-b border-border/60 pb-px -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-sm rounded-t-md transition-colors',
              tab === t.id
                ? 'text-foreground font-medium border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Activity} label="Platform health">
              <Badge variant="outline" className={healthTone}>{health}</Badge>
            </Stat>
            <Stat icon={Shield} label="Open alerts">
              <p className="text-2xl font-semibold tabular-nums">{data?.alerts?.length || 0}</p>
            </Stat>
            <Stat icon={Boxes} label="Connectors">
              <p className="text-2xl font-semibold tabular-nums">{connectors.length || data?.connectors || 0}</p>
            </Stat>
            <Stat icon={Sparkles} label="AI recommendations">
              <p className="text-2xl font-semibold tabular-nums">{data?.recommendations?.length || 0}</p>
            </Stat>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <AdminList
          title="Users"
          empty="User directory is managed via SSO IdP mapping. Local principals appear after OIDC login."
          items={[
            { id: 'sso', primary: 'SSO-mapped principals', secondary: 'OIDC / SAML — roles from claims mapping' },
          ]}
        />
      )}

      {tab === 'roles' && (
        <AdminList
          title="Roles & permissions"
          items={[
            'SUPER_ADMIN', 'ORG_ADMIN', 'INTEGRATION_ADMIN', 'DEVELOPER', 'REVIEWER', 'OPERATIONS', 'VIEWER',
          ].map((r) => ({ id: r, primary: r, secondary: 'Permission matrix enforced server-side' }))}
        />
      )}

      {tab === 'credentials' && (
        <AdminList
          title="Credentials"
          empty="Credential references only — secret values never displayed."
          items={[
            { id: 'note', primary: 'credentialReferenceId handles', secondary: 'Resolved via SecretProvider (local encrypted / Vault)' },
          ]}
        />
      )}

      {tab === 'connectors' && (
        <AdminList
          title="Connectors & versions"
          empty="No connectors registered."
          items={connectors.map((c) => ({
            id: c.id,
            primary: `${c.name} @ ${c.version}`,
            secondary: `${c.lifecycle} · ${c.visibility} · ${c.securityStatus}`,
          }))}
        />
      )}

      {tab === 'integrations' && (
        <AdminList
          title="Integrations & versions"
          empty="No integrations."
          items={integrations.map((i) => ({
            id: i.id,
            primary: String(i.name),
            secondary: `${i.status} · ${i.environment} · v${i.version?.version ?? '?'}`,
          }))}
        />
      )}

      {tab === 'approvals' && (
        <AdminList
          title="Approvals"
          empty="No pending approvals in dashboard snapshot."
          items={(data?.recommendations || [])
            .filter((r: any) => r.status === 'PROPOSED' || r.status === 'REVIEWED')
            .map((r: any) => ({
              id: r.id,
              primary: r.type,
              secondary: `${r.status} · ${r.reason}`,
            }))}
        />
      )}

      {tab === 'deployments' && (
        <AdminList
          title="Environment promotion"
          empty="Promote integrations DEV → TEST → UAT → PROD via enterprise API (credentials never copied)."
          items={integrations
            .filter((i) => i.environment)
            .map((i) => ({
              id: i.id,
              primary: String(i.name),
              secondary: `Current env: ${i.environment}`,
            }))}
        />
      )}

      {tab === 'alerts' && (
        <AdminList
          title="Alerts"
          empty="No open alerts."
          items={(data?.alerts || []).map((a: any) => ({
            id: a.id,
            primary: a.message || a.ruleId,
            secondary: `${a.severity} · ${a.status}`,
          }))}
        />
      )}

      {tab === 'reconciliation' && (
        <p className="text-sm text-muted-foreground">
          Run reconciliation and repair via <code className="text-xs">POST /api/vis/enterprise/reconciliation</code>.
          Reports are stored in PostgreSQL and linked to auditable executions.
        </p>
      )}

      {tab === 'drift' && (
        <AdminList
          title="Schema / API drift"
          empty="No drift findings."
          items={(data?.drift || []).map((d: any) => ({
            id: d.id,
            primary: `Severity ${d.maxSeverity || 'n/a'}`,
            secondary: `${Array.isArray(d.findings) ? d.findings.length : 0} finding(s) — production not auto-modified`,
          }))}
        />
      )}

      {tab === 'audit' && (
        <AdminList
          title="Audit log"
          empty="No audit entries."
          items={audit.slice(0, 50).map((a: any) => ({
            id: a.id,
            primary: String(a.action),
            secondary: `${a.integrationId || '—'} · ${a.createdAt || ''}`,
          }))}
        />
      )}

      {tab === 'healing' && (
        <AdminList
          title="Self-healing actions"
          empty="No healing actions recorded."
          items={(data?.healing || []).map((h: any) => ({
            id: h.id,
            primary: `${h.actionType} → ${h.status}`,
            secondary: `${h.trigger} · ${h.detail || ''} · ${h.createdAt || ''}`,
          }))}
        />
      )}
    </VisPageShell>
  );
}

function Stat({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Activity;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      {children}
    </div>
  );
}

function AdminList({
  title,
  empty,
  items,
}: {
  title: string;
  empty?: string;
  items: Array<{ id: string; primary: string; secondary?: string }>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty || 'None'}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
              <div className="font-medium">{item.primary}</div>
              {item.secondary && <p className="text-muted-foreground mt-0.5">{item.secondary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
