import { cn } from "@/lib/utils";

interface DecorativeBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const DecorativeBackground = ({ children, className }: DecorativeBackgroundProps) => {
  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-primary/5", className)}>
      {/* Branded gradient mesh - matching landing page style */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary brand gradient - top area */}
        <div 
          className="absolute -top-1/2 left-1/2 -translate-x-1/2 h-[800px] w-[1200px] rounded-full opacity-[0.08]"
          style={{
            background: 'radial-gradient(ellipse, hsl(var(--primary)) 0%, transparent 70%)',
          }}
        />
        
        {/* Secondary soft gradient - bottom left */}
        <div 
          className="absolute -bottom-1/3 -left-1/4 h-[600px] w-[600px] rounded-full opacity-[0.06]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--accent)) 0%, transparent 60%)',
          }}
        />
        
        {/* Accent gradient - right side */}
        <div 
          className="absolute top-1/4 -right-1/4 h-[500px] w-[500px] rounded-full opacity-[0.05]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--accent)) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Brand watermark logo - subtle centered background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative opacity-[0.03]">
          <img 
            src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png" 
            alt="" 
            className="w-[400px] h-[400px] object-contain"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Grid pattern overlay - matching landing page enterprise feel */}
      <div className="absolute inset-0 opacity-[0.02]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="auth-grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid-pattern)" />
        </svg>
      </div>

      {/* Decorative enterprise elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Corner accents - top left */}
        <div className="absolute top-0 left-0 w-32 h-32">
          <div className="absolute top-8 left-8 w-16 h-px bg-gradient-to-r from-primary/20 to-transparent" />
          <div className="absolute top-8 left-8 w-px h-16 bg-gradient-to-b from-primary/20 to-transparent" />
        </div>
        
        {/* Corner accents - top right */}
        <div className="absolute top-0 right-0 w-32 h-32">
          <div className="absolute top-8 right-8 w-16 h-px bg-gradient-to-l from-primary/20 to-transparent" />
          <div className="absolute top-8 right-8 w-px h-16 bg-gradient-to-b from-primary/20 to-transparent" />
        </div>
        
        {/* Corner accents - bottom left */}
        <div className="absolute bottom-0 left-0 w-32 h-32">
          <div className="absolute bottom-8 left-8 w-16 h-px bg-gradient-to-r from-primary/20 to-transparent" />
          <div className="absolute bottom-8 left-8 w-px h-16 bg-gradient-to-t from-primary/20 to-transparent" />
        </div>
        
        {/* Corner accents - bottom right */}
        <div className="absolute bottom-0 right-0 w-32 h-32">
          <div className="absolute bottom-8 right-8 w-16 h-px bg-gradient-to-l from-primary/20 to-transparent" />
          <div className="absolute bottom-8 right-8 w-px h-16 bg-gradient-to-t from-primary/20 to-transparent" />
        </div>

        {/* Floating brand dots */}
        <div className="absolute top-[15%] left-[10%] w-2 h-2 rounded-full bg-primary/10" />
        <div className="absolute top-[25%] right-[15%] w-1.5 h-1.5 rounded-full bg-accent/15" />
        <div className="absolute bottom-[20%] left-[15%] w-2.5 h-2.5 rounded-full bg-primary/8" />
        <div className="absolute bottom-[30%] right-[10%] w-2 h-2 rounded-full bg-accent/10" />
        <div className="absolute top-[50%] left-[5%] w-1.5 h-1.5 rounded-full bg-primary/12" />
        <div className="absolute top-[40%] right-[5%] w-2 h-2 rounded-full bg-accent/8" />
        
        {/* Subtle connecting lines */}
        <div className="absolute top-[20%] left-[20%] w-20 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent rotate-45" />
        <div className="absolute bottom-[25%] right-[20%] w-24 h-px bg-gradient-to-r from-transparent via-accent/10 to-transparent -rotate-45" />
      </div>

      {/* Soft vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, hsl(var(--background) / 0.3) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
};
