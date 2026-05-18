import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Loader2, KeyRound, LogIn } from "lucide-react";
import logo from "@/assets/logo-circle.png";

export default function TeamLogin() {
  const {
    isAuthenticated,
    isLoading,
    isRecovering,
    signInWithPassword,
    updatePassword,
  } = useTeamAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isRecovering) {
    // Invite-acceptance + admin-triggered reset both land here.
    const handleSetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);
      const res = await updatePassword(newPassword);
      setSubmitting(false);
      if (!res.ok) setError(res.error ?? "Could not set password");
    };
    return (
      <Shell subtitle="Set your password">
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-muted-foreground text-sm">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="bg-secondary border-border"
              required
              autoFocus
            />
          </div>
          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}
          <Button
            type="submit"
            variant="hero"
            className="w-full"
            disabled={submitting || newPassword.length < 8}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            Set password
          </Button>
        </form>
      </Shell>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/team/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await signInWithPassword(email, password);
    setSubmitting(false);
    if (!res.ok) setError(res.error ?? "Could not sign in");
  };

  return (
    <Shell>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-muted-foreground text-sm">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-secondary border-border"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-muted-foreground text-sm">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-secondary border-border"
            required
          />
        </div>
        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}
        <Button
          type="submit"
          variant="hero"
          className="w-full"
          disabled={submitting || !email.trim() || !password}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4 mr-2" />
          )}
          Sign in
        </Button>
      </form>
    </Shell>
  );
}

function Shell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Link
        to="/"
        className="absolute top-6 left-6 text-muted-foreground hover:text-foreground transition-colors"
        title="Back to website"
      >
        <Home className="w-5 h-5" />
      </Link>
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <img src={logo} alt="Harborline" className="w-12 h-12 rounded-full" />
          </div>
          <CardTitle className="font-display text-xl tracking-wide-custom text-foreground">
            Team Portal
          </CardTitle>
          {subtitle && (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
