"""
Refresh data.json with live Solana listings from the Magic Eden public API.

    pip install pillow
    python fetch_listings.py
    python gen.py          # rebuilds ../directions/04-marketplace-live-data.html

Images are downloaded, centre-cropped, resized and embedded as base64 WEBP so the
generated page is fully self-contained (no external requests, works offline).

NOTE: the read endpoints used here are keyless. The *instruction* endpoints that
build a buy transaction (/v2/instructions/buy_now) are NOT — they return HTTP 401
without an API key. See README.
"""
import base64
import io
import json
import os
import time
import urllib.request

from PIL import Image

# Collections to pull. Any Magic Eden symbol works; check it resolves at
# https://api-mainnet.magiceden.dev/v2/collections/<symbol>/stats
SYMBOLS = [
    "mad_lads",
    "claynosaurz",
    "famous_fox_federation",
    "cets_on_creck",
    "okay_bears",
    "solana_monkey_business",
]

ITEMS_PER_COLLECTION = 12
THUMB_PX = 224
WEBP_QUALITY = 70

API = "https://api-mainnet.magiceden.dev/v2"
UA = {"accept": "*/*", "user-agent": "Mozilla/5.0"}

# Arweave gateways are flaky; we retry across these before giving up on an image.
GATEWAYS = ["https://arweave.net/", "https://ar-io.net/", "https://arweave.dev/"]


def fetch(url, raw=False, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    resp = urllib.request.urlopen(req, timeout=timeout)
    return resp.read() if raw else json.load(resp)


def gateway_variants(url):
    """Same Arweave tx id, different gateways."""
    variants = [url]
    for g in GATEWAYS:
        if url.startswith(g):
            tx = url[len(g):]
            variants += [other + tx for other in GATEWAYS if other != g]
            break
    return variants


def thumbnail(url):
    """Download an image and return it as a base64 WEBP data URI, or None."""
    for candidate in gateway_variants(url):
        for _ in range(2):
            try:
                im = Image.open(io.BytesIO(fetch(candidate, raw=True)))
                if im.mode in ("P", "LA"):
                    im = im.convert("RGBA")
                if im.mode == "RGBA":  # flatten transparency onto white
                    bg = Image.new("RGB", im.size, (255, 255, 255))
                    bg.paste(im, mask=im.split()[-1])
                    im = bg
                else:
                    im = im.convert("RGB")
                w, h = im.size
                side = min(w, h)
                im = im.crop(((w - side) // 2, (h - side) // 2,
                              (w + side) // 2, (h + side) // 2))
                im = im.resize((THUMB_PX, THUMB_PX), Image.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=WEBP_QUALITY, method=5)
                return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
            except Exception:
                time.sleep(1.0)
    return None


def collect(symbol):
    stats = fetch("%s/collections/%s/stats" % (API, symbol))
    floor = stats.get("floorPrice", 0) / 1e9
    if floor <= 0:
        print("  no floor price, skipping")
        return None

    listings = fetch("%s/collections/%s/listings?offset=0&limit=40" % (API, symbol))
    items, seen, name = [], set(), symbol.replace("_", " ").title()

    for l in listings:
        if len(items) >= ITEMS_PER_COLLECTION:
            break
        mint = l.get("tokenMint", "")
        if not mint or mint in seen:
            continue
        token = l.get("token") or {}
        img_url = token.get("image") or (l.get("extra") or {}).get("img")
        if not img_url:
            continue
        img = thumbnail(img_url)
        if not img:
            continue
        seen.add(mint)
        name = token.get("collectionName") or name
        items.append({
            "n": token.get("name") or "#?",
            "p": round(l.get("price", 0), 3),
            "rank": ((l.get("rarity") or {}).get("moonrank") or {}).get("rank"),
            "mint": mint,
            "seller": l.get("seller", ""),
            # Empty for AMM/pool listings — these fill through a DIFFERENT program
            # than auction-house escrow listings. Branch on this in any integration.
            "ah": l.get("auctionHouse", ""),
            "img": img,
        })

    if not items:
        print("  no usable images")
        return None

    items.sort(key=lambda i: i["p"])
    return {
        "sym": symbol,
        "name": name,
        "floor": round(floor, 3),
        "listed": stats.get("listedCount", 0),
        "vol7d": round(stats.get("volume7d", 0) / 1e9, 1),
        "items": items,
    }


def main():
    out = []
    for symbol in SYMBOLS:
        print("%s ..." % symbol)
        try:
            c = collect(symbol)
        except Exception as e:
            print("  failed: %s" % type(e).__name__)
            continue
        if c:
            pool = sum(1 for i in c["items"] if not i["ah"])
            print("  %d items, floor %.3f SOL, %d pool listing(s)" % (len(c["items"]), c["floor"], pool))
            out.append(c)
        time.sleep(0.4)

    payload = {
        "fetched": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
        "collections": out,
    }
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "data.json")
    json.dump(payload, open(path, "w"))

    total = sum(len(c["items"]) for c in out)
    print("\n%d collections, %d listings, %d KB" % (len(out), total, os.path.getsize(path) / 1024))
    print("now run: python gen.py")


if __name__ == "__main__":
    main()
