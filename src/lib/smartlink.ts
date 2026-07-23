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
  pixel_id?: string | null;
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

// UTM params captured once per page load — campaign attribution is the metric
// that mattered on Josh's old vibe.to data (one FB campaign = 25k views).
function utms(): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get("utm_source"),
      utm_medium: p.get("utm_medium"),
      utm_campaign: p.get("utm_campaign"),
    };
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null };
  }
}

// Fire-and-forget analytics. Never let a logging failure affect the fan's click.
// v2 (7/23): events route through the /api/track Netlify edge fn, which stamps
// request geolocation (country/region/city) server-side — the browser alone
// can't know where the fan is. Direct Supabase insert stays as the geo-less
// fallback so tracking survives an edge-fn outage.
export async function logSmartLinkEvent(
  slug: string,
  kind: "view" | "click",
  platform?: string,
): Promise<void> {
  const referrer =
    typeof document !== "undefined" && document.referrer
      ? document.referrer.slice(0, 300)
      : null;
  const payload = { slug, kind, platform: platform ?? null, referrer, ...utms() };
  try {
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // survives the navigation a DSP click triggers
    });
    if (res.ok) return;
    throw new Error(`track ${res.status}`);
  } catch {
    try {
      await (supabase as unknown as { from: (t: string) => any })
        .from("smart_link_events")
        .insert({
          ...payload,
          ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
        });
    } catch {
      /* analytics is best-effort — swallow */
    }
  }
}

// ── Meta Pixel (per-link, optional) ───────────────────────────────────
// When a smart_links row carries pixel_id, the lander boots the pixel and
// fires standard events — PageView on load, Lead on fan signup — so Meta ads
// pointed at gethip.to can optimize on real conversions instead of clicks.
declare global {
  // eslint-disable-next-line no-var
  var fbq: ((...args: unknown[]) => void) | undefined;
}

export function initMetaPixel(pixelId: string): void {
  try {
    if (typeof window === "undefined" || window.fbq) return;
    const f = window as unknown as Record<string, any>;
    const n: any = (f.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod(...args) : n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(t);
    window.fbq!("init", pixelId);
    window.fbq!("track", "PageView");
  } catch {
    /* pixel is best-effort */
  }
}

export function pixelTrack(event: string, params?: Record<string, unknown>): void {
  try {
    window.fbq?.("track", event, params);
  } catch {
    /* best-effort */
  }
}
