import { cn } from "@/lib/utils";

interface DecorativeBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const DecorativeBackground = ({ children, className }: DecorativeBackgroundProps) => {
  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-secondary/30", className)}>
      {/* Gradient Mesh Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary gradient blob - top left */}
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        
        {/* Secondary gradient blob - top right */}
        <div className="absolute -top-20 right-0 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        
        {/* Accent gradient blob - bottom left */}
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        
        {/* Bottom right gradient */}
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-secondary/15 blur-3xl" />
        
        {/* Center subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/3 blur-3xl" />
      </div>
      
      {/* Geometric Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.015]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" className="text-foreground" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>
      </div>
      
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-1/4 h-2 w-2 rounded-full bg-primary/20" />
        <div className="absolute top-1/3 left-20 h-3 w-3 rounded-full bg-primary/15" />
        <div className="absolute bottom-1/4 right-20 h-2 w-2 rounded-full bg-primary/25" />
        <div className="absolute bottom-20 left-1/3 h-4 w-4 rounded-full bg-primary/10" />
        <div className="absolute top-1/2 right-10 h-2 w-2 rounded-full bg-secondary/30" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
};
