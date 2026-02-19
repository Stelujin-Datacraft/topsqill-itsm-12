import React from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme, themes } from '@/contexts/ThemeContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeSelector() {
  const { currentTheme, setTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Palette className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden text-xs">Theme</span>
          <div className="ml-auto flex gap-1 group-data-[collapsible=icon]:hidden">
            <div
              className="w-3 h-3 rounded-full border border-white/20"
              style={{ backgroundColor: currentTheme.previewPrimary }}
            />
            <div
              className="w-3 h-3 rounded-full border border-white/20"
              style={{ backgroundColor: currentTheme.previewAccent }}
            />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-[420px] p-3">
        <p className="text-xs font-semibold text-muted-foreground px-1 pb-2">Select Theme</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                currentTheme.id === theme.id && "bg-muted ring-1 ring-primary/30"
              )}
            >
              <div className="flex gap-1 shrink-0">
                <div
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: theme.previewPrimary }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: theme.previewAccent }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{theme.name}</p>
              </div>
              {currentTheme.id === theme.id && (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
