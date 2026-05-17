import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Home, Loader2, KeyRound, LogIn } from "lucide-react";
import logo from "@/assets/logo-circle.png";

type Mode = "signin" | "magic-link-sent" | "reset-sent";

export default function TeamLogin() {
  const {
    isAuthenticated,
    isLoading,
    isRecovering,
    sendMagicLink,
    signInWithPassword,
    sendPasswordReset,
    updatePassword,
  } = useTeamAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Recovery state takes precedence — even if "authenticated" via the recovery
  // session, we want the user to set a new password before landing on /team.
  if (isRecovering) {
    const handleSetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);
      const res = await updatePassword(newPassword);
      setSubmitting(false);
      if (!res.ok) {
        setError(res.error ?? "Could not set password");
      }
      // On success, isRecovering flips to false and isAuthenticated stays true
      // -> the redirect below kicks in on next render.
    };
    return (
      <Shell>
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

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await signInWithPassword(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Could not sign in");
    }
  };

  const handleMagicLink = async () => {
    setError("");
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }
    setSubmitting(true);
    const res = await sendMagicLink(email);
    setSubmitting(false);
    if (res.ok) {
      setMode("magic-link-sent");
    } else {
      setError(res.error ?? "Could not send link");
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }
    setSubmitting(true);
    const res = await sendPasswordReset(email);
    setSubmitting(false);
    if (res.ok) {
      setMode("reset-sent");
    } else {
      setError(res.error ?? "Could not send reset link");
    }
  };

  const resetToSignIn = () => {
    setMode("signin");
    setEmail("");
    setPassword("");
    setError("");
  };

  if (mode === "magic-link-sent") {
    return (
      <Shell>
        <div className="space-y-3 text-center text-sm">
          <p className="text-foreground">Check your inbox.</p>
          <p className="text-muted-foreground">
            A sign-in link is on the way to{" "}
            <span className="text-foreground">{email}</span>. Click it from this
            device to finish signing in.
          </p>
          <Button variant="ghost" size="sm" onClick={resetToSignIn}>
            Use a different method
          </Button>
        </div>
      </Shell>
    );
  }

  if (mode === "reset-sent") {
    return (
      <Shell>
        <div className="space-y-3 text-center text-sm">
          <p className="text-foreground">Check your inbox.</p>
          <p className="text-muted-foreground">
            A password-reset link is on the way to{" "}
            <span className="text-foreground">{email}</span>. Click it to set a
            new password.
          </p>
          <Button variant="ghost" size="sm" onClick={resetToSignIn}>
            Back to sign in
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={handlePasswordSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-muted-foreground text-sm">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="josh@baltimoresound.net"
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
            placeholder="Operator password"
            className="bg-secondary border-border"
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
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleMagicLink}
            disabled={submitting || !email.trim()}
          >
            <Mail className="w-4 h-4 mr-2" />
            Send magic link instead
          </Button>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Forgot password? Send reset link
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
