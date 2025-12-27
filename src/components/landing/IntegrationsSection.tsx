import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, Mail, Database, Cloud, FileSpreadsheet, 
  Calendar, CreditCard, Bell, GitBranch, Webhook, 
  Users, FileText, Lock, BarChart3, Zap, 
  Send, Video, Headphones, FolderOpen, Shield,
  Settings, Globe, Smartphone, Building2, Layers
} from "lucide-react";

const currentIntegrations = [
  { name: "Slack", icon: MessageSquare, color: "bg-purple-100 text-purple-700" },
  { name: "Gmail", icon: Mail, color: "bg-red-100 text-red-700" },
  { name: "PostgreSQL", icon: Database, color: "bg-blue-100 text-blue-700" },
  { name: "AWS", icon: Cloud, color: "bg-orange-100 text-orange-700" },
  { name: "Google Sheets", icon: FileSpreadsheet, color: "bg-green-100 text-green-700" },
  { name: "Google Calendar", icon: Calendar, color: "bg-cyan-100 text-cyan-700" },
  { name: "Stripe", icon: CreditCard, color: "bg-indigo-100 text-indigo-700" },
  { name: "Push Notifications", icon: Bell, color: "bg-amber-100 text-amber-700" },
  { name: "GitHub", icon: GitBranch, color: "bg-gray-100 text-gray-700" },
  { name: "Webhooks", icon: Webhook, color: "bg-pink-100 text-pink-700" },
  { name: "Microsoft Teams", icon: Users, color: "bg-blue-100 text-blue-700" },
  { name: "Outlook", icon: Mail, color: "bg-sky-100 text-sky-700" },
  { name: "OneDrive", icon: FolderOpen, color: "bg-blue-100 text-blue-700" },
  { name: "Dropbox", icon: FolderOpen, color: "bg-blue-100 text-blue-700" },
  { name: "Notion", icon: FileText, color: "bg-stone-100 text-stone-700" },
  { name: "Jira", icon: Layers, color: "bg-blue-100 text-blue-700" },
  { name: "Salesforce", icon: Cloud, color: "bg-cyan-100 text-cyan-700" },
  { name: "HubSpot", icon: BarChart3, color: "bg-orange-100 text-orange-700" },
  { name: "Zapier", icon: Zap, color: "bg-orange-100 text-orange-700" },
  { name: "SendGrid", icon: Send, color: "bg-blue-100 text-blue-700" },
];

const upcomingIntegrations = [
  { name: "Zoom", icon: Video, color: "bg-blue-100 text-blue-700" },
  { name: "Zendesk", icon: Headphones, color: "bg-green-100 text-green-700" },
  { name: "Okta SSO", icon: Lock, color: "bg-indigo-100 text-indigo-700" },
  { name: "Azure AD", icon: Shield, color: "bg-blue-100 text-blue-700" },
  { name: "SAP", icon: Building2, color: "bg-blue-100 text-blue-700" },
  { name: "Oracle", icon: Database, color: "bg-red-100 text-red-700" },
  { name: "Twilio", icon: Smartphone, color: "bg-red-100 text-red-700" },
  { name: "Power BI", icon: BarChart3, color: "bg-yellow-100 text-yellow-700" },
  { name: "Tableau", icon: BarChart3, color: "bg-orange-100 text-orange-700" },
  { name: "ServiceNow", icon: Settings, color: "bg-green-100 text-green-700" },
  { name: "REST APIs", icon: Globe, color: "bg-emerald-100 text-emerald-700" },
  { name: "GraphQL", icon: Webhook, color: "bg-pink-100 text-pink-700" },
];

export default function IntegrationsSection() {
  return (
    <section id="integrations" className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 bg-blue-100 text-blue-800">
            Integrations
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
            Connects with Your Favorite Tools
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Seamlessly integrate with 50+ popular apps and services to streamline your workflows
          </p>
        </div>

        {/* Current Integrations */}
        <div className="mb-12">
          <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-primary mb-6">
            Available Now
          </h3>
          <div className="flex flex-wrap justify-center gap-3 max-w-5xl mx-auto">
            {currentIntegrations.map((integration, index) => (
              <div
                key={index}
                className="group flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <div className={`p-1.5 rounded-full ${integration.color} group-hover:scale-110 transition-transform duration-300`}>
                  <integration.icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-sm text-foreground">{integration.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Integrations */}
        <div>
          <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Coming Soon
          </h3>
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {upcomingIntegrations.map((integration, index) => (
              <div
                key={index}
                className="group flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30 border border-dashed border-border/50 hover:border-muted-foreground/30 transition-all duration-300 cursor-default opacity-70 hover:opacity-100"
              >
                <div className={`p-1.5 rounded-full ${integration.color} opacity-60`}>
                  <integration.icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-sm text-muted-foreground">{integration.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-10">
          <p className="text-muted-foreground text-sm">
            Need a custom integration? <span className="text-primary font-medium cursor-pointer hover:underline">Contact us</span>
          </p>
        </div>
      </div>
    </section>
  );
}
