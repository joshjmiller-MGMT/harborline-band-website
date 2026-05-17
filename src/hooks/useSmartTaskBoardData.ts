import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TrelloLabelLite = { name: string; color: string | null };
export type TrelloChecklistOpen = { name: string; items: string[] };
export type TrelloCommentLite = { text: string; date: string };
export type TrelloCustomFieldLite = { name: string; value: string };

export type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  url: string;
  list_id: string;
  list_name?: string | null;
  labels?: TrelloLabelLite[];
  checklists_open?: TrelloChecklistOpen[];
  recent_comments?: TrelloCommentLite[];
  custom_fields?: TrelloCustomFieldLite[];
  date_last_activity?: string;
  age_days?: number;
};

type TrelloPoll = {
  board?: { id: string; name: string };
  cards?: TrelloCard[];
  total_open?: number;
  pending_count?: number;
  error?: string;
  message?: string;
};

export type SmartTaskRow = {
  id: string;
  raw_input: string;
  revised_title: string | null;
  definition_of_done: string | null;
  measure: string | null;
  blockers: string | null;
  effort: string | null;
  due_date: string | null;
  trello_card_id: string | null;
  trello_card_url: string | null;
  google_calendar_event_id: string | null;
  google_calendar_html_link: string | null;
  board_bucket: string | null;
  board_venture: string | null;
  created_at: string;
};

export type SmartTaskBoardData = {
  trello: {
    cards: TrelloCard[];
    boardName: string | null;
    loading: boolean;
    error: string | null;
  };
  smartRows: SmartTaskRow[];
  smartRowsLoading: boolean;
  smartRowsError: string | null;
  refreshTrello: () => Promise<void>;
  refreshSmartRows: () => Promise<void>;
  refreshAll: () => Promise<void>;
};

/**
 * Single data layer for the SMART task board (P312) and the dashboard
 * SmartTaskWidget (compact view). Both consume the same fetch — so when a
 * card is SMART-ified via the widget, it shows up on the board on the next
 * refresh, no drift.
 */
export function useSmartTaskBoardData(): SmartTaskBoardData {
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [trelloLoading, setTrelloLoading] = useState(false);
  const [trelloError, setTrelloError] = useState<string | null>(null);

  const [smartRows, setSmartRows] = useState<SmartTaskRow[]>([]);
  const [smartRowsLoading, setSmartRowsLoading] = useState(false);
  const [smartRowsError, setSmartRowsError] = useState<string | null>(null);

  const refreshTrello = useCallback(async () => {
    setTrelloLoading(true);
    setTrelloError(null);
    try {
      const { data, error } = await supabase.functions.invoke("trello-poll", {
        body: { action: "poll" },
      });
      if (error) throw error;
      const result = (data ?? {}) as TrelloPoll;
      if (result.error) {
        setTrelloError(result.message || result.error);
        setCards([]);
        setBoardName(null);
        return;
      }
      setCards(result.cards || []);
      setBoardName(result.board?.name || null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTrelloError(msg);
      setCards([]);
    } finally {
      setTrelloLoading(false);
    }
  }, []);

  const refreshSmartRows = useCallback(async () => {
    setSmartRowsLoading(true);
    setSmartRowsError(null);
    try {
      const { data, error } = await supabase
        .from("smart_task_enrichments")
        .select(
          "id, raw_input, revised_title, definition_of_done, measure, blockers, effort, due_date, trello_card_id, trello_card_url, google_calendar_event_id, google_calendar_html_link, board_bucket, board_venture, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSmartRows((data || []) as SmartTaskRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSmartRowsError(msg);
      setSmartRows([]);
    } finally {
      setSmartRowsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshTrello(), refreshSmartRows()]);
  }, [refreshTrello, refreshSmartRows]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  return {
    trello: {
      cards,
      boardName,
      loading: trelloLoading,
      error: trelloError,
    },
    smartRows,
    smartRowsLoading,
    smartRowsError,
    refreshTrello,
    refreshSmartRows,
    refreshAll,
  };
}
