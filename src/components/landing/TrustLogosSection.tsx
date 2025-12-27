import { Building2, Briefcase, Globe, Landmark, Cpu, ShoppingCart } from "lucide-react";

const companies = [
  { name: "TechCorp", icon: Cpu },
  { name: "GlobalBank", icon: Landmark },
  { name: "RetailMax", icon: ShoppingCart },
  { name: "ConsultPro", icon: Briefcase },
  { name: "WorldWide Inc", icon: Globe },
  { name: "Enterprise Co", icon: Building2 }
];

export default function TrustLogosSection() {
  return (
    <section className="py-12 border-y bg-muted/10">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm mb-8 uppercase tracking-wider">
          <span className="bg-gradient-to-r from-primary via-orange-500 to-secondary bg-clip-text text-transparent font-semibold">
            Trusted by leading organizations worldwide
          </span>
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {companies.map((company, index) => (
            <div
              key={index}
              className="group flex items-center gap-2 text-muted-foreground/60 hover:text-foreground transition-all duration-300 cursor-pointer"
            >
              <company.icon className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="text-lg font-semibold tracking-tight">{company.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
