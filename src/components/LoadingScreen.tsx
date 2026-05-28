
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  size?: number;
  className?: string;
}

export function LoadingScreen({ 
  message = "Loading...", 
  size = 48, 
  className = "" 
}: LoadingScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center w-full min-h-[50vh] space-y-4 ${className}`}>
      <Loader2 className="animate-spin text-primary" size={size} />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
