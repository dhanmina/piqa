#!/usr/bin/env python3
"""Download real photos from picsum.photos for local dev seed data.

Each user gets a deterministic photo per drop (seeded by user+drop).
Uploads to local Supabase storage via S3-compatible API.

Usage: python3 scripts/dev_seed_images.py
"""

import hashlib
import io
import json
import os
import ssl
import subprocess
import sys
import urllib.request

import boto3
from PIL import Image

PICSUM = "https://picsum.photos/seed"
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

S3_ENDPOINT = "http://127.0.0.1:54321/storage/v1/s3"
S3_ACCESS_KEY = "625729a08b95bf1b7ff351a663f3a23c"
S3_SECRET_KEY = "850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907"


def pg_md5_uuid(seed: str) -> str:
    h = hashlib.md5(seed.encode()).hexdigest()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def supabase_query(sql: str) -> list:
    result = subprocess.run(
        ["supabase", "db", "query", sql, "--local", "--output", "json"],
        capture_output=True, text=True, cwd=PROJECT_DIR, timeout=30,
    )
    if result.returncode != 0:
        print(f"Query failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout.strip())


def fetch_photo(seed: str, size=(750, 1000)) -> bytes:
    url = f"{PICSUM}/{seed}/{size[0]}/{size[1]}.jpg"
    ctx = ssl.create_default_context()
    try:
        ctx.load_default_certs()
    except Exception:
        pass
    # Fallback to unverified if system certs unavailable (macOS Python issue)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": "piqa-dev-seed/1.0"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return resp.read()


def upload_s3(key: str, data: bytes) -> None:
    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="local",
    )
    s3.put_object(Bucket="submissions", Key=key, Body=data, ContentType="image/jpeg")


def main():
    drops = supabase_query(
        "select id, status from public.prompt_drops order by drop_date desc limit 2"
    )
    if not drops:
        print("No drops found. Run `supabase db reset` first.")
        return

    print(f"Found {len(drops)} drop(s). Generating photos...")

    for i in range(40):
        uid_str = pg_md5_uuid(f"piqa-seed-user-{i+1}")
        for drop in drops:
            drop_id = drop["id"]
            pic_seed = f"piqa-{i+1}-{drop_id[:8]}"
            full_path = f"{drop_id}/{uid_str}.jpg"
            thumb_path = f"{drop_id}/{uid_str}_thumb.jpg"

            print(f"  ↓ {pic_seed} ({drop_id[:8]}/{i+1})")

            data = fetch_photo(pic_seed)
            img = Image.open(io.BytesIO(data))
            w, h = img.size

            # Crop to 3:4 portrait (750x1000)
            target_ratio = 3 / 4
            if w / h > target_ratio:
                new_w = int(h * target_ratio)
                offset = (w - new_w) // 2
                img = img.crop((offset, 0, offset + new_w, h))
            else:
                new_h = int(w / target_ratio)
                offset = (h - new_h) // 2
                img = img.crop((0, offset, w, offset + new_h))
            img = img.resize((750, 1000), Image.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=80)
            upload_s3(full_path, buf.getvalue())

            thumb = img.resize((375, 500), Image.LANCZOS)
            buf2 = io.BytesIO()
            thumb.save(buf2, format="JPEG", quality=70)
            upload_s3(thumb_path, buf2.getvalue())

            print(f"    ✓ {drop_id[:8]}/{i+1}")

        if (i + 1) % 10 == 0:
            print(f"  [{i+1}/40] done")

    print("All done!")


if __name__ == "__main__":
    main()
