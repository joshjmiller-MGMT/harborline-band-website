-- BSE CRM workspace sources for the unified calendar.
-- Filtered server-side by SALESPERSON column = Josh (both Monday user IDs:
-- 97563930 = Joshua Joseph Miller, 54492562 = Josh Miller).
-- Each item appears on its "Next Action Date" with the "Next Action Step"
-- status as the visual label.
INSERT INTO monday_calendar_sources
  (board_id, date_column_id, label, color, enabled, person_column_id, person_id, fallback_date_column_ids, skip_groups)
VALUES
  ('8455743458', 'date_mkx6g1j4', 'CRM Leads', '#3b82f6', true, 'lead_owner', '97563930,54492562', '', ''),
  ('8455743669', 'date_mm0f7za0', 'CRM Events', '#8b5cf6', true, 'project_owner', '97563930,54492562', '', 'completed,archive');
