import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface TeamAuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  isRecovering: boolean;
  session: Session | null;
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
