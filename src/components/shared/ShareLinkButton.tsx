import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareLinkButtonProps {
  assetType: 'workflow' | 'report' | 'form';
  assetId: string;
  assetName: string;
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'default' | 'icon';
}

export function ShareLinkButton({ 
  assetType, 
  assetId, 
  assetName,
  variant = 'ghost',
  size = 'sm'
}: ShareLinkButtonProps) {
  const { toast } = useToast();

  const getViewUrl = () => {
    const baseUrl = window.location.origin;
    switch (assetType) {
      case 'workflow':
        return `${baseUrl}/workflow-view/${assetId}`;
      case 'report':
        return `${baseUrl}/report-view/${assetId}`;
      case 'form':
        return `${baseUrl}/form/${assetId}`;
      default:
        return `${baseUrl}/${assetType}/${assetId}`;
    }
  };

  const handleCopyLink = () => {
    const url = getViewUrl();
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} link copied to clipboard`,
    });
  };

  const handleOpenInNewTab = () => {
    const url = getViewUrl();
    window.open(url, '_blank');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} title={`Share ${assetName}`} className="text-primary hover:text-primary hover:bg-primary/10">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenInNewTab}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
