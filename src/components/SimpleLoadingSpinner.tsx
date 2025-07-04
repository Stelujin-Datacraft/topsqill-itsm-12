
import { Loader2 } from 'lucide-react';

interface SimpleLoadingSpinnerProps {
  size?: number;
  className?: string;
}

export function SimpleLoadingSpinner({ size = 24, className = "" }: SimpleLoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className={`animate-spin text-muted-foreground`} size={size} />
    </div>
  );
}
