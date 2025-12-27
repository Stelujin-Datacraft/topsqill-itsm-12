import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, Mail, Database, FileSpreadsheet, 
  Calendar, CreditCard, Bell, Webhook, 
  Users, FolderOpen, Send, Zap, Cloud
} from "lucide-react";

const integrations = [
  // Communication & Notifications
  { name: "Slack", icon: MessageSquare, color: "bg-purple-100 text-purple-700", category: "Notifications" },
  { name: "Microsoft Teams", icon: Users, color: "bg-blue-100 text-blue-700", category: "Notifications" },
  { name: "Email (SMTP)", icon: Mail, color: "bg-red-100 text-red-700", category: "Notifications" },
  { name: "SendGrid", icon: Send, color: "bg-blue-100 text-blue-700", category: "Notifications" },
  { name: "Push Notifications", icon: Bell, color: "bg-amber-100 text-amber-700", category: "Notifications" },
  
  // Data & Storage
  { name: "Google Sheets", icon: FileSpreadsheet, color: "bg-green-100 text-green-700", category: "Data" },
  { name: "Google Drive", icon: FolderOpen, color: "bg-yellow-100 text-yellow-700", category: "Storage" },
  { name: "Dropbox", icon: FolderOpen, color: "bg-blue-100 text-blue-700", category: "Storage" },
  { name: "OneDrive", icon: FolderOpen, color: "bg-sky-100 text-sky-700", category: "Storage" },
  { name: "PostgreSQL", icon: Database, color: "bg-blue-100 text-blue-700", category: "Database" },
  { name: "Supabase", icon: Database, color: "bg-emerald-100 text-emerald-700", category: "Database" },
  
  // Automation & APIs
  { name: "Webhooks", icon: Webhook, color: "bg-pink-100 text-pink-700", category: "Automation" },
  { name: "Zapier", icon: Zap, color: "bg-orange-100 text-orange-700", category: "Automation" },
  { name: "REST API", icon: Cloud, color: "bg-indigo-100 text-indigo-700", category: "Automation" },
  
  // Business Tools
  { name: "Google Calendar", icon: Calendar, color: "bg-cyan-100 text-cyan-700", category: "Scheduling" },
  { name: "Stripe", icon: CreditCard, color: "bg-indigo-100 text-indigo-700", category: "Payments" },
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
            Extend your workflows with powerful integrations for notifications, data sync, and automation
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
          {integrations.map((integration, index) => (
            <div
              key={index}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-background border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className={`p-1.5 rounded-full ${integration.color} group-hover:scale-110 transition-transform duration-300`}>
                <integration.icon className="h-4 w-4" />
              </div>
              <span className="font-medium text-sm text-foreground">{integration.name}</span>
            </div>
          ))}
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
