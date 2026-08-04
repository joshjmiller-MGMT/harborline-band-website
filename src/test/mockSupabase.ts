import { vi } from "vitest";

// Chainable, thenable PostgREST-builder stand-in for component tests. Any
// filter/modifier call returns the chain; awaiting it (or calling .then, the
// way several components do) resolves to { data, error: null } for the table
// it was opened on. Insert/update/delete resolve the same shape so optimistic
// UI paths don't explode. Writes are recorded on `calls` for assertions.

type Row = Record<string, unknown>;

export type RecordedWrite = { table: string; op: "insert" | "update" | "delete"; payload?: unknown };

export function makeMockDb(tables: Record<string, Row[]>) {
  const calls: RecordedWrite[] = [];

  const makeChain = (table: string, dataOverride?: Row[] | Row | null) => {
    const chain: Record<string, unknown> = {};
    const methods = [
      "select", "eq", "neq", "is", "in", "order", "limit", "range",
      "contains", "overlaps", "ilike", "not", "filter",
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(() => chain);
    chain.insert = vi.fn((payload: unknown) => {
      calls.push({ table, op: "insert", payload });
      return makeChain(table, payload as Row);
    });
    chain.update = vi.fn((payload: unknown) => {
      calls.push({ table, op: "update", payload });
      return makeChain(table, payload as Row);
    });
    chain.delete = vi.fn(() => {
      calls.push({ table, op: "delete" });
      return makeChain(table, null);
    });
    const result = () => ({
      data: dataOverride !== undefined ? dataOverride : (tables[table] ?? []),
      error: null,
      count: (tables[table] ?? []).length,
    });
    chain.then = (
      onFulfilled?: (v: ReturnType<typeof result>) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result()).then(onFulfilled, onRejected);
    return chain;
  };

  return {
    calls,
    client: { from: (table: string) => makeChain(table) },
  };
}
