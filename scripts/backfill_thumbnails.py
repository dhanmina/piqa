#!/usr/bin/env python3
"""Backfill sharp thumbnails for existing photos on the REMOTE Supabase project.

Early uploads stored a 300px thumbnail (the app now generates 1080px — see
THUMB_LONG_EDGE in lib/captureQueue.ts). Every grid displays the thumb, so those
old photos look blurry. This regenerates each thumbnail from the 2048px full-res
that is already in storage, at the same size/quality the app uses now. No photo is
re-uploaded and the full-res is untouched.

This is a one-off admin job against PRODUCTION, so it needs the service-role key
(NOT the publishable/anon key). Never commit the key and never put it in an
EXPO_PUBLIC_* var — it bypasses Row-Level Security.

Usage:
    export SUPABASE_URL="https://<project-ref>.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."   # service_role / secret key
    python3 scripts/backfill_thumbnails.py                 # backfill everything
    python3 scripts/backfill_thumbnails.py --dry-run       # list, change nothing
    python3 scripts/backfill_thumbnails.py --limit 20      # first 20 (a test run)

Requires: pillow  (pip install pillow)
"""

import argparse
import io
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

from PIL import Image

# Verified TLS with certifi's CA bundle — Python.org builds on macOS don't use
# the system trust store, so the default context fails to verify supabase.co.
# We send an admin secret over this connection, so verification stays ON.
try:
    import certifi

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

# Must match the app's pipeline (lib/captureQueue.ts).
THUMB_LONG_EDGE = 1080
THUMB_QUALITY = 80
BUCKET = "submissions"
PAGE = 500  # PostgREST page size


def env(*names: str) -> str | None:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return None


def load_dotenv_url() -> str | None:
    """Convenience: pull the project URL from .env.local so only the secret
    key has to be exported. The key itself is never read from a file."""
    path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("EXPO_PUBLIC_SUPABASE_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return None


BASE = (env("SUPABASE_URL") or load_dotenv_url() or "").rstrip("/")
KEY = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")

if not BASE or not KEY:
    print(
        "Missing config. Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL in .env.local)\n"
        "and SUPABASE_SERVICE_ROLE_KEY (the service_role / sb_secret_ key).",
        file=sys.stderr,
    )
    sys.exit(1)

AUTH = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def _request(method: str, url: str, headers: dict, data: bytes | None = None) -> bytes:
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
        return resp.read()


def list_submissions() -> list[dict]:
    """All rows that have a full-res object to regenerate from."""
    rows: list[dict] = []
    offset = 0
    while True:
        url = (
            f"{BASE}/rest/v1/submissions"
            f"?select=id,image_path,thumb_path&image_path=not.is.null"
            f"&order=id&limit={PAGE}&offset={offset}"
        )
        chunk = json.loads(_request("GET", url, {**AUTH, "Accept": "application/json"}))
        rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE
    return rows


def download(path: str) -> bytes:
    return _request("GET", f"{BASE}/storage/v1/object/authenticated/{BUCKET}/{path}", AUTH)


def upload_thumb(path: str, data: bytes) -> None:
    # x-upsert overwrites the existing thumb object in place.
    headers = {**AUTH, "Content-Type": "image/jpeg", "x-upsert": "true"}
    _request("POST", f"{BASE}/storage/v1/object/{BUCKET}/{path}", headers, data)


def make_thumb(full_bytes: bytes) -> tuple[bytes | None, int]:
    """Resize the full-res to THUMB_LONG_EDGE on its long edge (stored photos are
    already cropped to the canonical portrait, so this only scales). Returns
    (jpeg_bytes, source_long_edge); jpeg is None if already <= target (skip)."""
    img = Image.open(io.BytesIO(full_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    w, h = img.size
    long_edge = max(w, h)
    if long_edge <= THUMB_LONG_EDGE:
        return None, long_edge  # already small enough; never upscale
    scale = THUMB_LONG_EDGE / long_edge
    img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=THUMB_QUALITY)
    return buf.getvalue(), long_edge


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    ap.add_argument("--limit", type=int, default=0, help="process at most N rows")
    args = ap.parse_args()

    print(f"Project: {BASE}")
    rows = list_submissions()
    if args.limit:
        rows = rows[: args.limit]
    print(f"{len(rows)} photo(s) with a full-res to regenerate from"
          + (" (dry run)" if args.dry_run else "") + "\n")

    done = skipped = failed = 0
    for i, r in enumerate(rows, 1):
        image_path, thumb_path = r.get("image_path"), r.get("thumb_path")
        if not thumb_path:
            skipped += 1
            continue
        try:
            full = download(image_path)
            thumb, src_edge = make_thumb(full)
            if thumb is None:
                print(f"  [{i}/{len(rows)}] skip {thumb_path} (source only {src_edge}px)")
                skipped += 1
                continue
            if args.dry_run:
                print(f"  [{i}/{len(rows)}] would write {thumb_path} "
                      f"({src_edge}px -> {THUMB_LONG_EDGE}px, {len(thumb)//1024}KB)")
            else:
                upload_thumb(thumb_path, thumb)
                print(f"  [{i}/{len(rows)}] ✓ {thumb_path} ({len(thumb)//1024}KB)")
            done += 1
        except urllib.error.HTTPError as e:
            print(f"  [{i}/{len(rows)}] ✗ {thumb_path}: HTTP {e.code} {e.reason}", file=sys.stderr)
            failed += 1
        except Exception as e:  # noqa: BLE001 — one bad row shouldn't stop the batch
            print(f"  [{i}/{len(rows)}] ✗ {thumb_path}: {e}", file=sys.stderr)
            failed += 1

    verb = "would update" if args.dry_run else "updated"
    print(f"\nDone. {verb} {done}, skipped {skipped}, failed {failed}.")


if __name__ == "__main__":
    main()
