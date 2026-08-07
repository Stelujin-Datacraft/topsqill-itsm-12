import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote:
      "Topsqill helped us standardize enterprise workflows across regions. What used to take weeks of manual coordination now runs through governed forms and approvals.",
    author: "Global Operations Lead",
    role: "Professional Services",
    company: "Deloitte",
    avatar: "D",
    rating: 5,
    metric: "Enterprise rollout",
  },
  {
    quote:
      "We needed a platform that could connect intake, routing, and reporting without custom glue code. Topsqill gave our teams one place to build and scale service workflows.",
    author: "Digital Transformation Team",
    role: "Technology",
    company: "TCL",
    avatar: "TCL",
    rating: 5,
    metric: "Unified operations",
  },
  {
    quote:
      "From client onboarding to internal approvals, Techcoral uses Topsqill to move faster with better visibility. The workflow designer and reporting layer have been especially valuable.",
    author: "Delivery Leadership",
    role: "Digital Solutions",
    company: "Techcoral",
    avatar: "TC",
    rating: 5,
    metric: "Faster delivery",
  },
  {
    quote:
      "Inspira relies on Topsqill for structured enterprise IT processes — secure access, auditable workflows, and dashboards leadership can trust.",
    author: "Enterprise IT",
    role: "Managed Services",
    company: "Inspira",
    avatar: "In",
    rating: 5,
    metric: "Audit-ready workflows",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-warning/10 text-warning">
            Customer Stories
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Trusted by leading organizations worldwide
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See how Deloitte, TCL, Techcoral, and Inspira use Topsqill to run critical business processes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="group hover:shadow-token-md transition-all duration-300 border-border/50 bg-background"
            >
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <Quote className="size-8 text-primary/30 flex-shrink-0" />
                  <div className="flex gap-1">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="icon-md text-warning fill-warning" />
                    ))}
                  </div>
                </div>

                <p className="text-lg text-foreground mb-6 leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-semibold text-xs">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.author}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                      <div className="text-sm text-primary font-medium">{testimonial.company}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    {testimonial.metric}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
