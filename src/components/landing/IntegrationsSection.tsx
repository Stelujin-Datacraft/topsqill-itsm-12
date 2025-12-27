import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, Mail, Database, Cloud, FileSpreadsheet, 
  Calendar, CreditCard, Bell, GitBranch, Webhook
} from "lucide-react";

const integrations = [
  { name: "Slack", icon: MessageSquare, color: "bg-purple-100 text-purple-700" },
  { name: "Gmail", icon: Mail, color: "bg-red-100 text-red-700" },
  { name: "PostgreSQL", icon: Database, color: "bg-blue-100 text-blue-700" },
  { name: "AWS", icon: Cloud, color: "bg-orange-100 text-orange-700" },
  { name: "Google Sheets", icon: FileSpreadsheet, color: "bg-green-100 text-green-700" },
  { name: "Calendar", icon: Calendar, color: "bg-cyan-100 text-cyan-700" },
  { name: "Stripe", icon: CreditCard, color: "bg-indigo-100 text-indigo-700" },
  { name: "Notifications", icon: Bell, color: "bg-amber-100 text-amber-700" },
  { name: "GitHub", icon: GitBranch, color: "bg-gray-100 text-gray-700" },
  { name: "Webhooks", icon: Webhook, color: "bg-pink-100 text-pink-700" }
];

export default function IntegrationsSection() {
  return (
    <section className="py-16 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 bg-blue-100 text-blue-800">
            Integrations
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
            Connects with Your Favorite Tools
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Seamlessly integrate with 50+ popular apps and services
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
          {integrations.map((integration, index) => (
            <div
              key={index}
              className="group flex items-center gap-3 px-5 py-3 rounded-full bg-background border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className={`p-2 rounded-full ${integration.color} group-hover:scale-110 transition-transform duration-300`}>
                <integration.icon className="h-4 w-4" />
              </div>
              <span className="font-medium text-foreground">{integration.name}</span>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <span className="text-muted-foreground">+ 40 more integrations available</span>
        </div>
      </div>
    </section>
  );
}
