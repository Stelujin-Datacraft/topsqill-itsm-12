import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Bug, Sparkles, Zap, ChevronRight } from "lucide-react";

const announcements = [
  {
    id: 1,
    type: "feature",
    title: "Enhanced Workflow Designer Released",
    description: "New drag-and-drop workflow builder with advanced conditional logic and real-time collaboration features.",
    date: "2025-01-10",
    version: "v2.4.0",
    status: "released"
  },
  {
    id: 2,
    type: "update",
    title: "SQL Query Engine Performance Boost",
    description: "40% faster query execution times and support for complex joins across multiple form datasets.",
    date: "2025-01-05",
    version: "v2.3.2",
    status: "released"
  },
  {
    id: 3,
    type: "feature",
    title: "AI Form Optimization (Beta)",
    description: "Smart suggestions for form fields, validation rules, and user experience improvements using machine learning.",
    date: "2025-01-01",
    version: "v2.3.0",
    status: "beta"
  },
  {
    id: 4,
    type: "bugfix",
    title: "Form Builder Stability Improvements",
    description: "Fixed issues with complex conditional logic and improved performance for large forms with 100+ fields.",
    date: "2024-12-28",
    version: "v2.2.3",
    status: "released"
  },
  {
    id: 5,
    type: "feature",
    title: "Enterprise SSO Integration",
    description: "SAML 2.0 and OIDC support for seamless integration with existing enterprise identity providers.",
    date: "2024-12-20",
    version: "v2.2.0",
    status: "released"
  },
  {
    id: 6,
    type: "announcement",
    title: "Series A Funding Completed",
    description: "Raised $15M to accelerate AI development and expand our enterprise features roadmap.",
    date: "2024-12-15",
    version: "",
    status: "announcement"
  }
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case "feature":
      return <Sparkles className="h-4 w-4" />;
    case "bugfix":
      return <Bug className="h-4 w-4" />;
    case "update":
      return <Zap className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
};

const getTypeBadge = (type: string, status: string) => {
  const baseClasses = "capitalize";
  
  if (status === "beta") {
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800">{type} (Beta)</Badge>;
  }
  
  switch (type) {
    case "feature":
      return <Badge variant="secondary" className="bg-green-100 text-green-800">{type}</Badge>;
    case "bugfix":
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Bug Fix</Badge>;
    case "update":
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">{type}</Badge>;
    case "announcement":
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800">{type}</Badge>;
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
};

export default function AnnouncementHistory() {
  return (
    <section className="py-20 bg-gradient-to-br from-background to-secondary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Latest Updates</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Product Updates & Announcements
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Stay up to date with the latest features, improvements, and company news
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {announcements.map((announcement, index) => (
              <Card key={announcement.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {getTypeIcon(announcement.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeBadge(announcement.type, announcement.status)}
                          {announcement.version && (
                            <Badge variant="outline" className="text-xs">
                              {announcement.version}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(announcement.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-base leading-relaxed mb-4">
                    {announcement.description}
                  </CardDescription>
                  {index < 2 && (
                    <Button variant="ghost" size="sm" className="p-0 h-auto text-primary hover:text-primary/80">
                      Read more
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              View All Updates
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}