import React, { useState, useEffect } from 'react';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderSrc?: string;
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  lazy?: boolean;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = '',
  placeholderSrc,
  blurDataURL,
  onLoad,
  onError,
  lazy = false
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!lazy) {
      loadImage();
      return;
    }

    // Set up intersection observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before the image comes into view
        threshold: 0.1
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy]);

  useEffect(() => {
    if (shouldLoad) {
      loadImage();
    }
  }, [shouldLoad, src, retryCount]);

  const loadImage = () => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      setImageLoaded(true);
      setShowPlaceholder(false);
      onLoad?.();
    };

    img.onerror = () => {
      setImageError(true);
      setShowPlaceholder(false);
      onError?.();
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  };

  // If there's an error and no placeholder, show a retry button
  if (imageError && !placeholderSrc) {
    return (
      <div className={`relative overflow-hidden flex items-center justify-center bg-theme-secondary/30 ${className}`}>
        <button
          onClick={() => { setImageError(false); setImageLoaded(false); setRetryCount(c => c + 1); }}
          className="flex flex-col items-center gap-1 text-theme-secondary opacity-50 hover:opacity-80 transition-opacity"
          aria-label="Retry loading image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
          <span className="text-xs">Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder */}
      {showPlaceholder && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110 opacity-70 transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Placeholder image */}
      {showPlaceholder && placeholderSrc && !blurDataURL && (
        <img
          src={placeholderSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50 transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={shouldLoad ? src : undefined}
        alt={alt}
        loading={lazy ? "lazy" : "eager"}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => {
          setImageLoaded(true);
          setShowPlaceholder(false);
        }}
        onError={() => {
          setImageError(true);
          setShowPlaceholder(false);
        }}
      />

      {/* Loading indicator */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-theme-secondary/50">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-theme-primary border-t-transparent"></div>
        </div>
      )}
    </div>
  );
};