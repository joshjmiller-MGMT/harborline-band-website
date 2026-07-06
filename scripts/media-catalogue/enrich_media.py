#!/usr/bin/env python3
"""DAM slice-2b enricher (runs on JARSH — the only machine that can read the files).

For a target set of assets: reads the file, pulls EXIF (real capture date, GPS,
camera, dimensions) / ffprobe (video duration), generates a small JPEG thumbnail
(Pillow for images incl. HEIC, ffmpeg poster frame for video), and hands the
thumbnail to the `media-enrich` edge fn — which stores it and runs Claude vision
for caption + tags + suggested_output. EXIF-derived facts are written straight to
media_assets via the Management API.

Enrichment reads file bytes (downloads gdrive files), so it's DELIBERATELY scoped —
default target is new Camera Uploads; pass --folder / --venture / --limit to widen.

Usage:
    python enrich_media.py                       # up to 25 un-enriched Camera Uploads
    python enrich_media.py --limit 50
    python enrich_media.py --folder "J:/My Drive/Media/... "
    python enrich_media.py --venture Harborline --limit 30
    python enrich_media.py --drain-requests      # folders flagged status='enrich_requested'
"""
import os, sys, re, json, base64, subprocess, glob, io, datetime, urllib.request, tempfile

PROJECT_REF = "mbqyznttpvebahgygsbx"
MGMT_SQL_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
FUNC_URL = f"https://{PROJECT_REF}.supabase.co/functions/v1/media-enrich"

try:
    from PIL import Image, ImageOps, ExifTags
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    except Exception:
        pass
    HAVE_PIL = True
except Exception:
    HAVE_PIL = False

def find_bin(name):
    if os.environ.get(name.upper()):
        return os.environ[name.upper()]
    hits = glob.glob(os.path.expanduser(
        f"~/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/**/{name}.exe"), recursive=True)
    return hits[0] if hits else name
FFMPEG = find_bin("ffmpeg")
FFPROBE = find_bin("ffprobe")

def load_token():
    with open(os.path.expanduser("~/.config/harborline/supabase.env"), encoding="utf-8") as f:
        for line in f:
            if line.strip().startswith("SUPABASE_ACCESS_TOKEN"):
                return line.split("=",1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_ACCESS_TOKEN not found")

def run_sql(token, query):
    req = urllib.request.Request(MGMT_SQL_URL, data=json.dumps({"query": query}).encode(), method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type":"application/json", "User-Agent":"curl/8"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def get_secret(token, name):
    rows = run_sql(token, f"select secret from cron_secrets where name='{name}' limit 1")
    return rows[0]["secret"] if rows else None

def sql_str(v):
    if v is None: return "null"
    if isinstance(v,(int,float)): return str(v)
    return "'" + str(v).replace("'","''") + "'"

# ── EXIF (images) ──────────────────────────────────────────────────────────
def _gps_to_decimal(gps):
    def cvt(vals, ref):
        d,m,s = [float(x) for x in vals]
        dec = d + m/60 + s/3600
        return -dec if ref in ("S","W") else dec
    try:
        lat = cvt(gps[2], gps[1]); lon = cvt(gps[4], gps[3])
        return [round(lat,6), round(lon,6)]
    except Exception:
        return None

def image_thumb_and_exif(path):
    im = Image.open(path)
    exif_raw = {}
    try:
        raw = im.getexif()
        tagmap = {ExifTags.TAGS.get(k,k): v for k,v in raw.items()}
        exif_raw["camera"] = " ".join(str(tagmap.get(t,"")).strip() for t in ("Make","Model")).strip() or None
        dto = tagmap.get("DateTimeOriginal") or tagmap.get("DateTime")
        cap = None
        if dto:
            m = re.match(r"(\d{4})[:\-](\d{2})[:\-](\d{2})", str(dto))
            if m: cap = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        gps_ifd = raw.get_ifd(0x8825) if hasattr(raw,"get_ifd") else None
        gps = _gps_to_decimal(gps_ifd) if gps_ifd else None
    except Exception:
        cap, gps = None, None
    w,h = im.size
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((512,512))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=80)
    meta = {"captured_on": cap, "width": w, "height": h, "duration_sec": None,
            "exif": {k:v for k,v in {"camera": exif_raw.get("camera"), "gps": gps,
                     "datetime_original": cap}.items() if v}}
    return base64.b64encode(buf.getvalue()).decode(), meta

# ── ffmpeg/ffprobe (video) ─────────────────────────────────────────────────
def video_thumb_and_meta(path):
    b64 = None
    for ss in ("00:00:01", "00:00:00"):
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
        try:
            subprocess.run([FFMPEG, "-y", "-ss", ss, "-i", path, "-frames:v", "1",
                            "-vf", "scale='min(512,iw)':-2", "-q:v", "4", tmp],
                           capture_output=True, timeout=90)
            if os.path.getsize(tmp) > 0:
                with open(tmp,"rb") as fh: b64 = base64.b64encode(fh.read()).decode()
        except Exception:
            pass
        finally:
            try: os.remove(tmp)
            except OSError: pass
        if b64: break
    meta = {"captured_on": None, "width": None, "height": None, "duration_sec": None, "exif": {}}
    try:
        out = subprocess.run([FFPROBE, "-v","quiet","-print_format","json","-show_format","-show_streams", path],
                             capture_output=True, timeout=60, text=True).stdout
        j = json.loads(out)
        dur = j.get("format",{}).get("duration")
        if dur: meta["duration_sec"] = round(float(dur),1)
        ct = j.get("format",{}).get("tags",{}).get("creation_time")
        if ct: meta["captured_on"] = ct[:10]
        for s in j.get("streams",[]):
            if s.get("codec_type")=="video":
                meta["width"], meta["height"] = s.get("width"), s.get("height"); break
    except Exception:
        pass
    return b64, meta

def call_enrich(anon, secret, asset_id, thumb_b64, filename, venture, folder):
    req = urllib.request.Request(FUNC_URL, data=json.dumps({
        "asset_id": asset_id, "thumb_b64": thumb_b64, "filename": filename,
        "venture": venture, "folder": folder}).encode(), method="POST",
        headers={"Authorization": f"Bearer {anon}", "x-cron-secret": secret,
                 "Content-Type":"application/json", "User-Agent":"curl/8"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())

def update_meta(token, asset_id, meta):
    sets = [f"captured_on=coalesce({sql_str(meta['captured_on'])}, captured_on)"] if meta.get("captured_on") else []
    for col in ("width","height","duration_sec"):
        if meta.get(col) is not None: sets.append(f"{col}={meta[col]}")
    if meta.get("exif"): sets.append(f"exif={sql_str(json.dumps(meta['exif']))}::jsonb")
    if not sets: return
    run_sql(token, f"update media_assets set {', '.join(sets)} where id='{asset_id}'")

def main():
    args = sys.argv[1:]
    limit = 25
    folder = venture = None
    drain = "--drain-requests" in args
    force = "--force" in args
    for i,a in enumerate(args):
        if a=="--limit" and i+1<len(args): limit=int(args[i+1])
        if a=="--folder" and i+1<len(args): folder=args[i+1]
        if a=="--venture" and i+1<len(args): venture=args[i+1]
    if not HAVE_PIL:
        raise SystemExit("Pillow not available")
    token = load_token()
    anon = get_secret(token, "supabase_anon_jwt")
    secret = get_secret(token, "trello_route_cron_secret")

    folders = [folder] if folder else None
    if drain:
        rows = run_sql(token, "select folder_path from media_folders where status='enrich_requested'")
        folders = [r["folder_path"] for r in rows]
        print(f"drain: {len(folders)} folders flagged", flush=True)

    where = ["media_type in ('image','video')"]
    if not force:
        where.append("thumbnail_path is null")
    if venture: where.append(f"venture={sql_str(venture)}")
    if folders is not None:
        if not folders: print("nothing to enrich"); return
        ors = " or ".join(f"full_path like {sql_str(fp + '%')}" for fp in folders)
        where.append(f"({ors})")
    else:
        where.append("full_path like '%Camera Uploads%'")
    q = (f"select id, full_path, filename, media_type, venture from media_assets "
         f"where {' and '.join(where)} order by captured_on desc nulls last limit {limit}")
    assets = run_sql(token, q)
    print(f"enriching {len(assets)} assets (ffmpeg={os.path.basename(FFMPEG)})", flush=True)

    done = fail = 0
    for a in assets:
        path = a["full_path"]
        folder_name = os.path.basename(os.path.dirname(path))
        try:
            if a["media_type"]=="image":
                thumb, meta = image_thumb_and_exif(path)
            else:
                thumb, meta = video_thumb_and_meta(path)
            if not thumb:
                print(f"  no thumb: {a['filename']}", flush=True); fail+=1; continue
            update_meta(token, a["id"], meta)
            res = call_enrich(anon, secret, a["id"], thumb, a["filename"], a.get("venture"), folder_name)
            cap = (res.get("ai") or {}).get("caption","(no caption)")
            print(f"  ✓ {a['filename']}: {cap[:70]}", flush=True); done+=1
        except Exception as e:
            print(f"  ✗ {a['filename']}: {e}", flush=True); fail+=1
    # clear the drain flag on processed folders
    if drain and folders:
        ors = " or ".join(f"folder_path={sql_str(fp)}" for fp in folders)
        run_sql(token, f"update media_folders set status='editing' where status='enrich_requested' and ({ors})")
    print(f"DONE enriched={done} failed={fail}", flush=True)

if __name__ == "__main__":
    main()
