import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, Mail, Database, Cloud, FileSpreadsheet, 
  Calendar, CreditCard, Bell, GitBranch, Webhook
} from "lucide-react";

const integrations = [
  { name: "Slack", icon: MessageSquare, color: "bg-purple-100 text-purple-700 border-purple-200" },
  { name: "Gmail", icon: Mail, color: "bg-red-100 text-red-700 border-red-200" },
  { name: "PostgreSQL", icon: Database, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { name: "AWS", icon: Cloud, color: "bg-orange-100 text-orange-700 border-orange-200" },
  { name: "Google Sheets", icon: FileSpreadsheet, color: "bg-green-100 text-green-700 border-green-200" },
  { name: "Calendar", icon: Calendar, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { name: "Stripe", icon: CreditCard, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { name: "Notifications", icon: Bell, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { name: "GitHub", icon: GitBranch, color: "bg-gray-100 text-gray-700 border-gray-200" },
  { name: "Webhooks", icon: Webhook, color: "bg-pink-100 text-pink-700 border-pink-200" }
];

export default function IntegrationsSection() {
  return (
    <section id="integrations" className="py-20 bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4 bg-blue-100 text-blue-800 px-4 py-1">
            50+ Integrations
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Connects with Your Favorite Tools
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Seamlessly integrate with popular apps and services to supercharge your workflows
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {integrations.map((integration, index) => (
            <div
              key={index}
              className={`group flex items-center gap-3 px-5 py-4 rounded-xl bg-background border ${integration.color} hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
            >
              <div className="p-2 rounded-lg bg-background group-hover:scale-110 transition-transform duration-300">
                <integration.icon className="h-5 w-5" />
              </div>
              <span className="font-semibold text-foreground">{integration.name}</span>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-muted-foreground text-lg">
            <span className="font-semibold text-foreground">+ 40 more</span> integrations available including Salesforce, HubSpot, Zapier & more
          </p>
        </div>
      </div>
    </section>
  );
}
