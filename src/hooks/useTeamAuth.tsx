import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface TeamAuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  session: Session | null;
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const TeamAuthContext = createContext<TeamAuthContext | null>(null);

export function TeamAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return { ok: false, error: "Email required" };
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/team/dashboard`,
      },
    });
    if (error) return { ok: false, error: error.message };
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
        session,
        sendMagicLink,
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
