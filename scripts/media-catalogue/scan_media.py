#!/usr/bin/env python3
"""Digital Asset Manager — slice-1 catalogue scanner.

Walks the JARSH-reachable media roots and upserts one row per media file into
public.media_assets. STAT ONLY — never opens/reads file bytes, so cataloguing
gdrive-mounted media does not download it. EXIF / thumbnails / AI tagging are
slice 2 (on-demand per asset), not here.

Writes via the Supabase Management API SQL endpoint (Bearer SUPABASE_ACCESS_TOKEN
from ~/.config/harborline/supabase.env) in batched upserts — keeps large ingests
out of the conversation. Idempotent: re-running updates changed rows by full_path.

Usage:
    python scan_media.py small          # fast Dropbox + small gdrive roots
    python scan_media.py all            # everything incl. the big gdrive roots
    python scan_media.py "<abs path>" [venture]   # ad-hoc single root
"""
import os, sys, re, json, urllib.request, datetime

PROJECT_REF = "mbqyznttpvebahgygsbx"
MGMT_SQL_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

# ── roots (path, venture-default, location_kind) ───────────────────────────
SMALL_ROOTS = [
    ("/c/Users/joshj/Dropbox/photos/gigs", None,         "dropbox"),
    ("/i/My Drive/Pictures",               "Economy",    "gdrive-mydrive"),
    ("/i/My Drive/Band Assets",            "Economy",    "gdrive-mydrive"),
    ("/h/My Drive/Harborline",             "Harborline", "gdrive-mydrive"),
]
BIG_ROOTS = [
    ("/j/My Drive/Media",                  "Economy",    "gdrive-mydrive"),
    ("/j/My Drive/z Adam’s Archive",  "Economy",    "gdrive-mydrive"),
    ("/g/Shared drives/Josh Miller's Total Raw Content", "Harborline", "gdrive-shared"),
]

IMAGE = {"jpg","jpeg","png","heic","heif","tif","tiff","gif","webp","bmp",
         "raw","arw","cr2","cr3","nef","dng","orf","rw2","raf"}
VIDEO = {"mov","mp4","m4v","avi","mkv","webm","hevc","mts","m2ts","3gp",
         "mpg","mpeg","wmv","flv","insv"}
AUDIO = {"m4a","mp3","wav","aif","aiff","flac","aac","ogg","wma"}
MEDIA_EXTS = IMAGE | VIDEO | AUDIO
VENTURE_WORDS = {
    "harborline":"Harborline", "harbor line":"Harborline",
    "economy":"Economy", "econ":"Economy",
    "jmj":"JMJ", "josh miller jazz":"JMJ",
    "bse":"BSE", "baltimore sound":"BSE",
    "tsb":"BSE",
}
DATE_RES = [
    re.compile(r"(20\d{2})[-_.](\d{2})[-_.](\d{2})"),
    re.compile(r"(20\d{2})(\d{2})(\d{2})"),
]

def to_win(path):
    # Git-Bash mount (/c/Users, /i/My Drive) → Windows path (C:/Users, I:/My Drive).
    # Python's os.* needs the Windows form on win32; forward slashes are fine.
    m = re.match(r"^/([a-zA-Z])(/.*)?$", path)
    if m:
        return f"{m.group(1).upper()}:{m.group(2) or '/'}"
    return path

def media_type(ext):
    if ext in IMAGE: return "image"
    if ext in VIDEO: return "video"
    if ext in AUDIO: return "audio"
    return "other"

def infer_venture(default, path_lower, name_lower):
    for k,v in VENTURE_WORDS.items():
        if k in path_lower or k in name_lower:
            return v
    return default or "Unknown"

def infer_date(name, mtime):
    for rgx in DATE_RES:
        m = rgx.search(name)
        if m:
            y,mo,d = m.group(1), m.group(2), m.group(3)
            try:
                return datetime.date(int(y),int(mo),int(d)).isoformat()
            except ValueError:
                pass
    return datetime.date.fromtimestamp(mtime).isoformat()

def infer_desc(stem):
    # Josh's convention: "YYYY-MM-DD <venue/desc> - IMG_1234". Strip a leading
    # date and a trailing " - IMGxxxx"/camera id; keep the human part.
    s = stem
    for rgx in DATE_RES:
        s = rgx.sub("", s, count=1)
    s = re.sub(r"[-_ ]+(IMG|DSC|MVI|VID|MOV|DJI|GX|GOPR|C0)\w*$", "", s, flags=re.I)
    s = s.strip(" -_.")
    return s[:300] if s else None

def sql_str(v):
    if v is None: return "null"
    if isinstance(v,(int,float)): return str(v)
    return "'" + str(v).replace("'","''") + "'"

def run_sql(token, query):
    req = urllib.request.Request(
        MGMT_SQL_URL, data=json.dumps({"query": query}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type":"application/json",
                 "User-Agent":"curl/8"})
    with urllib.request.urlopen(req) as r:
        return r.read().decode()

COLS = ["full_path","source_root","rel_path","filename","ext","media_type",
        "location_kind","reachable_from","size_bytes","file_mtime","captured_on",
        "venture","venue","description"]

def upsert_batch(token, rows):
    if not rows: return
    values = []
    for r in rows:
        values.append("(" + ",".join(sql_str(r[c]) for c in COLS) + ")")
    q = (f"insert into public.media_assets ({','.join(COLS)}) values "
         + ",".join(values)
         + " on conflict (full_path) do update set "
         + "size_bytes=excluded.size_bytes, file_mtime=excluded.file_mtime, "
         + "media_type=excluded.media_type, venture=excluded.venture, "
         + "captured_on=excluded.captured_on, description=excluded.description, "
         + "updated_at=now();")
    run_sql(token, q)

def scan_root(token, root_bash, venture_default, location_kind, manifest):
    # Convert the Git-Bash mount path to the Windows form Python needs on win32.
    root = to_win(root_bash)
    if not os.path.isdir(root):
        print(f"  SKIP (not found): {root}", flush=True)
        return 0
    batch, total, seen = [], 0, 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in (".git","$RECYCLE.BIN",".dropbox.cache")]
        for fn in filenames:
            ext = fn.rsplit(".",1)[-1].lower() if "." in fn else ""
            if ext not in MEDIA_EXTS:
                continue
            full = os.path.join(dirpath, fn).replace("\\","/")
            try:
                st = os.stat(full)
            except OSError:
                continue
            seen += 1
            name_l = fn.lower(); path_l = full.lower()
            stem = fn.rsplit(".",1)[0] if "." in fn else fn
            row = {
                "full_path": full,
                "source_root": root,
                "rel_path": full[len(root):].lstrip("/"),
                "filename": fn,
                "ext": ext,
                "media_type": media_type(ext),
                "location_kind": location_kind,
                "reachable_from": "JARSH",
                "size_bytes": st.st_size,
                "file_mtime": datetime.datetime.fromtimestamp(st.st_mtime).isoformat(),
                "captured_on": infer_date(stem, st.st_mtime),
                "venture": infer_venture(venture_default, path_l, name_l),
                "venue": None,
                "description": infer_desc(stem),
            }
            manifest.write(json.dumps(row)+"\n")
            batch.append(row); total += 1
            if len(batch) >= 200:
                upsert_batch(token, batch); batch = []
                print(f"    …{total} media files ingested", flush=True)
    upsert_batch(token, batch)
    print(f"  {root_bash}: {total} media files", flush=True)
    return total

def load_token():
    p = os.path.expanduser("~/.config/harborline/supabase.env")
    with open(p, encoding="utf-8") as f:
        for line in f:
            line=line.strip()
            if line.startswith("SUPABASE_ACCESS_TOKEN"):
                return line.split("=",1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_ACCESS_TOKEN not found")

def main():
    mode = sys.argv[1] if len(sys.argv)>1 else "small"
    token = load_token()
    if mode == "small":
        roots = SMALL_ROOTS
    elif mode == "all":
        roots = SMALL_ROOTS + BIG_ROOTS
    elif mode == "big":
        roots = BIG_ROOTS
    else:
        roots = [(mode, sys.argv[2] if len(sys.argv)>2 else None, "gdrive-mydrive")]
    os.makedirs(os.path.expanduser("~/.config/harborline/media-catalogue"), exist_ok=True)
    mpath = os.path.expanduser(f"~/.config/harborline/media-catalogue/manifest_{mode}.jsonl")
    grand = 0
    with open(mpath,"w",encoding="utf-8") as manifest:
        for root, venture, kind in roots:
            print(f"Scanning {root} (default venture={venture})", flush=True)
            grand += scan_root(token, root, venture, kind, manifest)
    print(f"DONE mode={mode} total={grand} manifest={mpath}", flush=True)

if __name__ == "__main__":
    main()
