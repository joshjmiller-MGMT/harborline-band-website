import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// RBAC (spec: wiki/harborline/rbac-spec-2026-08.md). Until 2026-08-02 the only
// gate was `isAuthenticated` — every signed-in user saw every /team page. Roles
// live in team_profiles (single source of truth, read here for the UI; RLS
// enforces the real boundary server-side in a later step).
export type TeamRole = "owner" | "manager" | "member" | "collaborator";

// Which hubs/surfaces each role may reach. Members get the music + run side
// (what a player actually needs); collaborators get only what they're assigned.
const ROLE_HUBS: Record<TeamRole, string[] | "all"> = {
  owner: "all",
  manager: "all",
  member: ["Music", "Run"],
  collaborator: [],
};

interface TeamAuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  isRecovering: boolean;
  session: Session | null;
  role: TeamRole;
  /** Can the current user reach this hub label ("Book"/"Create"/"Music"/"Run")? */
  canHub: (hub: string) => boolean;
  /** Owner-only surfaces (finances, contacts, review board, admin). */
  isOwner: boolean;
  isOperator: boolean;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const TeamAuthContext = createContext<TeamAuthContext | null>(null);

export function TeamAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  // Default 'member' = least privilege. A failed/missing profile lookup must
  // never silently grant more than the safest role.
  const [role, setRole] = useState<TeamRole>("member");

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setRole("member"); return; }
    let alive = true;
    // Ask the database directly (security-definer RPC). Reading team_profiles
    // from the client put a policy, PostgREST exposure and the schema cache
    // between Josh and his own nav — when any of them said nothing, the
    // least-privilege fallback silently demoted the owner to a member menu.
    void (async () => {
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: string | null; error: unknown }>;
      }).rpc("my_role");
      if (!alive) return;
      if (data) { setRole(data as TeamRole); return; }
      if (error) console.warn("[team-auth] role lookup failed, falling back", error);
      const { data: row } = await supabase
        .from("team_profiles").select("role").eq("user_id", uid).maybeSingle();
      if (alive && row?.role) setRole(row.role as TeamRole);
    })();
    return () => { alive = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovering(true);
      } else if (event === "SIGNED_OUT") {
        setIsRecovering(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return { ok: false, error: "Email required" };
    if (!password) return { ok: false, error: "Password required" };
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) {
      if (error.message.toLowerCase().includes("invalid")) {
        return { ok: false, error: "Email or password incorrect." };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const updatePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters" };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    setIsRecovering(false);
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <TeamAuthContext.Provider
      value={{
        isAuthenticated: !!session,
        isLoading,
        isRecovering,
        session,
        role,
        canHub: (hub: string) => {
          const allowed = ROLE_HUBS[role];
          return allowed === "all" || allowed.includes(hub);
        },
        isOwner: role === "owner",
        isOperator: role === "owner" || role === "manager",
        signInWithPassword,
        updatePassword,
        logout,
      }}
    >
      {children}
    </TeamAuthContext.Provider>
  );
}

export function useTeamAuth() {
  const ctx = useContext(TeamAuthContext);
  if (!ctx) throw new Error("useTeamAuth must be used within TeamAuthProvider");
  return ctx;
}
