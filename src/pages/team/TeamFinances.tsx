import { useEffect, useState, useCallback } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Lock,
  Loader2,
  Wallet,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Personal finances board (Josh 2026-06-30). PIN-gated SOFT privacy screen over
// the already-magic-link-auth'd /team area — so a glance at a logged-in screen
// doesn't expose finances. Not cryptographic auth (the data is also operator-RLS
// protected server-side). Reads the finance_* tables; the statement-ingestion
// pipeline populates finance_transactions over time.
const FIN_PIN = "2998";
const UNLOCK_KEY = "fin_unlocked";

const VENTURES = ["Personal", "Professional-Music", "Economy", "BSE"];

type Account = {
  id: string;
  name: string;
  kind: string | null;
  last4: string | null;
  venture_default: string | null;
  notes: string | null;
};
type Txn = {
  id: string;
  txn_date: string | null;
  description: string | null;
  amount: number | null;
  category: string | null;
  venture: string | null;
  account_id: string | null;
};
type Vendor = {
  id: string;
  raw_name: string | null;
  normalized_name: string | null;
  category: string | null;
  venture: string | null;
  status: string | null;
  recurring: boolean | null;
};

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function TeamFinances() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(UNLOCK_KEY) === "1",
  );
  const [pin, setPin] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, t, v] = await Promise.all([
      supabase.from("finance_accounts").select("id,name,kind,last4,venture_default,notes").order("name"),
      supabase
        .from("finance_transactions")
        .select("id,txn_date,description,amount,category,venture,account_id")
        .order("txn_date", { ascending: false })
        .limit(100),
      supabase
        .from("finance_vendors")
        .select("id,raw_name,normalized_name,category,venture,status,recurring")
        .order("status")
        .limit(200),
    ]);
    if (a.data) setAccounts(a.data as Account[]);
    if (t.data) setTxns(t.data as Txn[]);
    if (v.data) setVendors(v.data as Vendor[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (unlocked) load();
  }, [unlocked, load]);

  function tryUnlock() {
    if (pin === FIN_PIN) {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setUnlocked(true);
    } else {
      toast({ title: "Wrong PIN", variant: "destructive" });
      setPin("");
    }
  }

  async function setVendorField(id: string, field: "category" | "venture", value: string) {
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value, status: "identified" } : v)),
    );
    const { error } = await supabase
      .from("finance_vendors")
      .update({ [field]: value, status: "identified" })
      .eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  }

  // ---- PIN gate ----
  if (!unlocked) {
    return (
      <TeamLayout>
        <Helmet>
          <title>Finances · Team</title>
        </Helmet>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <Card className="w-full max-w-sm p-8 text-center">
            <Lock className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <h1 className="mb-1 text-xl font-display tracking-wide-custom">Finances</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              Enter your PIN to view this page.
            </p>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
              placeholder="••••"
              className="mb-3 text-center text-lg tracking-[0.5em]"
            />
            <Button onClick={tryUnlock} className="w-full">
              Unlock
            </Button>
          </Card>
        </div>
      </TeamLayout>
    );
  }

  // ---- Board ----
  const totalIn = txns.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalOut = txns.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + (t.amount ?? 0), 0);
  const acctName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <TeamLayout>
      <Helmet>
        <title>Finances · Team</title>
      </Helmet>
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-display tracking-wide-custom">Finances</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem(UNLOCK_KEY);
                setUnlocked(false);
              }}
            >
              <Lock className="mr-1 h-4 w-4" /> Lock
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Accounts</div>
            <div className="mt-1 text-2xl font-semibold">{accounts.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Transactions</div>
            <div className="mt-1 text-2xl font-semibold">{txns.length}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> In (recent)
            </div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">{money(totalIn)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="h-3 w-3" /> Out (recent)
            </div>
            <div className="mt-1 text-2xl font-semibold text-red-600">{money(totalOut)}</div>
          </Card>
        </div>

        {/* Accounts */}
        <h2 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Accounts</h2>
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{a.name}</div>
                {a.last4 && <Badge variant="outline">••{a.last4}</Badge>}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {a.kind} · {a.venture_default}
              </div>
              {a.notes && <p className="mt-2 text-xs text-muted-foreground">{a.notes}</p>}
            </Card>
          ))}
        </div>

        {/* Transactions */}
        <h2 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" /> Transactions {txns.length > 0 && `(latest ${txns.length})`}
        </h2>
        {txns.length === 0 ? (
          <Card className="mb-6 p-6 text-center text-sm text-muted-foreground">
            No transactions ingested yet. The statement-ingestion pipeline parses your
            uploaded PDFs (Checking 6669 back to 2019 + CC 5994 + Debit 5704) into this
            ledger — they'll appear here as it runs.
          </Card>
        ) : (
          <Card className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Description</th>
                  <th className="p-2">Account</th>
                  <th className="p-2">Category</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-border/20">
                    <td className="whitespace-nowrap p-2 text-muted-foreground">{t.txn_date}</td>
                    <td className="p-2">{t.description}</td>
                    <td className="whitespace-nowrap p-2 text-muted-foreground">{acctName(t.account_id)}</td>
                    <td className="p-2 text-muted-foreground">{t.category}</td>
                    <td
                      className={`whitespace-nowrap p-2 text-right font-medium ${
                        (t.amount ?? 0) < 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {money(t.amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Vendors — categorization surface */}
        <h2 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Merchants {vendors.length > 0 && `(${vendors.length})`}
        </h2>
        {vendors.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Merchants will populate from the statements; assign each a category + venture here.
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2">Merchant</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Venture</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b border-border/20">
                    <td className="p-2">
                      {v.raw_name}
                      {v.recurring && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          recurring
                        </Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <Input
                        defaultValue={v.category ?? ""}
                        onBlur={(e) =>
                          e.target.value !== (v.category ?? "") &&
                          setVendorField(v.id, "category", e.target.value)
                        }
                        placeholder="category"
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={v.venture ?? ""}
                        onChange={(e) => setVendorField(v.id, "venture", e.target.value)}
                        className="h-8 rounded-md border border-border/50 bg-background px-2 text-sm"
                      >
                        <option value="">—</option>
                        {VENTURES.map((vn) => (
                          <option key={vn} value={vn}>
                            {vn}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Badge variant={v.status === "identified" ? "default" : "outline"}>
                        {v.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </TeamLayout>
  );
}
