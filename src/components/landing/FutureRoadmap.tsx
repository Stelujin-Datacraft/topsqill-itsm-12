import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Database, Zap, MessageSquare, Cpu, Sparkles } from "lucide-react";

export default function FutureRoadmap() {
  const features = [
    {
      icon: Brain,
      title: "AI Form Intelligence",
      description: "Forms that adapt and optimize based on user behavior and submission patterns",
      status: "In Development",
      timeline: "Q2 2025"
    },
    {
      icon: Database,
      title: "Form Data Warehouse",
      description: "Centralized repository with RAG model for intelligent data retrieval and insights",
      status: "Planned",
      timeline: "Q3 2025"
    },
    {
      icon: MessageSquare,
      title: "Custom LLM Modules",
      description: "Build and deploy your own language models directly from our platform",
      status: "Research",
      timeline: "Q4 2025"
    },
    {
      icon: Sparkles,
      title: "Predictive Analytics",
      description: "AI-powered predictions for form completion rates and user behavior",
      status: "Planned",
      timeline: "Q3 2025"
    },
    {
      icon: Cpu,
      title: "Edge AI Processing",
      description: "Real-time form processing with edge computing for instant responses",
      status: "Research",
      timeline: "2026"
    },
    {
      icon: Zap,
      title: "Auto-Generated Forms",
      description: "AI creates optimal forms based on your business requirements and data",
      status: "Concept",
      timeline: "2026"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Development": return "bg-green-100 text-green-800";
      case "Planned": return "bg-blue-100 text-blue-800";
      case "Research": return "bg-purple-100 text-purple-800";
      case "Concept": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <section aria-labelledby="roadmap-heading" className="py-20 bg-gradient-to-br from-background to-secondary/10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Future Vision</Badge>
          <h2 id="roadmap-heading" className="text-3xl font-bold mb-4">
            The AI-Powered Future of Forms
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We're building the next generation of form technology with artificial intelligence at its core
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <feature.icon className="h-8 w-8 text-primary" />
                  <Badge className={`text-xs ${getStatusColor(feature.status)}`}>
                    {feature.status}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Expected: {feature.timeline}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Join our AI beta program</span>
          </div>
        </div>
      </div>
    </section>
  );
}