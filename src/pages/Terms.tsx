import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  useEffect(() => {
    document.title = 'Terms & Conditions — TopSqill';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'The terms that govern use of the TopSqill enterprise automation platform, including accounts, acceptable use, data ownership and liability.');
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="text-lg font-semibold">TopSqill</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-14 max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight mb-3">Terms &amp; Conditions</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">1. Agreement</h2>
            <p>
              These terms govern access to and use of the TopSqill platform operated by TopSqill Pvt Ltd,
              B-439, Bhutani Technopark, Sector 127, Noida — 201313, India. By creating an account or using the
              service you agree to these terms on behalf of yourself and, where applicable, your organization.
              Where a signed enterprise agreement exists, that agreement prevails.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">2. Accounts and organizations</h2>
            <p>
              Accounts belong to an organization workspace. Administrators control membership, roles and access
              to forms, workflows, reports and documents. You are responsible for keeping credentials
              confidential, for activity performed under your account, and for ensuring that users you invite
              are authorized to access the data in your workspace.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">3. Acceptable use</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do not upload unlawful, infringing, malicious or harmful content.</li>
              <li>Do not attempt to bypass access controls, tenancy isolation, rate limits or authentication.</li>
              <li>Do not reverse engineer, resell or white-label the platform without written permission.</li>
              <li>Do not use the service to send unsolicited bulk email or to store data you are not permitted to process.</li>
              <li>Automated access must go through the documented API and respect published limits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">4. Customer data ownership</h2>
            <p>
              Your organization retains all rights to the content it submits. You grant us a limited licence to
              host, process and transmit that content solely to operate and support the service. We act as a
              processor for personal data contained in your content and handle it as described in our{' '}
              <Link to="/privacy" className="text-primary underline underline-offset-4">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">5. AI features</h2>
            <p>
              Optional AI features generate suggestions for forms, workflows, reports and documents. Output may
              be inaccurate or incomplete and must be reviewed by a human before being relied upon for
              compliance, legal, financial or operational decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">6. Service availability and support</h2>
            <p>
              We aim for high availability but the service is provided without an uptime guarantee unless a
              separate service level agreement is in place. Planned maintenance is communicated in advance where
              practical. Support requests can be raised through the{' '}
              <Link to="/contact" className="text-primary underline underline-offset-4">contact page</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">7. Fees</h2>
            <p>
              Paid plans and enterprise deployments are billed as described in the applicable order form or
              quotation. Unless stated otherwise, fees are exclusive of taxes and are non-refundable for periods
              already used.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">8. Suspension and termination</h2>
            <p>
              We may suspend access for security incidents, non-payment or breach of these terms, giving notice
              where reasonably possible. Your organization may stop using the service at any time and request
              export or deletion of its content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">9. Warranties and liability</h2>
            <p>
              Except as expressly stated, the service is provided "as is" without implied warranties. To the
              maximum extent permitted by law, neither party is liable for indirect, incidental or consequential
              loss, and our aggregate liability is limited to the fees paid for the service in the twelve months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">10. Governing law</h2>
            <p>
              These terms are governed by the laws of India, and the courts of Gautam Buddha Nagar, Uttar
              Pradesh have exclusive jurisdiction, without prejudice to any different terms agreed in a signed
              enterprise contract.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">11. Changes</h2>
            <p>
              We may update these terms; material changes will be posted on this page with an updated date.
              Continued use after changes take effect constitutes acceptance.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}