import deloitteLogo from "@/assets/partners/deloitte.png";
import tclLogo from "@/assets/partners/tcl.png";
import techcoralLogo from "@/assets/partners/techcoral.png";
import inspiraLogo from "@/assets/partners/inspira.png";
import grantThorntonLogo from "@/assets/partners/grant-thornton.png";
import aelumLogo from "@/assets/partners/aelum.png";
import ananttamLogo from "@/assets/partners/ananttam.png";
import timusLogo from "@/assets/partners/timus.png";
import celsiorLogo from "@/assets/partners/celsior.png";
import deloitteWebp from "@/assets/partners/deloitte.webp";
import tclWebp from "@/assets/partners/tcl.webp";
import techcoralWebp from "@/assets/partners/techcoral.webp";
import inspiraWebp from "@/assets/partners/inspira.webp";
import grantThorntonWebp from "@/assets/partners/grant-thornton.webp";
import aelumWebp from "@/assets/partners/aelum.webp";
import ananttamWebp from "@/assets/partners/ananttam.webp";
import timusWebp from "@/assets/partners/timus.webp";
import celsiorWebp from "@/assets/partners/celsior.webp";
import { OptimizedImage } from "@/components/OptimizedImage";

const partners = [
  { name: "Deloitte", logo: deloitteLogo, webp: deloitteWebp, subtitle: "Professional services" },
  { name: "TCL", logo: tclLogo, webp: tclWebp, subtitle: "Technology" },
  { name: "Techcoral", logo: techcoralLogo, webp: techcoralWebp, subtitle: "Digital solutions" },
  { name: "Inspira", logo: inspiraLogo, webp: inspiraWebp, subtitle: "Enterprise IT" },
  { name: "Grant Thornton", logo: grantThorntonLogo, webp: grantThorntonWebp, subtitle: "Professional services" },
  { name: "Aelum", logo: aelumLogo, webp: aelumWebp, subtitle: "ServiceNow consulting" },
  { name: "Ananttam", logo: ananttamLogo, webp: ananttamWebp, subtitle: "Automation & ServiceNow" },
  { name: "Timus", logo: timusLogo, webp: timusWebp, subtitle: "Network security" },
  { name: "Celsior", logo: celsiorLogo, webp: celsiorWebp, subtitle: "Technology consulting" },
];

function PartnerCard({
  partner,
  duplicate = false,
}: {
  partner: (typeof partners)[number];
  duplicate?: boolean;
}) {
  return (
    <div
      className="group flex w-[11.5rem] sm:w-[13.5rem] shrink-0 flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/80 px-4 py-6 sm:px-6 sm:py-8 text-center shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md"
      aria-hidden={duplicate || undefined}
    >
      <div className="mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center overflow-hidden rounded-xl bg-background shadow-sm transition-transform duration-300 group-hover:scale-105">
        <OptimizedImage
          src={partner.logo}
          webpSrc={partner.webp}
          alt={duplicate ? "" : `${partner.name} logo`}
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
  );
}

export default function TrustLogosSection() {
  return (
    <section className="py-14 sm:py-16 border-y border-border/50 bg-muted/10 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="h-px w-10 sm:w-16 bg-border" />
          <p className="text-center text-xs sm:text-sm uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            Trusted by leading organizations worldwide
          </p>
          <div className="h-px w-10 sm:w-16 bg-border" />
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-20 bg-gradient-to-r from-muted/10 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-20 bg-gradient-to-l from-muted/10 to-transparent" />

        <div className="group/marquee flex overflow-hidden">
          <div className="flex w-max gap-4 sm:gap-6 animate-marquee-rtl motion-reduce:animate-none group-hover/marquee:[animation-play-state:paused] py-1">
            {partners.map((partner) => (
              <PartnerCard key={partner.name} partner={partner} />
            ))}
            {partners.map((partner) => (
              <PartnerCard key={`dup-${partner.name}`} partner={partner} duplicate />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
