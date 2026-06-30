import { useState, useEffect, useCallback, useMemo } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Lock,
  Wallet,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Save,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ── Soft PIN gate ──────────────────────────────────────────────────────────
// NOT cryptographic auth — a privacy curtain over the already-magic-link-auth'd
// /team area, so a glance at Josh's logged-in screen doesn't expose finances.
// The expected PIN is stored base64-encoded so the literal value doesn't ship
// as an obvious plaintext string in the bundle. A follow-up can move this to a
// server-verified edge fn if stronger gating is wanted.
const PIN_ENCODED = "Mjk5OA=="; // base64("2998")
const PIN_KEY = "fin_unlocked";

const VENTURES = ["Personal", "BSE", "Harborline", "Economy", "JMJ"] as const;
const ACCOUNT_KINDS = [
  "checking",
  "credit",
  "debit",
  "savings",
  "cash",
  "other",
] as const;

type Venture = (typeof VENTURES)[number];

interface Account {
  id: string;
  name: string;
  kind: string;
  last4: string | null;
  institution: string | null;
  venture: Venture;
  current_balance: number | null;
  balance_as_of: string | null;
  notes: string | null;
  sort_order: number;
}

interface Txn {
  id: string;
  account_id: string | null;
  txn_date: string;
  description: string;
  amount: number;
  category: string | null;
  venture: Venture;
  vendor: string | null;
  notes: string | null;
}

interface Vendor {
  id: string;
  vendor: string;
  category: string | null;
  venture: Venture;
  notes: string | null;
}

function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function num(v: string): number {
  const n = parseFloat(v.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// ── PIN gate screen ─────────────────────────────────────────────────────────
function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (btoa(pin) === PIN_ENCODED) {
      sessionStorage.setItem(PIN_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-xl tracking-wide-custom">Finances</h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Enter your PIN to view this board.
          </p>
          <form onSubmit={submit} className="w-full space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              placeholder="••••"
              className={`text-center text-lg tracking-[0.5em] ${
                error ? "border-destructive" : ""
              }`}
            />
            {error && (
              <p className="text-xs text-destructive">Incorrect PIN.</p>
            )}
            <Button type="submit" className="w-full" disabled={!pin}>
              <ShieldCheck className="mr-1 h-4 w-4" />
              Unlock
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

// A native <select> styled to match inputs — lighter than the popover Select for
// dense editable tables.
function MiniSelect({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 rounded-md border border-input bg-background px-2 text-sm ${className}`}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function TeamFinances() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(PIN_KEY) === "1",
  );

  if (!unlocked) {
    return (
      <TeamLayout>
        <Helmet>
          <title>Finances — Harborline</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="container mx-auto px-4 py-6">
          <PinGate onUnlock={() => setUnlocked(true)} />
        </div>
      </TeamLayout>
    );
  }

  return (
    <TeamLayout>
      <Helmet>
        <title>Finances — Harborline</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <FinancesBoard onLock={() => setUnlocked(false)} />
    </TeamLayout>
  );
}

function FinancesBoard({ onLock }: { onLock: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, t, v] = await Promise.all([
      supabase.from("finance_accounts").select("*").order("sort_order"),
      supabase
        .from("finance_transactions")
        .select("*")
        .order("txn_date", { ascending: false })
        .limit(500),
      supabase.from("finance_vendors").select("*").order("vendor"),
    ]);
    if (a.error || t.error || v.error) {
      toast({
        title: "Load failed",
        description: a.error?.message || t.error?.message || v.error?.message,
        variant: "destructive",
      });
    } else {
      setAccounts((a.data || []) as Account[]);
      setTxns((t.data || []) as Txn[]);
      setVendors((v.data || []) as Vendor[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function lock() {
    sessionStorage.removeItem(PIN_KEY);
    onLock();
  }

  // ── Accounts ──────────────────────────────────────────────────────────────
  async function saveAccount(acc: Account) {
    setSavingId(acc.id);
    const { error } = await supabase
      .from("finance_accounts")
      .update({
        name: acc.name,
        kind: acc.kind,
        last4: acc.last4,
        institution: acc.institution,
        venture: acc.venture,
        current_balance: acc.current_balance,
        balance_as_of: acc.balance_as_of || null,
        notes: acc.notes,
      })
      .eq("id", acc.id);
    setSavingId(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: acc.name });
  }

  async function addAccount() {
    const { data, error } = await supabase
      .from("finance_accounts")
      .insert({ name: `New account ${accounts.length + 1}`, sort_order: (accounts.at(-1)?.sort_order ?? 0) + 10 })
      .select("*")
      .single();
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else setAccounts((p) => [...p, data as Account]);
  }

  async function deleteRow(table: string, id: string, after: () => void) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else after();
  }

  function patchAccount(id: string, patch: Partial<Account>) {
    setAccounts((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  const totalsByVenture = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of accounts) {
      if (a.current_balance != null) m[a.venture] = (m[a.venture] ?? 0) + a.current_balance;
    }
    return m;
  }, [accounts]);

  // ── Transactions ────────────────────────────────────────────────────────────
  async function addTxn() {
    const { data, error } = await supabase
      .from("finance_transactions")
      .insert({ description: "", amount: 0, account_id: accounts[0]?.id ?? null })
      .select("*")
      .single();
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else setTxns((p) => [data as Txn, ...p]);
  }

  async function saveTxn(t: Txn) {
    setSavingId(t.id);
    const { error } = await supabase
      .from("finance_transactions")
      .update({
        account_id: t.account_id,
        txn_date: t.txn_date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        venture: t.venture,
        vendor: t.vendor,
        notes: t.notes,
      })
      .eq("id", t.id);
    setSavingId(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  }

  function patchTxn(id: string, patch: Partial<Txn>) {
    setTxns((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  // ── Vendors ──────────────────────────────────────────────────────────────
  async function addVendor(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from("finance_vendors")
      .insert({ vendor: trimmed })
      .select("*")
      .single();
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else setVendors((p) => [...p, data as Vendor].sort((x, y) => x.vendor.localeCompare(y.vendor)));
  }

  async function saveVendor(v: Vendor) {
    setSavingId(v.id);
    const { error } = await supabase
      .from("finance_vendors")
      .update({ vendor: v.vendor, category: v.category, venture: v.venture, notes: v.notes })
      .eq("id", v.id);
    setSavingId(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: v.vendor });
  }

  function patchVendor(id: string, patch: Partial<Vendor>) {
    setVendors((p) => p.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  // Distinct transaction vendors not yet in the categorization map.
  const uncategorizedVendors = useMemo(() => {
    const known = new Set(vendors.map((v) => v.vendor.toLowerCase()));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of txns) {
      const name = (t.vendor ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }, [txns, vendors]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl tracking-wide-custom">Finances</h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            Operator only
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={lock} title="Lock">
            <Lock className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Venture balance summary */}
      <div className="flex flex-wrap gap-3">
        {VENTURES.map((v) => (
          <Card key={v} className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{v}</p>
            <p className="text-lg font-medium">{money(totalsByVenture[v] ?? null)}</p>
          </Card>
        ))}
      </div>

      {/* Accounts */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide-custom">Accounts</h2>
          <Button variant="outline" size="sm" onClick={addAccount}>
            <Plus className="mr-1 h-4 w-4" /> Add account
          </Button>
        </div>
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Last 4</TableHead>
                <TableHead>Venture</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>As of</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Input value={a.name} onChange={(e) => patchAccount(a.id, { name: e.target.value })} className="h-9 min-w-[140px]" />
                  </TableCell>
                  <TableCell>
                    <MiniSelect value={a.kind} onChange={(v) => patchAccount(a.id, { kind: v })} options={ACCOUNT_KINDS} />
                  </TableCell>
                  <TableCell>
                    <Input value={a.last4 ?? ""} onChange={(e) => patchAccount(a.id, { last4: e.target.value })} className="h-9 w-20" />
                  </TableCell>
                  <TableCell>
                    <MiniSelect value={a.venture} onChange={(v) => patchAccount(a.id, { venture: v as Venture })} options={VENTURES} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      value={a.current_balance ?? ""}
                      onChange={(e) => patchAccount(a.id, { current_balance: e.target.value === "" ? null : num(e.target.value) })}
                      className="h-9 w-28 text-right"
                      inputMode="decimal"
                    />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={a.balance_as_of ?? ""} onChange={(e) => patchAccount(a.id, { balance_as_of: e.target.value })} className="h-9 w-36" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => saveAccount(a)} disabled={savingId === a.id} title="Save">
                        {savingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => deleteRow("finance_accounts", a.id, () => setAccounts((p) => p.filter((x) => x.id !== a.id)))} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    {loading ? "Loading…" : "No accounts yet — add one."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Transactions */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide-custom">
            Transactions{" "}
            <span className="text-sm text-muted-foreground">({txns.length})</span>
          </h2>
          <Button variant="outline" size="sm" onClick={addTxn}>
            <Plus className="mr-1 h-4 w-4" /> Add row
          </Button>
        </div>
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Venture</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Input type="date" value={t.txn_date} onChange={(e) => patchTxn(t.id, { txn_date: e.target.value })} className="h-9 w-36" />
                  </TableCell>
                  <TableCell>
                    <select
                      value={t.account_id ?? ""}
                      onChange={(e) => patchTxn(t.id, { account_id: e.target.value || null })}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[120px]"
                    >
                      <option value="">—</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input value={t.description} onChange={(e) => patchTxn(t.id, { description: e.target.value })} className="h-9 min-w-[160px]" />
                  </TableCell>
                  <TableCell>
                    <Input value={t.vendor ?? ""} onChange={(e) => patchTxn(t.id, { vendor: e.target.value })} className="h-9 min-w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Input value={t.category ?? ""} onChange={(e) => patchTxn(t.id, { category: e.target.value })} className="h-9 min-w-[110px]" />
                  </TableCell>
                  <TableCell>
                    <MiniSelect value={t.venture} onChange={(v) => patchTxn(t.id, { venture: v as Venture })} options={VENTURES} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      value={t.amount}
                      onChange={(e) => patchTxn(t.id, { amount: num(e.target.value) })}
                      className="h-9 w-28 text-right"
                      inputMode="decimal"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => saveTxn(t)} disabled={savingId === t.id} title="Save">
                        {savingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => deleteRow("finance_transactions", t.id, () => setTxns((p) => p.filter((x) => x.id !== t.id)))} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {txns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                    {loading ? "Loading…" : "No transactions yet. Add rows, or JARSH seeds from the ledger."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Vendors / categorization */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide-custom flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" /> Vendor categorization
          </h2>
        </div>

        {uncategorizedVendors.length > 0 && (
          <Card className="mb-3 p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Uncategorized merchants from transactions ({uncategorizedVendors.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {uncategorizedVendors.map((name) => (
                <Button key={name} size="sm" variant="outline" onClick={() => addVendor(name)} className="h-7">
                  <Plus className="mr-1 h-3 w-3" /> {name}
                </Button>
              ))}
            </div>
          </Card>
        )}

        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Venture</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Input value={v.vendor} onChange={(e) => patchVendor(v.id, { vendor: e.target.value })} className="h-9 min-w-[140px]" />
                  </TableCell>
                  <TableCell>
                    <Input value={v.category ?? ""} onChange={(e) => patchVendor(v.id, { category: e.target.value })} className="h-9 min-w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <MiniSelect value={v.venture} onChange={(val) => patchVendor(v.id, { venture: val as Venture })} options={VENTURES} />
                  </TableCell>
                  <TableCell>
                    <Input value={v.notes ?? ""} onChange={(e) => patchVendor(v.id, { notes: e.target.value })} className="h-9 min-w-[140px]" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => saveVendor(v)} disabled={savingId === v.id} title="Save">
                        {savingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => deleteRow("finance_vendors", v.id, () => setVendors((p) => p.filter((x) => x.id !== v.id)))} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {vendors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                    No vendors categorized yet. Add merchants above as you tag transactions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        {accountName(null) /* keep helper referenced */ && null}
        Soft PIN gate over magic-link auth — sensitive personal data, never on a public route.
      </p>
    </div>
  );
}
