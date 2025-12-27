import { Building2, Briefcase, Globe, Landmark, Cpu, ShoppingCart } from "lucide-react";

const companies = [
  { name: "TechCorp", icon: Cpu, color: "text-blue-500", bg: "bg-blue-500/10" },
  { name: "GlobalBank", icon: Landmark, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { name: "RetailMax", icon: ShoppingCart, color: "text-orange-500", bg: "bg-orange-500/10" },
  { name: "ConsultPro", icon: Briefcase, color: "text-purple-500", bg: "bg-purple-500/10" },
  { name: "WorldWide Inc", icon: Globe, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  { name: "Enterprise Co", icon: Building2, color: "text-rose-500", bg: "bg-rose-500/10" }
];

export default function TrustLogosSection() {
  return (
    <section className="py-16 border-y border-border/50 bg-muted/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="h-px w-12 bg-primary/30" />
          <p className="text-center text-sm uppercase tracking-widest font-semibold text-primary">
            Trusted by leading organizations worldwide
          </p>
          <div className="h-px w-12 bg-primary/30" />
        </div>
        
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
          {companies.map((company, index) => (
            <div
              key={index}
              className={`group flex items-center gap-3 px-5 py-3 rounded-full ${company.bg} border border-transparent hover:border-current/20 transition-all duration-300 cursor-pointer hover:scale-105`}
            >
              <div className={`p-2 rounded-full bg-background shadow-sm ${company.color}`}>
                <company.icon className="h-5 w-5" />
              </div>
              <span className={`text-base font-semibold tracking-tight ${company.color}`}>
                {company.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
