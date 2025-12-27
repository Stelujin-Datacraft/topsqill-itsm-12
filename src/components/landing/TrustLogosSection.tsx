import { Building2, Briefcase, Globe, Landmark, Cpu, ShoppingCart, Rocket, HeartPulse } from "lucide-react";

const companies = [
  { name: "TechCorp", icon: Cpu },
  { name: "GlobalBank", icon: Landmark },
  { name: "RetailMax", icon: ShoppingCart },
  { name: "ConsultPro", icon: Briefcase },
  { name: "WorldWide Inc", icon: Globe },
  { name: "Enterprise Co", icon: Building2 },
  { name: "StartupHub", icon: Rocket },
  { name: "HealthFirst", icon: HeartPulse }
];

export default function TrustLogosSection() {
  return (
    <section className="py-16 bg-gradient-to-r from-muted/40 via-background to-muted/40 border-y border-border/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-lg font-medium text-foreground mb-2">
            Trusted by Leading Organizations Worldwide
          </p>
          <p className="text-sm text-muted-foreground">
            Join 500+ companies transforming their business processes
          </p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6 items-center">
          {companies.map((company, index) => (
            <div
              key={index}
              className="group flex flex-col items-center justify-center p-4 rounded-xl bg-background border border-border/30 hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-2 group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300">
                <company.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-center">
                {company.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
