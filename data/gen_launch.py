"""
Build the launchpad half — drops, mint flow, and the creator Studio wizard.

    python gen_launch.py

Reads artwork out of data.json (real on-chain art) purely as drop visuals, and
writes ../directions/06-launchpad.html.

Drop metadata (dates, phases, supply, mint prices) is SYNTHETIC and labelled as such
on the page — these are launches that haven't happened, so there is nothing real to
pull. The artwork is real; the schedule is a sketch.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "directions", "06-launchpad.html")

# name, creator, supply, price SOL, state, when, minted, lane
DROPS = [
    ("Vault Wardens",   "outpost.sol",   5000, 1.85, "live",     "Closes in",      1704, "play"),
    ("Hollow Signal",   "deadlight.sol", 3333, 0.90, "live",     "Closes in",      2871, "play"),
    ("Ferrous Kin",     "anvil.sol",     8888, 0.45, "soon",     "Today 18:00",       0, "play"),
    ("Meridian Labs",   "meridian.sol",  1200, 12.0, "soon",     "Tomorrow 15:00",    0, "pro"),
    ("Deep Cache",      "warden.sol",    4444, 2.20, "soon",     "Tomorrow 21:00",    0, "play"),
    ("Grove Protocol",  "grove.sol",      900, 25.0, "soon",     "Thu 16:00",         0, "pro"),
    ("Pale Circuit",    "circuit.sol",   6000, 0.75, "ended",    "Sold out in 4m", 6000, "play"),
    ("Iron Liturgy",    "anvil.sol",     2500, 3.10, "ended",    "Sold out in 22m",2500, "play"),
]


def main():
    src = os.path.join(HERE, "data.json")
    if not os.path.exists(src):
        raise SystemExit("data.json missing — run fetch_listings.py first")

    data = json.load(open(src))
    imgs = []
    for c in data["collections"]:
        for it in c["items"]:
            imgs.append(it["img"])
    if len(imgs) < len(DROPS):
        raise SystemExit("not enough artwork in data.json")

    # spread the picks so adjacent drops don't look alike
    step = max(1, len(imgs) // len(DROPS))
    drops = []
    for i, (name, by, supply, price, state, when, minted, lane) in enumerate(DROPS):
        drops.append({
            "name": name, "by": by, "supply": supply, "price": price,
            "state": state, "when": when, "minted": minted, "lane": lane,
            "img": imgs[(i * step) % len(imgs)],
        })

    payload = {"drops": drops, "reveal": imgs[:12]}
    template = open(os.path.join(HERE, "template_launch.html"), encoding="utf-8").read()
    assert "__BLOB__" in template, "template_launch.html is missing __BLOB__"
    open(OUT, "w", encoding="utf-8").write(
        template.replace("__BLOB__", json.dumps(payload, separators=(",", ":"))))

    live = sum(1 for d in drops if d["state"] == "live")
    print("drops: %d  (%d live, %d upcoming, %d ended)" % (
        len(drops), live,
        sum(1 for d in drops if d["state"] == "soon"),
        sum(1 for d in drops if d["state"] == "ended")))
    print("written: %s  (%.0f KB)" % (os.path.normpath(OUT), os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
