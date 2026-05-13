import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Home, Loader2 } from "lucide-react";
import logo from "@/assets/logo-circle.png";

export default function TeamLogin() {
  const { isAuthenticated, isLoading, sendMagicLink } = useTeamAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/team/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await sendMagicLink(email);
    setSubmitting(false);
    if (res.ok) {
      setSent(true);
    } else {
      setError(res.error ?? "Could not send link");
    }
  };

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
        <CardContent>
          {sent ? (
            <div className="space-y-3 text-center text-sm">
              <p className="text-foreground">Check your inbox.</p>
              <p className="text-muted-foreground">
                A sign-in link is on the way to{" "}
                <span className="text-foreground">{email}</span>. Click it from
                this device to finish signing in.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {error && (
                <p className="text-destructive text-sm text-center">{error}</p>
              )}
              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={submitting || !email.trim()}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send magic link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
