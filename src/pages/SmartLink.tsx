import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { platformMeta, logSmartLinkEvent, type SmartLinkRow, type PlatformLink } from "@/lib/smartlink";

// Public smart-link landing at /l/:slug — "our own Artist Hub". Standalone page
// (no team chrome): blurred-artwork backdrop, the cover, and one button per DSP.
// Buttons are canonical https links, so a tap deep-links into the native app on
// mobile and falls back to the web player otherwise. Views + clicks are logged.
export default function SmartLink() {
  const { slug } = useParams<{ slug: string }>();
  const [link, setLink] = useState<SmartLinkRow | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) return;
      const { data } = await (supabase as unknown as { from: (t: string) => any })
        .from("smart_links")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!alive) return;
      if (!data) {
        setState("notfound");
        return;
      }
      setLink(data as SmartLinkRow);
      setState("ready");
      logSmartLinkEvent(slug, "view");
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (state === "loading") {
    return <div className="min-h-screen bg-neutral-950" />;
  }

  if (state === "notfound" || !link) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg">This link isn't available.</p>
        <a href="/" className="text-sm text-neutral-500 underline hover:text-neutral-300">
          harborlineband.com
        </a>
      </div>
    );
  }

  const accent = link.accent || "#c9a24b";
  const platforms: PlatformLink[] = Array.isArray(link.platforms) ? link.platforms : [];
  const pageTitle = `${link.artist} — ${link.title}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Listen to ${link.title} by ${link.artist}.`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={`Listen to ${link.title} by ${link.artist}.`} />
        {link.artwork_url && <meta property="og:image" content={link.artwork_url} />}
        <meta property="og:type" content="music.song" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Blurred artwork backdrop */}
      {link.artwork_url && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-40"
          style={{ backgroundImage: `url(${link.artwork_url})` }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/60 via-neutral-950/80 to-neutral-950" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-6 py-12">
        {/* Cover */}
        <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-white/5">
          {link.artwork_url ? (
            <img src={link.artwork_url} alt={link.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
              artwork
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          {link.subtitle && (
            <span
              className="inline-block text-xs uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: accent, color: "#0a0a0a" }}
            >
              {link.subtitle}
            </span>
          )}
          <h1 className="mt-3 text-2xl font-semibold">{link.title}</h1>
          <p className="text-white/60">{link.artist}</p>
        </div>

        {/* Platform buttons */}
        <div className="mt-8 w-full space-y-3">
          {platforms.length === 0 ? (
            <p className="text-center text-white/40 text-sm">Links coming soon.</p>
          ) : (
            platforms.map((p, i) => {
              const meta = platformMeta(p.platform);
              return (
                <a
                  key={`${p.platform}-${i}`}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logSmartLinkEvent(link.slug, "click", p.platform)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm transition hover:bg-white/10"
                >
                  <span className="font-medium">{p.label || meta.label}</span>
                  <span
                    className="text-xs font-bold uppercase tracking-wide px-4 py-1.5 rounded-full text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    Play
                  </span>
                </a>
              );
            })
          )}
        </div>

        <div className="mt-auto pt-10 text-center">
          <a href="/" className="text-xs text-white/30 hover:text-white/60 transition">
            harborlineband.com
          </a>
        </div>
      </div>
    </div>
  );
}
