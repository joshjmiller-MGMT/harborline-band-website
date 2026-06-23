import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import TeamLayout from "@/components/TeamLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, UserPlus, KeyRound, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

type TeamUser = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  invited_at: string | null;
  email_confirmed_at: string | null;
};

async function parseEdgeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context;
  if (ctx) {
    try {
      const body = await ctx.json();
      return body.detail || body.error || "Unknown error";
    } catch {
      // fall through
    }
  }
  return (error as Error).message ?? "Unknown error";
}

export default function TeamAdminUsers({ embedded = false }: { embedded?: boolean } = {}) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase.functions.invoke<{
      users?: TeamUser[];
    }>("team-users", { body: { op: "list" } });
    if (error) {
      setLoadError(await parseEdgeError(error));
      setLoading(false);
      return;
    }
    setUsers(data?.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    const { error } = await supabase.functions.invoke("team-users", {
      body: {
        op: "invite",
        email: inviteEmail.trim(),
        display_name: inviteName.trim(),
      },
    });
    setInviting(false);
    if (error) {
      toast.error(`Invite failed: ${await parseEdgeError(error)}`);
      return;
    }
    toast.success(`Invite sent to ${inviteEmail.trim()}`);
    setInviteEmail("");
    setInviteName("");
    loadUsers();
  };

  const handleReset = async (email: string) => {
    const { error } = await supabase.functions.invoke("team-users", {
      body: { op: "reset_password", email },
    });
    if (error) {
      toast.error(`Reset failed: ${await parseEdgeError(error)}`);
      return;
    }
    toast.success(`Password-reset email sent to ${email}`);
  };

  const handleDelete = async (user: TeamUser) => {
    const { error } = await supabase.functions.invoke("team-users", {
      body: { op: "delete", id: user.id },
    });
    if (error) {
      toast.error(`Delete failed: ${await parseEdgeError(error)}`);
      return;
    }
    toast.success(`Removed ${user.email}`);
    loadUsers();
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : "—";

  const statusFor = (u: TeamUser) => {
    if (!u.email_confirmed_at) return "Invited";
    if (!u.last_sign_in_at) return "Confirmed";
    return "Active";
  };

  const content = (
    <div className="container mx-auto px-6 py-8 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl tracking-wide-custom">
            Team Members
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite a team member
            </CardTitle>
            <CardDescription>
              They'll get a one-click "Welcome to the team" email with a link to
              set their own password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="invite-email" className="text-xs">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="newperson@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-name" className="text-xs">
                    Display name (optional)
                  </Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="First Last"
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="hero"
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Send invite
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current members</CardTitle>
            <CardDescription>
              {loading
                ? "Loading…"
                : `${users.length} member${users.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : loadError ? (
              <p className="text-destructive text-sm">{loadError}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        {u.email}
                      </TableCell>
                      <TableCell>{u.display_name || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {statusFor(u)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(u.last_sign_in_at)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReset(u.email)}
                          title="Send password-reset email"
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              title="Remove user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove {u.email}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                They'll lose access to the team portal
                                immediately. This cannot be undone from the UI.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(u)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-6"
                      >
                        No members yet. Send your first invite above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );

  if (embedded) return content;
  return <TeamLayout>{content}</TeamLayout>;
}
