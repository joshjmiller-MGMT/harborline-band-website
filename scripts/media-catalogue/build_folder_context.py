#!/usr/bin/env python3
"""DAM folder-context generator.

Josh's methodology: *every folder carries a complete-context file* — what it is,
what's in it, and the next actions — exactly how the brain uses index.md per
domain. This reads the per-file catalogue (media_assets), rolls it up per folder,
classifies each folder (event / session / reference / knowledge / mixed), writes
a canonical record to media_folders, and mirrors a human-browsable
`_FOLDER-CONTEXT.md` sidecar into the folder (write-through, like brain↔auto-memory).

Regeneration preserves a human-notes block in the sidecar so Josh's edits survive.

Usage:
    python build_folder_context.py                 # DB rollup only (safe)
    python build_folder_context.py --write-sidecars [min_files]   # + write sidecars (default min 3)
"""
import os, sys, re, json, urllib.request, datetime
from collections import Counter, defaultdict

PROJECT_REF = "mbqyznttpvebahgygsbx"
MGMT_SQL_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

PRO_VENTURES = {"Harborline", "Economy", "JMJ", "BSE", "Brand Studio"}
REFERENCE_WORDS = {"asset","assets","logo","logos","brand","branding","epk","press",
                   "graphics","design","designs","headshot","headshots","artwork","template","templates"}
DATE_IN_NAME = re.compile(r"(20\d{2})[-_. ]?(\d{2})[-_. ]?(\d{2})")
# Josh's rule (2026-07-07): EVENT folders START with a date and are followed by
# something gig-like (venue/occasion). Date-prefixed folders that aren't gig-like
# (e.g. a song name — "Peg", "Incandescence") are SHOOTs (content/shoot folders).
DATE_PREFIX = re.compile(r"^\s*(20\d{2})[-_. ]?(\d{2})[-_. ]?(\d{2})")
GIG_WORDS = {"wedding","club","bar","pub","gala","corporate","party","fest","festival",
             "hall","ballroom","golf","brewery","winery","lounge","hotel","inn","church",
             "bash","birthday","anniversary","mitzvah","ceremony","reception","event",
             "gig","show","concert","private","country club","overlook","manor","mansion",
             "farm","estate","yacht","pier","tavern","grill","cafe","restaurant"}

def source_of(path):
    p = path.replace("\\", "/")
    # Physical drives (Josh 7/21: "should list and look as the cloud drives") —
    # each physical://<LABEL> becomes its own top-level source, like the gdrives.
    pm = re.match(r"^physical://([^/]+)", p)
    if pm: return f"{pm.group(1)} (physical drive)"
    if p.startswith("C:/Users/joshj/Dropbox"): return "Dropbox"
    m = re.match(r"^([A-Z]):/", p)
    if m and m.group(1) in "GHIJ": return f"Google Drive ({m.group(1)}:)"
    if m and m.group(1) == "C": return "Local (C:)"
    return "Other"

def load_token():
    with open(os.path.expanduser("~/.config/harborline/supabase.env"), encoding="utf-8") as f:
        for line in f:
            if line.strip().startswith("SUPABASE_ACCESS_TOKEN"):
                return line.split("=",1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_ACCESS_TOKEN not found")

def run_sql(token, query):
    req = urllib.request.Request(
        MGMT_SQL_URL, data=json.dumps({"query": query}).encode(), method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type":"application/json", "User-Agent":"curl/8"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def sql_str(v):
    if v is None: return "null"
    if isinstance(v,(int,float)): return str(v)
    if isinstance(v,list):
        inner = ",".join('"' + str(x).replace('"','\\"') + '"' for x in v)
        return "'{" + inner + "}'"
    return "'" + str(v).replace("'","''") + "'"

def classify(name, counts, audio, image, video, has_date, screenshot_ratio):
    nl = name.lower()
    tokens = set(re.split(r"[^a-z0-9]+", nl))
    if tokens & REFERENCE_WORDS:
        return "reference"
    if audio > (image + video):
        return "session"
    # date-PREFIXED folders split: gig-like → event, otherwise → shoot (song
    # names etc). Josh will call out misfiles; non-date folders are never
    # event/shoot — they stay untagged (other/mixed) rather than mislabeled.
    if DATE_PREFIX.match(name):
        rest = DATE_PREFIX.sub("", name).lower()
        if any(w in rest for w in GIG_WORDS):
            return "event"
        return "shoot"
    if image and screenshot_ratio >= 0.6:
        return "knowledge"
    if sum(1 for x in (image, video, audio) if x) > 1:
        return "mixed"
    return "other"

def summarize(cls, name, top_venture, dmin, dmax, img, vid, aud):
    span = dmin if dmin == dmax else f"{dmin} → {dmax}"
    if cls == "event":
        return f"Event media from **{name}** ({span}), {top_venture}. {vid} video / {img} photo. Candidate for the professional pipeline (tag → port → edit → schedule)."
    if cls == "shoot":
        return f"Content/shoot folder — **{name}** ({span}), {top_venture}. {vid} video / {img} photo. Dated shoot (song/content), not a gig."
    if cls == "session":
        return f"Audio session/rehearsal takes — **{name}** ({span}), {top_venture}. {aud} recordings."
    if cls == "reference":
        return f"Reference/produced assets — **{name}**, {top_venture}. Available for EPK / site / socials as-is."
    if cls == "knowledge":
        return f"Knowledge-capture (screenshots / photos-to-remember) — **{name}** ({span}). Extract to the brain; not content."
    return f"Mixed media — **{name}** ({span}), {top_venture}."

def next_actions(cls, sphere, top_venture):
    if cls == "shoot":
        return "→ content shoot: review takes → pick selects → edit → schedule/post."
    if cls == "event" and sphere == "professional":
        return f"→ tag as event → port to `Dropbox/Professional/{top_venture}/new/` → assign editor → schedule."
    if cls == "event":
        return "→ personal event; group + archive; pull highlights if postable."
    if cls == "session":
        return "→ index takes; surface best for release/socials."
    if cls == "reference":
        return "→ ready to use in EPK / website / socials."
    if cls == "knowledge":
        return "→ extract the captured info into the brain; then archive the image."
    return "→ triage in /team/media."

NOTES_START = "<!-- notes:human -->"
NOTES_END = "<!-- /notes:human -->"

def preserve_notes(path):
    try:
        with open(path, encoding="utf-8") as f:
            txt = f.read()
        i = txt.find(NOTES_START); j = txt.find(NOTES_END)
        if i != -1 and j != -1 and j > i:
            return txt[i+len(NOTES_START):j].strip()
    except OSError:
        pass
    return None

def build_context_md(f, today):
    body = []
    body.append(f"# 📁 {f['name']}\n")
    body.append(f"**Class:** {f['folder_class']} · **Sphere:** {f['sphere']} · **Venture:** {f['top_venture']}  ")
    body.append(f"**Path:** `{f['folder_path']}`  ")
    body.append(f"**Media:** {f['file_count']} files ({f['image_count']} img · {f['video_count']} vid · {f['audio_count']} aud) · {human(f['total_bytes'])}  ")
    dspan = f['date_min'] if f['date_min']==f['date_max'] else f"{f['date_min']} → {f['date_max']}"
    if f['folder_class'] == 'event' and f.get('event_date'):
        body.append(f"**Event date:** {f['event_date']} · **file dates:** {dspan} *(mtime; EXIF capture dates land in slice 2)*  ")
    else:
        body.append(f"**File dates:** {dspan} *(mtime; EXIF capture dates land in slice 2)*  ")
    if f['ventures']:
        body.append(f"**Ventures present:** {', '.join(f['ventures'])}\n")
    body.append(f"\n## What this is\n{f['_summary']}\n")
    if f['_samples']:
        body.append("## Sample contents")
        for s in f['_samples']:
            body.append(f"- {s}")
        body.append("")
    body.append(f"## Disposition / next actions\n{f['_next']}\n")
    body.append("---\n")
    notes = f.get('_notes') or "(Your notes here — preserved across regeneration.)"
    body.append(f"{NOTES_START}\n{notes}\n{NOTES_END}\n")
    body.append(f"*Generated {today} by the DAM folder-context generator. Canonical record: `media_folders`. Mirror of /team/media.*")
    return "\n".join(body)

def human(n):
    n = n or 0; u=["B","KB","MB","GB","TB"]; i=0
    while n>=1024 and i<len(u)-1: n/=1024; i+=1
    return f"{n:.1f} {u[i]}" if i>0 else f"{n} B"

FOLDER_COLS = ["folder_path","name","source_root","file_count","image_count","video_count",
    "audio_count","total_bytes","date_min","date_max","top_venture","ventures",
    "folder_class","sphere","event_name","event_date","context_md","sidecar_path"]

def upsert_folders(token, rows):
    if not rows: return
    vals = []
    for r in rows:
        vals.append("(" + ",".join(sql_str(r[c]) for c in FOLDER_COLS) + ")")
    q = (f"insert into public.media_folders ({','.join(FOLDER_COLS)}) values " + ",".join(vals)
         + " on conflict (folder_path) do update set "
         + ",".join(f"{c}=excluded.{c}" for c in FOLDER_COLS if c!="folder_path")
         + ", updated_at=now();")
    run_sql(token, q)

def main():
    write_sidecars = "--write-sidecars" in sys.argv
    min_files = 3
    for a in sys.argv[1:]:
        if a.isdigit(): min_files = int(a)
    token = load_token()
    today = datetime.date.today().isoformat()

    print("Loading catalogue…", flush=True)
    rows = run_sql(token, "select full_path, filename, ext, media_type, venture, captured_on, size_bytes from media_assets")
    print(f"  {len(rows)} assets", flush=True)

    folders = defaultdict(list)
    for r in rows:
        folders[os.path.dirname(r["full_path"])].append(r)

    out, sidecar_written = [], 0
    for fpath, items in folders.items():
        name = os.path.basename(fpath) or fpath
        img = sum(1 for i in items if i["media_type"]=="image")
        vid = sum(1 for i in items if i["media_type"]=="video")
        aud = sum(1 for i in items if i["media_type"]=="audio")
        total = sum(i["size_bytes"] or 0 for i in items)
        dates = [i["captured_on"] for i in items if i["captured_on"]]
        dmin, dmax = (min(dates), max(dates)) if dates else (None, None)
        vcount = Counter(i["venture"] or "Unknown" for i in items)
        top_venture = vcount.most_common(1)[0][0]
        ventures = [v for v,_ in vcount.most_common()]
        has_date = bool(DATE_IN_NAME.search(name))
        pngs = sum(1 for i in items if (i["ext"] or "")=="png")
        screenshot_ratio = pngs/len(items) if items else 0
        cls = classify(name, len(items), aud, img, vid, has_date, screenshot_ratio)
        sphere = "professional" if top_venture in PRO_VENTURES else ("personal" if top_venture=="Personal" else "unknown")
        event_name = name if cls in ("event","shoot") else None
        event_date = None
        if cls in ("event","shoot"):
            m = DATE_PREFIX.match(name)
            event_date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else dmin
        samples = sorted(i["filename"] for i in items)[:8]

        f = {
            "folder_path": fpath, "name": name, "source_root": source_of(fpath),
            "file_count": len(items), "image_count": img, "video_count": vid, "audio_count": aud,
            "total_bytes": total, "date_min": dmin, "date_max": dmax,
            "top_venture": top_venture, "ventures": ventures,
            "folder_class": cls, "sphere": sphere, "event_name": event_name, "event_date": event_date,
            "_summary": summarize(cls, name, top_venture, dmin, dmax, img, vid, aud),
            "_next": next_actions(cls, sphere, top_venture),
            "_samples": samples,
        }
        sidecar_path = None
        if write_sidecars and len(items) >= min_files:
            sp = os.path.join(fpath, "_FOLDER-CONTEXT.md")
            f["_notes"] = preserve_notes(sp)
            try:
                with open(sp, "w", encoding="utf-8") as fh:
                    fh.write(build_context_md(f, today))
                sidecar_path = sp.replace("\\","/"); sidecar_written += 1
            except OSError as e:
                print(f"  sidecar fail {sp}: {e}", flush=True)
        f["context_md"] = build_context_md(f, today)
        f["sidecar_path"] = sidecar_path
        out.append(f)

    # batch upsert
    for i in range(0, len(out), 100):
        upsert_folders(token, out[i:i+100])
    cls_dist = Counter(f["folder_class"] for f in out)
    print(f"DONE folders={len(out)} sidecars_written={sidecar_written}")
    print("class distribution:", dict(cls_dist))

if __name__ == "__main__":
    main()
