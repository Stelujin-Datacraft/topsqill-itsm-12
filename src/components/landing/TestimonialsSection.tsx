import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "Topsqill transformed our entire data collection process. We went from spending 40 hours/week on manual form processing to fully automated workflows.",
    author: "Sarah Chen",
    role: "VP of Operations",
    company: "TechCorp Industries",
    avatar: "SC",
    rating: 5,
    metric: "40 hrs/week saved"
  },
  {
    quote: "The SQL query engine is a game-changer. Our analytics team can now pull insights directly from form submissions without waiting for IT.",
    author: "Michael Rodriguez",
    role: "Head of Analytics",
    company: "DataFlow Solutions",
    avatar: "MR",
    rating: 5,
    metric: "10x faster insights"
  },
  {
    quote: "We evaluated 12 form platforms before choosing Topsqill. The workflow automation and enterprise security features were unmatched.",
    author: "Emily Watson",
    role: "CTO",
    company: "SecureFinance Corp",
    avatar: "EW",
    rating: 5,
    metric: "SOC 2 compliant"
  },
  {
    quote: "Rolling out to 500+ employees was seamless. The role-based permissions and organization management saved us months of custom development.",
    author: "David Kim",
    role: "Director of IT",
    company: "GlobalRetail Inc",
    avatar: "DK",
    rating: 5,
    metric: "500+ users onboarded"
  }
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-amber-100 text-amber-800">
            Customer Stories
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Trusted by Industry Leaders
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See how organizations are transforming their operations with Topsqill
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-border/50 bg-background"
            >
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <Quote className="h-8 w-8 text-primary/30 flex-shrink-0" />
                  <div className="flex gap-1">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
                
                <p className="text-lg text-foreground mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.author}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                      <div className="text-sm text-primary">{testimonial.company}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
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
