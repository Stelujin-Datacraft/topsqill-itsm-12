import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Content-area loading indicator.
 * Shows a spinner centered in the content area (not full page).
 * Has a 150ms delay to prevent flash for fast loads.
 */
export const ContentLoader: React.FC = () => {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!showLoader) {
    // Return empty content area placeholder while waiting
    return (
      <div className="flex-1 bg-background">
        <header className="border-b bg-background/95 backdrop-blur p-4 h-[65px]" />
        <div className="flex-1 p-6 px-[10px] mx-0 py-[10px]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur p-4 h-[65px]" />
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    </div>
  );
};
