import { ASSET_MANIFEST, type AssetSlug, type AssetSize } from "@/lib/asset-manifest";

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  src: AssetSlug;
  // Tells the browser how big the image will render so it can pick the right
  // derivative from srcset. Defaults to "100vw" (full viewport width). Override
  // with e.g. "(max-width: 768px) 100vw, 33vw" for grid contexts.
  sizes?: string;
}

const DEFAULT_SIZES = "100vw";

// Renders a responsive <img> with srcset/sizes pointing at the four WebP
// derivatives (320 / 600 / 1200 / 2000 width) in Supabase Storage. Browser
// picks the right size based on viewport + DPR. Falls back to the original
// for the `src` attribute (used when srcset doesn't apply or fails).
export function OptimizedImage({
  src,
  alt = "",
  loading = "lazy",
  sizes = DEFAULT_SIZES,
  ...rest
}: OptimizedImageProps) {
  const sources = ASSET_MANIFEST[src];
  if (!sources) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[OptimizedImage] unknown slug "${src}" — check src/lib/asset-manifest.ts`);
    }
    return null;
  }
  const srcSet = `${sources.w320} 320w, ${sources.w600} 600w, ${sources.w1200} 1200w, ${sources.w2000} 2000w`;
  return (
    <img
      src={sources.w1200}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={loading}
      {...rest}
    />
  );
}

// URL helper for cases where a component can't render — CSS backgrounds, <meta>
// tags, anchor downloads. Defaults to original; pass a size to get a derivative.
export function asset(slug: AssetSlug, size: AssetSize = "original"): string {
  return ASSET_MANIFEST[slug][size];
}
