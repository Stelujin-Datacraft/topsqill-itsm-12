import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout from '@/components/layout/PublicPageLayout';

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy Policy — TopSqill';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'How TopSqill collects, uses, stores and protects personal and organizational data across its enterprise automation platform.');
  }, []);

  return (
    <PublicPageLayout
      eyebrow="Legal"
      title={"Privacy Policy"}
      description="How TopSqill collects, uses, stores and protects personal and organizational data across the platform."
      meta={`Last updated: ${new Date().getFullYear()}`}
    >
      <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Who we are</h2>
            <p>
              TopSqill Pvt Ltd ("TopSqill", "we", "us") provides an enterprise platform for forms, workflows,
              reports, knowledge documents, IT asset management and governance. Our registered office is at
              B-439, Bhutani Technopark, Sector 127, Noida — 201313, India. For any privacy question you can
              write to <a className="text-primary underline underline-offset-4" href="mailto:contact@topsqill.com">contact@topsqill.com</a>.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Account data:</span> name, work email, organization, role assignments and authentication metadata (including SSO/LDAP identifiers where configured).</li>
              <li><span className="text-foreground font-medium">Customer content:</span> forms, submissions, attachments, workflows, reports, knowledge documents and asset records that your organization creates in the platform.</li>
              <li><span className="text-foreground font-medium">Usage and security logs:</span> sign-in events, IP address, browser/device information, audit trails of record changes and administrative actions.</li>
              <li><span className="text-foreground font-medium">Communications:</span> messages you send to support, sales or through the contact page.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">3. How we use data</h2>
            <p>
              We process data to deliver and secure the service, authenticate users, enforce organization and
              role based access, execute workflows and notifications you configure, generate reports and
              analytics for your organization, provide support, and meet legal or contractual obligations. We do
              not sell personal data, and we do not use customer content for advertising.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Legal bases</h2>
            <p>
              Where applicable law requires a legal basis, we rely on performance of a contract (providing the
              service to your organization), legitimate interests (platform security, service improvement, fraud
              prevention), consent (optional communications), and compliance with legal obligations.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Multi-tenant isolation and security</h2>
            <p>
              Every record is scoped to a single organization and protected by row level security in the
              database, so users of one organization cannot read or modify another organization's data. We use
              encryption in transit (TLS), encrypted storage at rest, least-privilege service credentials,
              audit logging of sensitive operations, optional multi-factor authentication and session
              management controls for administrators.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Sub-processors</h2>
            <p>
              We rely on a limited set of vetted providers for cloud hosting and databases, transactional email
              delivery (via your configured SMTP provider or ours), and optional AI features used to generate
              forms, reports or document drafts. Prompts sent to AI providers are not used to train their public
              models. A current list of sub-processors is available on request.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Retention</h2>
            <p>
              Customer content is retained while your organization's account is active and for a limited period
              afterwards to allow recovery, unless you ask us to delete it sooner. Security and audit logs are
              retained for a defined period to support investigations and compliance requirements.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Your rights</h2>
            <p>
              Depending on your jurisdiction, you may request access, correction, deletion, restriction,
              objection or portability of your personal data. If you use TopSqill through an employer, please
              raise the request with that organization's administrator; we act on their instructions as a
              processor. You may also contact us directly and we will respond within a reasonable time.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Cookies</h2>
            <p>
              We use strictly necessary cookies and local storage to keep you signed in, remember interface
              preferences and protect against abuse. We do not use third-party advertising cookies.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">10. International transfers</h2>
            <p>
              Data may be processed in regions where we or our sub-processors operate infrastructure. Where data
              leaves your region, we use appropriate safeguards such as standard contractual clauses.
            </p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Changes and contact</h2>
            <p>
              We will post material changes to this policy on this page and update the date above. Questions can
              be sent through our <Link to="/contact" className="text-primary underline underline-offset-4">contact page</Link>.
            </p>
          </section>
      </div>
    </PublicPageLayout>
  );
}