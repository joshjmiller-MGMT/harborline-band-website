import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sheetId } = await req.json();
    
    if (!sheetId || typeof sheetId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid sheetId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch as CSV from Google Sheets public export
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(csvUrl);

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: 'Could not fetch sheet. Make sure it is set to "Anyone with the link can view".' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const csvText = await response.text();
    
    // Also try to get the sheet title from the HTML page
    let sheetTitle = "Untitled Sheet";
    try {
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      const htmlResp = await fetch(htmlUrl, { redirect: 'follow' });
      const html = await htmlResp.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        sheetTitle = titleMatch[1].replace(' - Google Sheets', '').trim();
      }
    } catch {
      // ignore title fetch errors
    }

    // Parse CSV
    const lines = parseCSV(csvText);
    if (lines.length === 0) {
      return new Response(JSON.stringify({ error: 'Sheet appears to be empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = lines[0];
    const rows = lines.slice(1);

    return new Response(JSON.stringify({ headers, rows, sheetTitle }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current);
        current = '';
        rows.push(row);
        row = [];
        if (char === '\r') i++;
      } else {
        current += char;
      }
    }
  }

  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}
