import { supabase } from "@/integrations/supabase/client";

// Personal smart-link ("Artist Hub") shared bits: the platform catalog + the
// best-effort event logger used by both the public /l/:slug page and the
// /team/smart-links manager. Josh 2026-07-21.

export type PlatformLink = { platform: string; label?: string; url: string };

export type SmartLinkRow = {
  id?: string;
  slug: string;
  title: string;
  artist: string;
  subtitle?: string | null;
  artwork_url?: string | null;
  release_date?: string | null;
  platforms: PlatformLink[];
  accent?: string | null;
  is_active: boolean;
};

// The DSPs a fan expects, in the order Artist Hub / Linkfire show them. Each
// destination URL should be the platform's canonical https link — on mobile the
// OS routes those "universal links" straight into the native app, with the web
// player as the automatic fallback when the app isn't installed.
export const PLATFORMS: { key: string; label: string; color: string }[] = [
  { key: "spotify", label: "Spotify", color: "#1DB954" },
  { key: "apple_music", label: "Apple Music", color: "#FA243C" },
  { key: "youtube_music", label: "YouTube Music", color: "#FF0000" },
  { key: "youtube", label: "YouTube", color: "#FF0000" },
  { key: "bandcamp", label: "Bandcamp", color: "#629AA9" },
  { key: "soundcloud", label: "SoundCloud", color: "#FF5500" },
  { key: "amazon_music", label: "Amazon Music", color: "#00A8E1" },
  { key: "tidal", label: "Tidal", color: "#111111" },
  { key: "deezer", label: "Deezer", color: "#A238FF" },
  { key: "pandora", label: "Pandora", color: "#224099" },
  { key: "presave", label: "Pre-save", color: "#C9A24B" },
  { key: "website", label: "Website", color: "#C9A24B" },
  { key: "other", label: "Other", color: "#888888" },
];

export function platformMeta(key: string) {
  return PLATFORMS.find((p) => p.key === key) ?? { key, label: key, color: "#888888" };
}

// Fire-and-forget analytics. Never let a logging failure affect the fan's click.
export async function logSmartLinkEvent(
  slug: string,
  kind: "view" | "click",
  platform?: string,
): Promise<void> {
  try {
    await (supabase as unknown as { from: (t: string) => any })
      .from("smart_link_events")
      .insert({
        slug,
        kind,
        platform: platform ?? null,
        ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
        referrer:
          typeof document !== "undefined" && document.referrer
            ? document.referrer.slice(0, 300)
            : null,
      });
  } catch {
    /* analytics is best-effort — swallow */
  }
}
