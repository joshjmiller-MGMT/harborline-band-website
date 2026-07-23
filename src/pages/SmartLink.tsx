import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { MessageCircle, Mail, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { platformMeta, logSmartLinkEvent, initMetaPixel, pixelTrack, type SmartLinkRow, type PlatformLink } from "@/lib/smartlink";

// Public smart-link landing at /l/:slug — "our own Artist Hub". Standalone page
// (no team chrome): blurred-artwork backdrop, the cover, and one button per DSP.
// Buttons are canonical https links, so a tap deep-links into the native app on
// mobile and falls back to the web player otherwise. Views + clicks are logged.
// Fan capture (Josh 7/22, vibe.to reference): text or email signup on the
// lander. Rows land in fan_signups (public INSERT-only RLS) and auto-flow
// into contacts tagged 'fan' via DB trigger; /team/fans is the ops surface.
function FanSignup({ slug, accent }: { slug: string; accent: string }) {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return; // Enter-key re-entrancy guard
    const v = value.trim();
    setErr(null);
    // Canonical US form: "+1 410…" and "410…" must collide to one contact —
    // the DB trigger applies the same leading-1 strip.
    let norm = mode === "email" ? v.toLowerCase() : v.replace(/\D/g, "");
    if (mode === "phone" && norm.length === 11 && norm.startsWith("1")) norm = norm.slice(1);
    if (mode === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      setErr("That email doesn't look right.");
      return;
    }
    if (mode === "phone" && (norm.length < 10 || norm.length > 15)) {
      setErr("That number doesn't look right.");
      return;
    }
    setBusy(true);
    const { error } = await (supabase as unknown as { from: (t: string) => any })
      .from("fan_signups")
      .insert({ slug, contact_type: mode, contact_value: v, contact_norm: norm });
    setBusy(false);
    // 23505 = already signed up on this release — that's a success to the fan.
    if (error && error.code !== "23505") {
      setErr("Something went wrong — try again.");
      return;
    }
    logSmartLinkEvent(slug, "click", `signup_${mode}`);
    pixelTrack("Lead", { content_name: slug, method: mode });
    setDone(true);
  };

  if (done) {
    return (
      <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-6 text-center backdrop-blur-sm">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: accent }}
        >
          <Check className="h-5 w-5" style={{ color: "#141210" }} />
        </span>
        <p className="mt-3 font-medium">You're on the list.</p>
        <p className="mt-1 text-sm text-white/50">We'll hit you when something drops.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-5 backdrop-blur-sm">
      <p className="text-center font-semibold leading-snug">
        Get notified about new releases, shows, and other unexpected news
      </p>

      <div className="mt-4 flex items-center justify-center gap-3">
        {([
          ["phone", MessageCircle],
          ["email", Mail],
        ] as const).map(([m, Icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setErr(null); }}
            aria-label={m === "phone" ? "Sign up by text" : "Sign up by email"}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
              mode === m
                ? "border-white bg-white text-neutral-950"
                : "border-white/25 text-white/60 hover:border-white/50 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-white/20 bg-neutral-950/40 px-4 py-1.5 focus-within:border-white/50">
        <input
          type={mode === "email" ? "email" : "tel"}
          inputMode={mode === "email" ? "email" : "tel"}
          autoComplete={mode === "email" ? "email" : "tel"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          placeholder={mode === "email" ? "Your email" : "Your number"}
          className="h-10 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !value.trim()}
          aria-label="Sign up"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-950 transition disabled:opacity-40"
          style={{ backgroundColor: accent }}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {err && <p className="mt-2 text-center text-xs text-red-300">{err}</p>}

      <p className="mt-3 text-center text-[10px] leading-relaxed text-white/35">
        By submitting you agree to receive occasional updates from Harborline at the contact
        provided. Msg &amp; data rates may apply. Reply STOP to opt out of texts; every email has
        an unsubscribe link.
      </p>
    </div>
  );
}

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
      // Per-link Meta Pixel: lets ads pointed at this lander optimize on real
      // conversions (Lead = fan signup) instead of raw clicks.
      if ((data as SmartLinkRow).pixel_id) {
        initMetaPixel((data as SmartLinkRow).pixel_id!);
        pixelTrack("ViewContent", { content_name: (data as SmartLinkRow).title });
      }
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

  // Brand (Josh 7/22): cobalt primary + royal purple, CREAM as the accent.
  const accent = link.accent || "#efe6cf";
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

      {/* Blurred artwork backdrop — fixed so it fills on scroll too (Josh 7/22:
          keep the art present, subtle blur, not crushed to black) */}
      {link.artwork_url && (
        <div
          className="fixed inset-0 bg-cover bg-center scale-125 blur-3xl opacity-55 saturate-125"
          style={{ backgroundImage: `url(${link.artwork_url})` }}
          aria-hidden
        />
      )}
      <div className="fixed inset-0 bg-gradient-to-b from-neutral-950/35 via-neutral-950/55 to-neutral-950/85" aria-hidden />

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
              style={{ backgroundColor: accent, color: "#141210" }}
            >
              {link.subtitle}
            </span>
          )}
          <h1 className="mt-3 text-2xl font-semibold">{link.title}</h1>
          <p className="text-white/60">{link.artist}</p>
        </div>

        {/* Brand divider: cobalt -> royal purple */}
        <div className="mt-6 h-0.5 w-24 rounded-full" style={{ background: "linear-gradient(135deg, #3b64ee, #8a4bea)" }} aria-hidden />

        {/* Platform buttons */}
        <div className="mt-6 w-full space-y-3">
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
                  onClick={() => {
                    logSmartLinkEvent(link.slug, "click", p.platform);
                    pixelTrack("Contact", { content_name: link.title, platform: p.platform });
                  }}
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

        <FanSignup slug={link.slug} accent={accent} />

        <div className="mt-auto pt-10 text-center">
          <a href="/" className="text-xs text-white/30 hover:text-white/60 transition">
            harborlineband.com
          </a>
        </div>
      </div>
    </div>
  );
}
