"""
Second pass: replace composited banners with each collection's REAL banner where
Magic Eden exposes one.

Run AFTER fetch_wide.py (it needs market.json to exist), never at the same time —
the API rate-limits per minute and two concurrent jobs just starve each other.

    python fetch_banners.py

Patches market.json in place. Any collection without a real banner keeps the
composite that fetch_wide.py generated, so this is safe to run repeatedly.
"""
import base64
import io
import json
import os
import time
import urllib.error
import urllib.request

from PIL import Image

API = "https://api-mainnet.magiceden.dev/v2"
UA = {"accept": "*/*", "user-agent": "Mozilla/5.0"}
PAUSE = 2.0
BANNER_W, BANNER_H = 900, 240

# Fields ME has used for banner art at various times.
BANNER_KEYS = ("banner", "bannerImage", "bannerUrl", "banner_image", "headerImage")


def api(path, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(API + path, headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 15 * (attempt + 1)
                print("    rate limited, waiting %ds" % wait)
                time.sleep(wait)
                continue
            return None
        except Exception:
            time.sleep(3)
    return None


def fetch_banner(url):
    """Download a real banner and crop it to the page's aspect ratio."""
    try:
        req = urllib.request.Request(url, headers=UA)
        raw = urllib.request.urlopen(req, timeout=35).read()
        im = Image.open(io.BytesIO(raw))
        if im.mode in ("P", "LA"):
            im = im.convert("RGBA")
        if im.mode == "RGBA":
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")

        # cover-crop to the target aspect ratio
        target = BANNER_W / BANNER_H
        w, h = im.size
        if w / h > target:
            nw = int(h * target)
            im = im.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
        else:
            nh = int(w / target)
            im = im.crop((0, (h - nh) // 2, w, (h + nh) // 2))
        im = im.resize((BANNER_W, BANNER_H), Image.LANCZOS)

        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=64, method=5)
        return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        print("    banner download failed: %s" % type(e).__name__)
        return None


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "market.json")
    if not os.path.exists(path):
        raise SystemExit("market.json missing — run fetch_wide.py first")

    data = json.load(open(path))
    real = kept = 0

    for c in data["collections"]:
        print("%s ..." % c["sym"])
        meta = api("/collections/%s" % c["sym"])
        time.sleep(PAUSE)
        if not meta:
            print("    no metadata, keeping composite")
            kept += 1
            continue

        url = None
        for k in BANNER_KEYS:
            v = meta.get(k)
            if v and isinstance(v, str) and v.startswith("http"):
                url = v
                break

        if not url:
            print("    no banner field (has: %s)" % ", ".join(sorted(meta.keys())[:8]))
            kept += 1
            continue

        img = fetch_banner(url)
        if img:
            c["banner"] = img
            c["banner_real"] = True
            real += 1
            print("    real banner OK")
        else:
            kept += 1

    json.dump(data, open(path, "w"))
    print("\nreal banners: %d   composites kept: %d   size: %.1f MB"
          % (real, kept, os.path.getsize(path) / 1048576))
    print("now run: python gen_market.py")


if __name__ == "__main__":
    main()
