#!/usr/bin/env python3
"""DAM daily pipeline — runs on JARSH (Windows Task Scheduler, ~7:15am).

Media enrichment touches local/gdrive files, so it can't live in a Supabase cron
(cloud) — it runs here, on the one machine that can read the files. Each morning:
  1. scan   — catch new capture (phone/glasses in Camera Uploads + the small roots)
  2. folder — refresh the folder-context rollup in the DB
  3. enrich — new un-enriched Camera Uploads (thumbnails + EXIF + Claude vision)
  4. drain  — any folders Josh flagged 'enrich_requested' in the portal

Idempotent; safe to run repeatedly. Logs to
~/.config/harborline/media-catalogue/daily.log.
"""
import subprocess, sys, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
LOG = os.path.expanduser("~/.config/harborline/media-catalogue/daily.log")
os.makedirs(os.path.dirname(LOG), exist_ok=True)

def log(msg):
    line = f"[{datetime.datetime.now().isoformat(timespec='seconds')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def step(name, script, extra):
    log(f"→ {name}: {script} {' '.join(extra)}")
    try:
        # Task Scheduler runs without UTF-8 stdio; child prints ✓/— and dies with
        # UnicodeEncodeError under cp1252. Force UTF-8 (bit us 7/8 + 7/9 at 7:15).
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        r = subprocess.run([PY, os.path.join(HERE, script)] + extra,
                           capture_output=True, text=True, timeout=3600,
                           encoding="utf-8", errors="replace", env=env)
        tail = "\n".join((r.stdout or "").strip().splitlines()[-3:])
        log(f"  {name} rc={r.returncode} :: {tail}")
    except Exception as e:
        log(f"  {name} FAILED: {e}")

def main():
    log("=== DAM daily pipeline start ===")
    step("scan",   "scan_media.py",          ["small"])
    # Physical drives (Josh 7/21): index whatever external drive happens to be
    # mounted today under physical://<LABEL>; rows persist after unplug so the
    # library stays a searchable log of everything that exists. Costs nothing
    # when no drive is plugged in.
    step("physical", "scan_media.py",        ["physical"])
    step("folder", "build_folder_context.py", [])            # DB-only (no sidecar churn)
    step("enrich", "enrich_media.py",         ["--limit", "60"])   # new Camera Uploads
    step("drain",  "enrich_media.py",         ["--drain-requests"])
    log("=== DAM daily pipeline done ===")

if __name__ == "__main__":
    main()
