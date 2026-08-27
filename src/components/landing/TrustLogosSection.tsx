import deloitteLogo from "@/assets/partners/deloitte.png";
import tclLogo from "@/assets/partners/tcl.png";
import techcoralLogo from "@/assets/partners/techcoral.png";
import inspiraLogo from "@/assets/partners/inspira.png";
import deloitteWebp from "@/assets/partners/deloitte.webp";
import tclWebp from "@/assets/partners/tcl.webp";
import techcoralWebp from "@/assets/partners/techcoral.webp";
import inspiraWebp from "@/assets/partners/inspira.webp";
import { OptimizedImage } from "@/components/OptimizedImage";

const partners = [
  { name: "Deloitte", logo: deloitteLogo, webp: deloitteWebp, subtitle: "Professional services" },
  { name: "TCL", logo: tclLogo, webp: tclWebp, subtitle: "Technology" },
  { name: "Techcoral", logo: techcoralLogo, webp: techcoralWebp, subtitle: "Digital solutions" },
  { name: "Inspira", logo: inspiraLogo, webp: inspiraWebp, subtitle: "Enterprise IT" },
];

export default function TrustLogosSection() {
  return (
    <section className="py-14 sm:py-16 border-y border-border/50 bg-muted/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="h-px w-10 sm:w-16 bg-border" />
          <p className="text-center text-xs sm:text-sm uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            Trusted by leading organizations worldwide
          </p>
          <div className="h-px w-10 sm:w-16 bg-border" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="group flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/80 px-4 py-6 sm:px-6 sm:py-8 text-center shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md"
            >
              <div className="mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-background shadow-sm transition-transform duration-300 group-hover:scale-105">
                <OptimizedImage
                  src={partner.logo}
                  webpSrc={partner.webp}
                  alt={`${partner.name} logo`}
                  width={40}
                  height={40}
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
                />
              </div>
              <span className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                {partner.name}
              </span>
              <span className="mt-1 text-xs text-muted-foreground hidden sm:block">
                {partner.subtitle}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
