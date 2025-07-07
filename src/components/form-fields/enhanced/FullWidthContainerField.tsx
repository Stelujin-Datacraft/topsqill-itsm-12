
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';

interface FullWidthContainerFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function FullWidthContainerField({ field, value, onChange, error, disabled }: FullWidthContainerFieldProps) {
  const config = field.customConfig || {};
  const mediaType = config.mediaType || 'image';
  const mediaUrl = config.mediaUrl || '';
  const aspectRatio = config.aspectRatio || 'auto';

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16:9': return 'aspect-video';
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      case '21:9': return 'aspect-[21/9]';
      default: return '';
    }
  };

  const renderYouTubeEmbed = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
    if (!videoId) return null;

    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}${config.autoPlay ? '?autoplay=1' : ''}`}
        title="YouTube video"
        className="w-full h-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  };

  const renderContent = () => {
    if (!mediaUrl) {
      return (
        <div className="flex items-center justify-center h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">No media configured</p>
        </div>
      );
    }

    if (mediaType === 'video') {
      if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
        return renderYouTubeEmbed(mediaUrl);
      } else {
        return (
          <video
            src={mediaUrl}
            controls
            autoPlay={config.autoPlay}
            className="w-full h-full object-cover"
          >
            Your browser does not support the video tag.
          </video>
        );
      }
    } else {
      // Handle both base64 data URLs and regular URLs
      return (
        <img
          src={mediaUrl}
          alt={field.label || 'Uploaded image'}
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => {
            console.error('Image failed to load:', mediaUrl);
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }
  };

  return (
    <div className="w-full space-y-2">
      {field.label && (
        <Label className="text-lg font-medium">{field.label}</Label>
      )}
      
      <div className={`w-full overflow-hidden rounded-lg ${getAspectRatioClass()}`}>
        {renderContent()}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
