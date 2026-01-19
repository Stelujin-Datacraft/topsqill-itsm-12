import { cn } from "@/lib/utils";

interface DecorativeBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const DecorativeBackground = ({ children, className }: DecorativeBackgroundProps) => {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100/70 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/50" />
      
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large primary gradient orb - top right */}
        <div 
          className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, hsl(217.2 91.2% 59.8% / 0.3) 0%, hsl(217.2 91.2% 59.8% / 0.1) 50%, transparent 70%)',
          }}
        />
        
        {/* Secondary gradient orb - bottom left */}
        <div 
          className="absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, hsl(222.2 47.4% 11.2% / 0.15) 0%, hsl(217.2 91.2% 59.8% / 0.1) 40%, transparent 70%)',
          }}
        />
        
        {/* Accent orb - center right */}
        <div 
          className="absolute top-1/3 -right-20 h-[400px] w-[400px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, hsl(199.2 95.7% 39.4% / 0.2) 0%, transparent 60%)',
          }}
        />
        
        {/* Small accent orb - top left */}
        <div 
          className="absolute top-20 left-20 h-[200px] w-[200px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, hsl(217.2 91.2% 59.8% / 0.25) 0%, transparent 60%)',
          }}
        />
      </div>
      
      {/* Geometric pattern overlay */}
      <div className="absolute inset-0">
        <svg className="h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern-decorative" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern-decorative)" />
        </svg>
      </div>
      
      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large ring - top left */}
        <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full border border-primary/10" />
        <div className="absolute -top-8 -left-8 h-48 w-48 rounded-full border border-accent/10" />
        
        {/* Large ring - bottom right */}
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full border border-primary/10" />
        <div className="absolute -bottom-10 -right-10 h-60 w-60 rounded-full border border-accent/10" />
        
        {/* Floating dots */}
        <div className="absolute top-1/4 left-[15%] h-3 w-3 rounded-full bg-accent/20" />
        <div className="absolute top-[20%] right-[20%] h-2 w-2 rounded-full bg-primary/15" />
        <div className="absolute bottom-1/3 left-[10%] h-4 w-4 rounded-full bg-accent/15" />
        <div className="absolute bottom-[25%] right-[15%] h-2 w-2 rounded-full bg-primary/20" />
        <div className="absolute top-1/2 left-[5%] h-2 w-2 rounded-full bg-accent/25" />
        <div className="absolute top-[60%] right-[8%] h-3 w-3 rounded-full bg-primary/10" />
        
        {/* Decorative lines */}
        <div className="absolute top-[15%] left-[25%] w-24 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
        <div className="absolute bottom-[20%] right-[25%] w-32 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      </div>
      
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
};
