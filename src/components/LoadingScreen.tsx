
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  size?: number;
  className?: string;
}

export function LoadingScreen({ 
  message = "Loading...", 
  size = 32, 
  className = "" 
}: LoadingScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center h-64 space-y-4 ${className}`}>
      <Loader2 className="animate-spin text-primary" size={size} />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
