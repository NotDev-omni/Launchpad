"""
Build the full marketplace page from market.json + template_market.html.

    python fetch_wide.py     # first, to populate market.json
    python gen_market.py

Writes ../directions/05-marketplace-full.html — one self-contained file.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "directions", "05-marketplace-full.html")

# Hand-tagged so the category filter has something meaningful to group on.
# ME's public API doesn't return usable category data.
CATEGORY = {
    "mad_lads": "PFP", "famous_fox_federation": "PFP", "cets_on_creck": "PFP",
    "okay_bears": "PFP", "degenerate_ape_academy": "PFP", "froganas": "PFP",
    "the_stoned_ape_crew": "PFP", "galactic_geckos": "PFP", "primates": "PFP",
    "udderchaos": "PFP",
    "claynosaurz": "3D", "smb_gen3": "3D", "taiyo_robotics": "3D",
    "catalina_whale_mixer": "3D", "blocksmith_labs": "3D",
    "solana_monkey_business": "Pixel", "shadowy_super_coder_dao": "Pixel",
    "lifinity_flares": "Art", "boryoku_dragonz": "Art",
    "aurory": "Gaming",
}

EXCLUDE = set()


def main():
    path = os.path.join(HERE, "market.json")
    if not os.path.exists(path):
        raise SystemExit("market.json missing — run fetch_wide.py first")

    data = json.load(open(path))
    data["collections"] = [c for c in data["collections"] if c["sym"] not in EXCLUDE]
    for c in data["collections"]:
        c["cat"] = CATEGORY.get(c["sym"], "PFP")
    data["collections"].sort(key=lambda c: -c["vol7d"])

    template = open(os.path.join(HERE, "template_market.html"), encoding="utf-8").read()
    assert "__BLOB__" in template, "template_market.html is missing __BLOB__"

    blob = json.dumps(data, separators=(",", ":"))
    open(OUT, "w", encoding="utf-8").write(template.replace("__BLOB__", blob))

    items = sum(len(c["items"]) for c in data["collections"])
    pool = sum(1 for c in data["collections"] for i in c["items"] if not i["ah"])
    cats = {}
    for c in data["collections"]:
        cats[c["cat"]] = cats.get(c["cat"], 0) + 1

    print("collections: %d   listings: %d   (%d AMM/pool)" % (len(data["collections"]), items, pool))
    print("categories:  %s" % ", ".join("%s %d" % kv for kv in sorted(cats.items())))
    print("snapshot:    %s" % data["fetched"])
    print("written:     %s  (%.1f MB)" % (os.path.normpath(OUT), os.path.getsize(OUT) / 1048576))


if __name__ == "__main__":
    main()
