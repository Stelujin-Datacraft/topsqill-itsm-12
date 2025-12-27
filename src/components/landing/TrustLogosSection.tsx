export default function TrustLogosSection() {
  const companies = [
    "TechCorp",
    "GlobalBank",
    "RetailMax",
    "ConsultPro",
    "WorldWide Inc",
    "Enterprise Co",
    "StartupHub",
    "HealthFirst"
  ];

  return (
    <section className="py-14 border-b border-border/40">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-10">
          Trusted by 500+ organizations worldwide
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
          {companies.map((company, index) => (
            <span
              key={index}
              className="text-xl md:text-2xl font-bold text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors duration-300 cursor-default tracking-tight"
            >
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
