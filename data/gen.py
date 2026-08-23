"""
Build the live-data marketplace page from data.json + template.html.

    python gen.py

Writes ../directions/04-marketplace-live-data.html — a single self-contained
file with all listing data and artwork inlined. No build step, no server:
open it directly in a browser.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "directions", "04-marketplace-live-data.html")

# Collections to leave out of a client-facing build (by Magic Eden symbol).
EXCLUDE = {"retardio_cousins"}


def main():
    data = json.load(open(os.path.join(HERE, "data.json")))
    data["collections"] = [c for c in data["collections"] if c["sym"] not in EXCLUDE]
    data["collections"].sort(key=lambda c: -c["vol7d"])

    template = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
    assert "__BLOB__" in template, "template.html is missing the __BLOB__ placeholder"

    blob = json.dumps(data, separators=(",", ":"))
    open(OUT, "w", encoding="utf-8").write(template.replace("__BLOB__", blob))

    items = sum(len(c["items"]) for c in data["collections"])
    pool = sum(1 for c in data["collections"] for i in c["items"] if not i["ah"])
    print("collections: %d   listings: %d   (%d are AMM/pool listings)" % (
        len(data["collections"]), items, pool))
    print("snapshot:    %s" % data["fetched"])
    print("written:     %s  (%d KB)" % (os.path.normpath(OUT), os.path.getsize(OUT) / 1024))
    for c in data["collections"]:
        print("  %-24s floor %-9.3f listed %-6d 7d vol %.0f SOL" % (
            c["name"][:24], c["floor"], c["listed"], c["vol7d"]))


if __name__ == "__main__":
    main()
