import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Mail, Phone, Globe, Instagram, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Public per-act press kit at /epk/:slug (EPK builder step 3, Josh 7/27).
// Renders from the epk_public view (press-safe columns only) + the act's smart
// link (artwork + listen). Harborline keeps its rich hand-authored /epk page —
// this route serves the other acts and redirects harborline there.

type PublicAct = {
  slug: string; name: string; kind: string; status: string;
  one_liner: string | null; bio_short: string | null; bio_long: string | null;
  booking_email: string | null; booking_phone: string | null; website_url: string | null;
  socials: Record<string, string>; listen_smart_link_slug: string | null;
};
type LinkRow = { artwork_url: string | null; title: string; platforms: { platform: string; url: string }[] };

const db = supabase as unknown as { from: (t: string) => any };

export default function ActEPK() {
  const { slug } = useParams<{ slug: string }>();
  const [act, setAct] = useState<PublicAct | null>(null);
  const [link, setLink] = useState<LinkRow | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    if (!slug || slug === "harborline") return;
    let alive = true;
    (async () => {
      const { data } = await db.from("epk_public").select("*").eq("slug", slug).maybeSingle();
      if (!alive) return;
      if (!data) { setState("notfound"); return; }
      const a = data as PublicAct;
      setAct(a);
      setState("ready");
      if (a.listen_smart_link_slug) {
        const { data: l } = await db.from("smart_links")
          .select("artwork_url,title,platforms").eq("slug", a.listen_smart_link_slug).maybeSingle();
        if (alive && l) setLink(l as LinkRow);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  // Harborline's press kit is the hand-authored /epk page.
  if (slug === "harborline") return <Navigate to="/epk" replace />;

  if (state === "loading") return <div className="min-h-screen bg-neutral-950" />;
  if (state === "notfound" || !act) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 flex items-center justify-center px-6">
        <p className="text-lg">This press kit isn't available.</p>
      </div>
    );
  }

  const ig = act.socials?.instagram;

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <Helmet>
        <title>{act.name} — Press Kit</title>
        <meta name="description" content={act.one_liner ?? `${act.name} press kit`} />
        <meta property="og:title" content={`${act.name} — Press Kit`} />
        {act.one_liner && <meta property="og:description" content={act.one_liner} />}
        {link?.artwork_url && <meta property="og:image" content={link.artwork_url} />}
      </Helmet>

      {/* Blurred artwork wash, same language as the smart-link lander */}
      {link?.artwork_url && (
        <div className="fixed inset-0 bg-cover bg-center scale-150 blur-3xl opacity-50 saturate-150"
          style={{ backgroundImage: `url(${link.artwork_url})` }} aria-hidden />
      )}
      <div className="fixed inset-0 bg-gradient-to-b from-neutral-950/40 via-neutral-950/70 to-neutral-950/95" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">Press kit</p>
        <h1 className="mt-2 text-4xl font-semibold">{act.name}</h1>
        {act.one_liner && <p className="mt-3 text-lg text-white/70">{act.one_liner}</p>}

        {(act.bio_long || act.bio_short) && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{act.bio_long || act.bio_short}</p>
          </div>
        )}

        {link && act.listen_smart_link_slug && (
          <a href={`https://gethip.to/${act.listen_smart_link_slug}`} target="_blank" rel="noreferrer"
            className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:bg-white/10">
            {link.artwork_url && <img src={link.artwork_url} alt={link.title} className="h-16 w-16 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-white/40 flex items-center gap-1.5"><Music className="h-3.5 w-3.5" /> Listen</p>
              <p className="font-medium truncate">{link.title}</p>
              <p className="text-xs text-white/50">gethip.to/{act.listen_smart_link_slug}</p>
            </div>
          </a>
        )}

        {/* Booking */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Booking</p>
          <div className="space-y-2 text-sm">
            {act.booking_email && (
              <a href={`mailto:${act.booking_email}`} className="flex items-center gap-2 text-white/80 hover:text-white">
                <Mail className="h-4 w-4 text-white/40" /> {act.booking_email}
              </a>
            )}
            {act.booking_phone && (
              <a href={`tel:${act.booking_phone}`} className="flex items-center gap-2 text-white/80 hover:text-white">
                <Phone className="h-4 w-4 text-white/40" /> {act.booking_phone}
              </a>
            )}
            {act.website_url && (
              <a href={act.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/80 hover:text-white">
                <Globe className="h-4 w-4 text-white/40" /> {act.website_url.replace(/^https?:\/\//, "")}
              </a>
            )}
            {ig && (
              <a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/80 hover:text-white">
                <Instagram className="h-4 w-4 text-white/40" /> @{ig}
              </a>
            )}
            {!act.booking_email && !act.booking_phone && !act.website_url && !ig && (
              <p className="text-white/50">Booking contact coming soon.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
