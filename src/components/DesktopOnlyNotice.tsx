import React from 'react';
import { Monitor, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';

interface DesktopOnlyNoticeProps {
  toolName: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Wraps heavy admin tools (builders, designers) with a mobile-friendly notice.
 * On phones (<768px), shows a "best on desktop" message instead of the broken UI.
 * On tablet/desktop, renders children normally.
 */
export const DesktopOnlyNotice: React.FC<DesktopOnlyNoticeProps> = ({
  toolName,
  description,
  children,
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{toolName} works best on desktop</h2>
            <p className="text-sm text-muted-foreground">
              {description ||
                `${toolName} requires a larger screen and precise input for the best experience. Please open this on a tablet or desktop.`}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
