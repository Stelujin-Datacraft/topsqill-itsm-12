import type { ImgHTMLAttributes } from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  /** Optional WebP source (AVIF can be added later). */
  webpSrc?: string;
  /** When true (default for non-priority), uses loading="lazy". */
  priority?: boolean;
};

/**
 * Marketing/public image helper: explicit dimensions, lazy by default,
 * optional WebP via <picture> with PNG/JPEG fallback.
 */
export function OptimizedImage({
  webpSrc,
  priority = false,
  width,
  height,
  loading,
  decoding = 'async',
  alt,
  ...rest
}: Props) {
  const load = loading ?? (priority ? 'eager' : 'lazy');
  const img = (
    <img
      alt={alt ?? ''}
      width={width}
      height={height}
      loading={load}
      decoding={decoding}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      {...rest}
    />
  );

  if (!webpSrc) return img;

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      {img}
    </picture>
  );
}
