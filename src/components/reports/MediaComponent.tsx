import React from 'react';
import { ReportMedia } from '@/types/dashboard';
import { Card } from '@/components/ui/card';
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

  const getIcon = () => {
    switch (media.media_type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'link': return <Link2 className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  // For links and documents, use default layout
  if (media.media_type === 'link') {
    return (
      <Card className="overflow-hidden">
        <Header 
          media={media} 
          isEditing={isEditing} 
          onEdit={onEdit} 
          onDelete={onDelete} 
          getIcon={getIcon} 
        />
        <div className="p-2">
          <LinkMedia media={media} />
        </div>
      </Card>
    );
  }

  if (media.media_type === 'document') {
    return (
      <Card className="overflow-hidden">
        <Header 
          media={media} 
          isEditing={isEditing} 
          onEdit={onEdit} 
          onDelete={onDelete} 
          getIcon={getIcon} 
        />
        <div className="p-2">
          <DocumentMedia media={media} />
        </div>
      </Card>
    );
  }

  // For images and videos with custom size
  const containerStyle: React.CSSProperties = {
    width: customWidth ? `${customWidth}px` : '100%',
    height: customHeight ? `${customHeight}px` : '250px',
  };

  return (
    <Card className="overflow-hidden" style={containerStyle}>
      <div className="relative w-full h-full">
        {/* Media content fills the card */}
        {media.media_type === 'image' ? (
          <ImageMedia media={media} />
        ) : (
          <VideoMedia media={media} />
        )}

        {/* Header overlay - always visible in edit mode */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent py-2 px-3 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white min-w-0">
              {getIcon()}
              <span className="text-sm font-medium truncate">
                {media.title || `${media.media_type} media`}
              </span>
            </div>
            {isEditing && (
              <div className="flex gap-1 shrink-0">
                {onEdit && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-7 w-7 p-0 bg-white/90 hover:bg-white"
                    onClick={() => onEdit(media)}
                  >
                    <Edit className="h-3.5 w-3.5 text-gray-700" />
                  </Button>
                )}
                {onDelete && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-7 w-7 p-0 bg-white/90 hover:bg-white"
                    onClick={() => onDelete(media.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description overlay at bottom */}
        {media.description && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent py-2 px-3 z-10">
            <p className="text-white text-xs">{media.description}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Header component for non-media types
function Header({ 
  media, 
  isEditing, 
  onEdit, 
  onDelete, 
  getIcon 
}: { 
  media: ReportMedia; 
  isEditing: boolean; 
  onEdit?: (media: ReportMedia) => void; 
  onDelete?: (mediaId: string) => void;
  getIcon: () => React.ReactNode;
}) {
  return (
    <div className="py-2 px-3 border-b bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {getIcon()}
          <span className="text-sm font-medium truncate">
            {media.title || `${media.media_type} media`}
          </span>
        </div>
        {isEditing && (
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(media)}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onDelete(media.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageMedia({ media }: { media: ReportMedia }) {
  const src = media.url || media.file_path;
  
  if (!src) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
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
  
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);

  if (youtubeMatch) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
        className="w-full h-full border-0"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    );
  }

  if (vimeoMatch) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
        className="w-full h-full border-0"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
      />
    );
  }

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
    <div className="w-full h-full bg-muted flex items-center justify-center">
      <Video className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

function LinkMedia({ media }: { media: ReportMedia }) {
  const url = media.url || '';

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block p-3 bg-muted/50 rounded hover:bg-muted transition-colors"
    >
      <div className="flex items-start gap-3">
        {media.thumbnail_url ? (
          <img 
            src={media.thumbnail_url} 
            alt="" 
            className="w-14 h-14 object-cover rounded shrink-0"
          />
        ) : (
          <div className="w-14 h-14 bg-primary/10 rounded flex items-center justify-center shrink-0">
            <ExternalLink className="h-5 w-5 text-primary" />
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
    if (!url) return;
    
    setTimeout(() => {
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
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
    <div 
      className="p-3 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
      onClick={openDocument}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{fileName}</h4>
          {media.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {media.description}
            </p>
          )}
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}
