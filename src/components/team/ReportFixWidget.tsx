import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MicButton } from "@/components/dictation/MicButton";
import { appendDictation } from "@/hooks/useDictation";
import { Wrench, X, Send, Loader2, CheckCircle2 } from "lucide-react";

// Floating "Report a fix" chatbot (Josh 2026-07-14): raise website fixes from
// ANY /team page. Reports go to Webb (the webmaster teammate) via agent-chat,
// which files them as jobs the orchestrator picks up and executes. Track
// progress in Webb's chat/log on /team/members.
export default function ReportFixWidget() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastReply, setLastReply] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim() || sending) return;
    const message = `[Reported from ${window.location.pathname}] ${text.trim()}`;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { agent_slug: "webb", message },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        let msg = error.message;
        if (ctx) {
          try {
            const body = await ctx.json();
            msg = body.message || body.error || msg;
          } catch {
            /* keep original */
          }
        }
        throw new Error(msg);
      }
      const payload = data as { reply: string; jobs: { title: string }[] };
      setLastReply(payload?.reply || "Filed.");
      setText("");
      if (payload?.jobs?.length) {
        toast({
          title: "Fix filed with Webb",
          description: payload.jobs.map((j) => j.title).join(" · "),
        });
      }
    } catch (e) {
      toast({
        title: "Couldn't reach Webb",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setLastReply(null);
          }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          aria-label="Report a fix"
        >
          <Wrench className="w-4 h-4" /> Report a fix
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[340px] rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛠️</span>
              <div>
                <p className="text-sm font-medium leading-tight">Webb — site fixes</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Describe it; Webb files the job.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-2">
            {lastReply && (
              <div className="rounded-md bg-muted/60 p-2.5 text-xs text-foreground flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="whitespace-pre-wrap">{lastReply}</p>
                  <Link
                    to="/team/members"
                    className="text-primary hover:underline text-[11px] inline-block mt-1"
                    onClick={() => setOpen(false)}
                  >
                    Track in Webb's log →
                  </Link>
                </div>
              </div>
            )}
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="What's broken or what do you want changed? Page + what you expected helps."
                rows={3}
                className="pr-10 text-sm resize-none"
                autoFocus
              />
              <MicButton
                className="absolute top-1 right-1"
                onText={(t) => setText((p) => appendDictation(p, t))}
              />
            </div>
            <Button
              onClick={send}
              disabled={sending || !text.trim()}
              className="w-full gap-1.5"
              size="sm"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Filing…" : "Send to Webb"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
