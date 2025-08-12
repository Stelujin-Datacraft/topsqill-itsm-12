import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';

export default function AnnouncementBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-primary/90 via-primary to-secondary text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-20"></div>
      
      <div className="container mx-auto px-4 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            <Sparkles className="w-3 h-3 mr-1" />
            BETA
          </Badge>
          <span className="text-sm md:text-base font-medium">
            🚀 Currently in Beta Testing - Launch coming soon! 
            <span className="hidden sm:inline ml-2">Join 200+ beta testers shaping the future of form automation</span>
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(false)}
          className="text-white hover:bg-white/20 h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}