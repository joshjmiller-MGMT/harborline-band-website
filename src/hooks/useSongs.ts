import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Song, SetlistOrg } from "@/lib/songFilters";

/**
 * Fetches the song catalog from public.songs (the single source of truth, shared
 * by the public /songs page and the team setlist builder).
 *
 * @param org  optional org filter — returns only songs tagged for that org
 *             (org_tags @> {org}). Omit for the full public catalog.
 */
export function useSongs(org?: SetlistOrg) {
  return useQuery<Song[]>({
    queryKey: ["songs", org ?? "all"],
    staleTime: 5 * 60 * 1000, // tiny, read-mostly catalog — cache 5 min
    queryFn: async () => {
      let query = supabase
        .from("songs")
        .select("id, title, artist, genre, functions, decade, org_tags")
        .eq("active", true)
        .order("artist", { ascending: true })
        .order("title", { ascending: true });

      if (org) query = query.contains("org_tags", [org]);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });
}
