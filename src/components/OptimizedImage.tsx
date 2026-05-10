import { ASSET_MANIFEST, type AssetSlug } from "@/lib/asset-manifest";

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: AssetSlug;
}

// Resolves a manifest slug (e.g. "band/jazz-trio-1") to its public Supabase
// Storage CDN URL and renders a plain <img>. Phase 1 serves originals; Phase 2
// will swap to a <picture> with srcset once the derivative pipeline ships.
export function OptimizedImage({ src, alt = "", loading = "lazy", ...rest }: OptimizedImageProps) {
  const url = ASSET_MANIFEST[src];
  if (!url && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[OptimizedImage] unknown slug "${src}" — check src/lib/asset-manifest.ts`);
  }
  return <img src={url} alt={alt} loading={loading} {...rest} />;
}

// URL helper for cases where a component can't render — CSS backgrounds, <meta>
// tags, anchor downloads, etc.
export function asset(slug: AssetSlug): string {
  return ASSET_MANIFEST[slug];
}
