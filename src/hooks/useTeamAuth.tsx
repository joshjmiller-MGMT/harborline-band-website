import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface TeamAuthContext {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const TeamAuthContext = createContext<TeamAuthContext | null>(null);

const CREDENTIALS = { username: "ADMIN", password: "BSE123" };

export function TeamAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("team_auth") === "true";
  });

  const login = (username: string, password: string) => {
    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
      sessionStorage.setItem("team_auth", "true");
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem("team_auth");
    setIsAuthenticated(false);
  };

  return (
    <TeamAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </TeamAuthContext.Provider>
  );
}

export function useTeamAuth() {
  const ctx = useContext(TeamAuthContext);
  if (!ctx) throw new Error("useTeamAuth must be used within TeamAuthProvider");
  return ctx;
}
