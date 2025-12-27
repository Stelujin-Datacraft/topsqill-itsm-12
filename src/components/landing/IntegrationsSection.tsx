import { Badge } from "@/components/ui/badge";

const integrations = [
  { name: "Slack", category: "Communication" },
  { name: "Gmail", category: "Email" },
  { name: "PostgreSQL", category: "Database" },
  { name: "AWS S3", category: "Storage" },
  { name: "Google Sheets", category: "Spreadsheet" },
  { name: "Stripe", category: "Payments" },
  { name: "GitHub", category: "Version Control" },
  { name: "Zapier", category: "Automation" },
  { name: "Salesforce", category: "CRM" },
  { name: "HubSpot", category: "Marketing" }
];

export default function IntegrationsSection() {
  return (
    <section id="integrations" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 text-muted-foreground border-border">
            Integrations
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Works with your existing stack
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect Topsqill with 50+ tools you already use. No complex setup required.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-4xl mx-auto">
          {integrations.map((integration, index) => (
            <div
              key={index}
              className="group px-4 py-5 rounded-lg bg-background border border-border/50 hover:border-border hover:shadow-sm transition-all duration-200 text-center"
            >
              <span className="font-semibold text-foreground block mb-1">{integration.name}</span>
              <span className="text-xs text-muted-foreground">{integration.category}</span>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-sm text-muted-foreground">
            + Webhooks, REST API, and custom integrations available
          </p>
        </div>
      </div>
    </section>
  );
}
