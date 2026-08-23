"""
Fetch a WIDE, visually diverse set of Solana collections for the marketplace mockup.

Pulls collection metadata, stats and listings from the Magic Eden public API, then
downloads artwork and embeds it as base64 WEBP. Banners are composited from each
collection's own item art (ME's public API doesn't expose banner assets).

    pip install pillow
    python fetch_wide.py        # ~10 min, rate-limited on purpose
    python gen_market.py

The API rate-limits aggressively (HTTP 429). PAUSE below is deliberate — don't lower it.
"""
import base64
import io
import json
import os
import time
import urllib.error
import urllib.request

from PIL import Image, ImageFilter

# Chosen for VISUAL variety: illustrated PFPs, 3D renders, pixel art, abstract/generative.
SYMBOLS = [
    "mad_lads", "claynosaurz", "famous_fox_federation", "cets_on_creck",
    "okay_bears", "solana_monkey_business", "degenerate_ape_academy", "froganas",
    "smb_gen3", "lifinity_flares", "taiyo_robotics", "boryoku_dragonz",
    "catalina_whale_mixer", "blocksmith_labs", "the_stoned_ape_crew", "aurory",
    "galactic_geckos", "primates", "udderchaos", "shadowy_super_coder_dao",
]

ITEMS = 8          # listings kept per collection
THUMB = 200        # item thumbnail px
BANNER_W = 900     # composited banner px
BANNER_H = 240
Q = 68             # WEBP quality
PAUSE = 1.6        # seconds between API calls — the API is strict

API = "https://api-mainnet.magiceden.dev/v2"
UA = {"accept": "*/*", "user-agent": "Mozilla/5.0"}
GATEWAYS = ["https://arweave.net/", "https://ar-io.net/", "https://arweave.dev/"]


def api(path, tries=4):
    """GET with backoff on rate limiting."""
    for attempt in range(tries):
        try:
            req = urllib.request.Request(API + path, headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 12 * (attempt + 1)
                print("    rate limited, waiting %ds" % wait)
                time.sleep(wait)
                continue
            raise
        except Exception:
            time.sleep(3)
    raise RuntimeError("gave up on " + path)


def variants(url):
    out = [url]
    for g in GATEWAYS:
        if url.startswith(g):
            tx = url[len(g):]
            out += [o + tx for o in GATEWAYS if o != g]
            break
    return out


def load_image(url):
    """Download and return a square RGB PIL image, or None."""
    for cand in variants(url):
        for _ in range(2):
            try:
                req = urllib.request.Request(cand, headers=UA)
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
                w, h = im.size
                s = min(w, h)
                return im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
            except Exception:
                time.sleep(0.8)
    return None


def encode(im, quality=Q):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=5)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def make_banner(images):
    """Composite a wide banner from item art: blurred bed + a row of sharp tiles."""
    bed = images[0].resize((BANNER_W, BANNER_W), Image.LANCZOS)
    top = (BANNER_W - BANNER_H) // 2
    bed = bed.crop((0, top, BANNER_W, top + BANNER_H)).filter(ImageFilter.GaussianBlur(26))
    bed = Image.blend(bed, Image.new("RGB", bed.size, (18, 14, 32)), 0.42)

    tile = BANNER_H - 44
    gap = 16
    row = images[:6]
    total = len(row) * tile + (len(row) - 1) * gap
    x = (BANNER_W - total) // 2
    y = (BANNER_H - tile) // 2
    for im in row:
        bed.paste(im.resize((tile, tile), Image.LANCZOS), (x, y))
        x += tile + gap
    return bed


def collect(symbol):
    stats = api("/collections/%s/stats" % symbol)
    time.sleep(PAUSE)
    floor = stats.get("floorPrice", 0) / 1e9
    if floor <= 0:
        print("    no floor, skipping")
        return None

    meta = {}
    try:
        meta = api("/collections/%s" % symbol)
        time.sleep(PAUSE)
    except Exception:
        pass

    listings = api("/collections/%s/listings?offset=0&limit=30" % symbol)
    time.sleep(PAUSE)

    items, pil, seen = [], [], set()
    name = meta.get("name") or symbol.replace("_", " ").title()
    for l in listings:
        if len(items) >= ITEMS:
            break
        mint = l.get("tokenMint", "")
        if not mint or mint in seen:
            continue
        tok = l.get("token") or {}
        url = tok.get("image") or (l.get("extra") or {}).get("img")
        if not url:
            continue
        im = load_image(url)
        if im is None:
            continue
        seen.add(mint)
        pil.append(im)
        items.append({
            "n": tok.get("name") or "#?",
            "p": round(l.get("price", 0), 3),
            "rank": ((l.get("rarity") or {}).get("moonrank") or {}).get("rank"),
            "mint": mint,
            "seller": l.get("seller", ""),
            "ah": l.get("auctionHouse", ""),   # empty => AMM/pool listing, different fill path
            "img": encode(im.resize((THUMB, THUMB), Image.LANCZOS)),
        })

    if len(items) < 3:
        print("    only %d usable images, skipping" % len(items))
        return None

    items.sort(key=lambda i: i["p"])
    return {
        "sym": symbol,
        "name": name,
        "desc": (meta.get("description") or "").strip()[:200],
        "floor": round(floor, 3),
        "listed": stats.get("listedCount", 0),
        "vol7d": round(stats.get("volume7d", 0) / 1e9, 1),
        "avg24": round(stats.get("avgPrice24hr", 0) / 1e9, 3),
        "avatar": encode(pil[0].resize((132, 132), Image.LANCZOS), 74),
        "banner": encode(make_banner(pil), 62),
        "items": items,
    }


def main():
    out = []
    for i, sym in enumerate(SYMBOLS, 1):
        print("[%2d/%d] %s" % (i, len(SYMBOLS), sym))
        try:
            c = collect(sym)
        except Exception as e:
            print("    failed: %s" % type(e).__name__)
            continue
        if c:
            pool = sum(1 for x in c["items"] if not x["ah"])
            print("    OK  %d items  floor %.3f  %d pool" % (len(c["items"]), c["floor"], pool))
            out.append(c)

    payload = {"fetched": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "collections": out}
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "market.json")
    json.dump(payload, open(path, "w"))
    print("\n%d collections, %d listings, %.1f MB" % (
        len(out), sum(len(c["items"]) for c in out), os.path.getsize(path) / 1048576))


if __name__ == "__main__":
    main()
