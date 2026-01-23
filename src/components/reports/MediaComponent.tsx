import React from 'react';
import { ReportMedia } from '@/types/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Edit, ExternalLink, Image, Video, FileText, Link2 } from 'lucide-react';

interface MediaComponentProps {
  media: ReportMedia;
  onEdit?: (media: ReportMedia) => void;
  onDelete?: (mediaId: string) => void;
  isEditing?: boolean;
}

export function MediaComponent({ media, onEdit, onDelete, isEditing = false }: MediaComponentProps) {
  const customWidth = media.metadata?.width;
  const customHeight = media.metadata?.height;
  const hasCustomSize = (media.media_type === 'image' || media.media_type === 'video') && (customWidth || customHeight);

  const getIcon = () => {
    switch (media.media_type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'link': return <Link2 className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  // Container style based on media dimensions
  const containerStyle: React.CSSProperties = hasCustomSize ? {
    width: customWidth ? `${customWidth}px` : 'auto',
    height: customHeight ? `${customHeight}px` : 'auto',
    maxWidth: '100%',
  } : {};

  const renderMediaContent = () => {
    switch (media.media_type) {
      case 'image':
        return <ImageMedia media={media} />;
      case 'video':
        return <VideoMedia media={media} />;
      case 'link':
        return <LinkMedia media={media} />;
      case 'document':
        return <DocumentMedia media={media} />;
      default:
        return <div className="text-muted-foreground">Unknown media type</div>;
    }
  };

  // For image/video with custom size, use overlay header
  if (hasCustomSize) {
    return (
      <Card className="overflow-hidden relative" style={containerStyle}>
        {/* Media fills the entire card */}
        <div className="absolute inset-0">
          {renderMediaContent()}
        </div>
        
        {/* Overlay header for title and actions */}
        {(media.title || isEditing) && (
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                {getIcon()}
                <span className="text-sm font-medium truncate">
                  {media.title || `${media.media_type} media`}
                </span>
              </div>
              {isEditing && (
                <div className="flex gap-1">
                  {onEdit && (
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => onEdit(media)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => onDelete(media.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description overlay at bottom */}
        {media.description && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 z-10">
            <p className="text-white text-xs">{media.description}</p>
          </div>
        )}
      </Card>
    );
  }

  // Default layout for links, documents, or media without custom size
  return (
    <Card className="h-full overflow-hidden">
      {(media.title || isEditing) && (
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getIcon()}
              <CardTitle className="text-sm font-medium truncate">
                {media.title || `${media.media_type} media`}
              </CardTitle>
            </div>
            {isEditing && (
              <div className="flex gap-1">
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(media)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
                {onDelete && (
                  <Button variant="ghost" size="sm" onClick={() => onDelete(media.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={media.title || isEditing ? "p-2" : "p-0"}>
        {renderMediaContent()}
      </CardContent>
    </Card>
  );
}

function ImageMedia({ media }: { media: ReportMedia }) {
  const src = media.url || media.file_path;
  
  if (!src) {
    return (
      <div className="h-full w-full bg-muted flex items-center justify-center min-h-[100px]">
        <Image className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={media.title || 'Image'} 
      className="w-full h-full object-cover"
      loading="lazy"
    />
  );
}

function VideoMedia({ media }: { media: ReportMedia }) {
  const url = media.url || '';
  
  // Check if it's a YouTube or Vimeo URL
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);

  if (youtubeMatch) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    );
  }

  if (vimeoMatch) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
        className="w-full h-full"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
      />
    );
  }

  // Direct video file
  if (url) {
    return (
      <video 
        src={url} 
        controls 
        className="w-full h-full object-cover"
        poster={media.thumbnail_url}
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <div className="h-full w-full bg-muted flex items-center justify-center min-h-[100px]">
      <Video className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

function LinkMedia({ media }: { media: ReportMedia }) {
  const url = media.url || '';
  const metadata = media.metadata || {};

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block p-4 bg-muted/50 rounded hover:bg-muted transition-colors"
    >
      <div className="flex items-start gap-3">
        {media.thumbnail_url ? (
          <img 
            src={media.thumbnail_url} 
            alt="" 
            className="w-16 h-16 object-cover rounded shrink-0"
          />
        ) : (
          <div className="w-16 h-16 bg-primary/10 rounded flex items-center justify-center shrink-0">
            <ExternalLink className="h-6 w-6 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{media.title || url}</h4>
          {media.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {media.description}
            </p>
          )}
          <p className="text-xs text-primary mt-1 truncate">{url}</p>
        </div>
      </div>
    </a>
  );
}

function DocumentMedia({ media }: { media: ReportMedia }) {
  const url = media.url || media.file_path || '';
  const fileName = media.title || url.split('/').pop() || 'Document';

  const openDocument = () => {
    if (!url) {
      console.error('No URL available for document');
      return;
    }
    
    // Log for debugging
    console.log('Opening document URL:', url);
    
    // Use a slight delay to ensure the click event is fully processed
    setTimeout(() => {
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        // Fallback: create a link and click it
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }, 0);
  };

  return (
    <div className="block p-4 bg-muted/50 rounded hover:bg-muted transition-colors h-full">
      <div className="flex items-center gap-3 h-full">
        <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center shrink-0">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{fileName}</h4>
          {media.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {media.description}
            </p>
          )}
          {url && (
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 h-auto text-xs text-primary mt-1"
              onClick={(e) => {
                e.stopPropagation();
                openDocument();
              }}
            >
              Click to open document
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            openDocument();
          }}
        >
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
