const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both legacy { sheetId } and new { url } params
    const url: string | undefined = body.url;
    const sheetId: string | undefined = body.sheetId;
    
    if (!url && !sheetId) {
      return new Response(JSON.stringify({ error: 'Missing url or sheetId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine source type from URL
    const sourceUrl = url || '';
    const isGoogleSheet = sheetId || sourceUrl.includes('docs.google.com/spreadsheets');
    const isGoogleDoc = sourceUrl.includes('docs.google.com/document');

    if (isGoogleSheet) {
      return await handleGoogleSheet(sheetId || extractId(sourceUrl, 'spreadsheets'), corsHeaders);
    } else if (isGoogleDoc) {
      return await handleGoogleDoc(extractId(sourceUrl, 'document'), corsHeaders);
    } else {
      return await handleGenericUrl(sourceUrl, corsHeaders);
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractId(url: string, type: string): string {
  const match = url.match(new RegExp(`/${type}/d/([a-zA-Z0-9-_]+)`));
  return match ? match[1] : '';
}

// ─── Google Sheet Handler ───────────────────────────────────────────────

async function handleGoogleSheet(sheetId: string, corsHeaders: Record<string, string>) {
  if (!sheetId) {
    return new Response(JSON.stringify({ error: 'Could not extract sheet ID from URL' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const response = await fetch(csvUrl);

  if (!response.ok) {
    return new Response(JSON.stringify({ 
      error: 'Could not fetch sheet. Make sure it is set to "Anyone with the link can view".' 
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const csvText = await response.text();
  
  let sheetTitle = "Untitled Sheet";
  try {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    const htmlResp = await fetch(htmlUrl, { redirect: 'follow' });
    const html = await htmlResp.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      sheetTitle = titleMatch[1].replace(' - Google Sheets', '').trim();
    }
  } catch { /* ignore */ }

  const lines = parseCSV(csvText);
  if (lines.length === 0) {
    return new Response(JSON.stringify({ error: 'Sheet appears to be empty' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    headers: lines[0], 
    rows: lines.slice(1), 
    sheetTitle,
    sourceType: 'google-sheet',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Google Doc Handler ─────────────────────────────────────────────────

async function handleGoogleDoc(docId: string, corsHeaders: Record<string, string>) {
  if (!docId) {
    return new Response(JSON.stringify({ error: 'Could not extract document ID from URL' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Export as plain text
  const textUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const textResp = await fetch(textUrl);
  
  if (!textResp.ok) {
    return new Response(JSON.stringify({ 
      error: 'Could not fetch document. Make sure it is set to "Anyone with the link can view".' 
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const text = await textResp.text();

  // Get title
  let docTitle = "Untitled Document";
  try {
    const htmlUrl = `https://docs.google.com/document/d/${docId}/edit`;
    const htmlResp = await fetch(htmlUrl, { redirect: 'follow' });
    const html = await htmlResp.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      docTitle = titleMatch[1].replace(' - Google Docs', '').trim();
    }
  } catch { /* ignore */ }

  // Convert text to a simple grid (each line = a row with one cell)
  const lines = text.split('\n').filter((l: string) => l.trim() !== '');
  
  // Try to parse structured data from the doc text
  const parsedRows = parseDocText(lines);

  return new Response(JSON.stringify({
    headers: parsedRows.headers,
    rows: parsedRows.rows,
    sheetTitle: docTitle,
    sourceType: 'google-doc',
    rawText: text,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseDocText(lines: string[]): { headers: string[]; rows: string[][] } {
  // Convert doc lines into a grid-like structure
  // Each line becomes a row. Try to split by tabs first, then by colons for label:value
  const rows: string[][] = [];
  
  for (const line of lines) {
    if (line.includes('\t')) {
      rows.push(line.split('\t'));
    } else {
      rows.push([line]);
    }
  }

  return { headers: rows[0] || ['Content'], rows: rows.slice(1) };
}

// ─── Generic URL Handler ────────────────────────────────────────────────

async function handleGenericUrl(url: string, corsHeaders: Record<string, string>) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HarborlineBot/1.0)',
        'Accept': 'text/html,text/plain,text/csv,*/*',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: `Could not fetch URL (status ${response.status}). Make sure the page is publicly accessible.` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Get page title
    let pageTitle = "Imported Page";
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      pageTitle = titleMatch[1].trim();
    }

    // If CSV content type, parse as CSV
    if (contentType.includes('csv') || url.endsWith('.csv')) {
      const lines = parseCSV(text);
      return new Response(JSON.stringify({
        headers: lines[0] || [],
        rows: lines.slice(1),
        sheetTitle: pageTitle,
        sourceType: 'csv',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For HTML pages, extract text content
    const cleanText = extractTextFromHTML(text);
    const lines = cleanText.split('\n').filter((l: string) => l.trim() !== '');
    
    return new Response(JSON.stringify({
      headers: lines[0] ? [lines[0]] : ['Content'],
      rows: lines.slice(1).map((l: string) => [l]),
      sheetTitle: pageTitle,
      sourceType: 'webpage',
      rawText: cleanText,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: `Failed to fetch URL: ${err.message}` 
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Replace common block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n');
  text = text.replace(/<(br|hr)[^>]*\/?>/gi, '\n');
  text = text.replace(/<td[^>]*>/gi, '\t');
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// ─── CSV Parser ─────────────────────────────────────────────────────────

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
