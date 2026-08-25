"""
Build the launchpad half — drops calendar, mint flow, and the creator Studio wizard.

    python gen_launch.py

Reads artwork out of market.json (real on-chain art) purely as drop visuals, and
writes ../directions/06-launchpad.html.

Drop metadata (names, dates, supply, prices) is SYNTHETIC and labelled as such on the
page — these are launches that haven't happened, so there's nothing real to pull.
The artwork is real; the schedule is a sketch.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "directions", "06-launchpad.html")

# name, creator, supply, price, state, when(hours from now / label), minted, lane, cat
DROPS = [
    # live
    ("Vault Wardens",     "outpost.sol",   5000,  1.85, "live", 4.2,  1704, "play", "PFP"),
    ("Hollow Signal",     "deadlight.sol", 3333,  0.90, "live", 1.4,  2871, "play", "Art"),
    ("Meridian Reserve",  "meridian.sol",  1200, 12.00, "live", 9.8,   410, "pro",  "3D"),
    # upcoming — spread across hours/days
    ("Ferrous Kin",       "anvil.sol",     8888,  0.45, "soon", 6,       0, "play", "PFP"),
    ("Deep Cache",        "warden.sol",    4444,  2.20, "soon", 14,      0, "play", "3D"),
    ("Grove Protocol",    "grove.sol",      900, 25.00, "soon", 26,      0, "pro",  "3D"),
    ("Pixel Almanac",     "almanac.sol",   6400,  0.30, "soon", 33,      0, "play", "Pixel"),
    ("Tidal Foundry",     "tidal.sol",     2222,  3.40, "soon", 48,      0, "pro",  "Gaming"),
    ("Nocturne Cards",    "nocturne.sol",  5555,  1.10, "soon", 55,      0, "play", "Art"),
    ("Saffron Order",     "saffron.sol",   1111,  8.75, "soon", 72,      0, "pro",  "PFP"),
    ("Loom & Lantern",    "loom.sol",      3000,  0.65, "soon", 96,      0, "play", "Art"),
    ("Copper Wake",       "copper.sol",    7777,  0.85, "soon", 120,     0, "play", "3D"),
    ("Halcyon Engine",    "halcyon.sol",   1500, 14.00, "soon", 148,     0, "pro",  "Gaming"),
    ("Salt Flats",        "saltflat.sol",  4200,  1.95, "soon", 168,     0, "play", "Pixel"),
    ("Ember Cartel",      "ember.sol",     2600,  4.10, "soon", 200,     0, "play", "PFP"),
    # past
    ("Pale Circuit",      "circuit.sol",   6000,  0.75, "ended", "Sold out in 4m",  6000, "play", "Art"),
    ("Iron Liturgy",      "anvil.sol",     2500,  3.10, "ended", "Sold out in 22m", 2500, "play", "3D"),
    ("Quiet Harbour",     "harbour.sol",   3200,  1.40, "ended", "Sold out in 2h",  3200, "pro",  "PFP"),
    ("Ashen Vale",        "ashen.sol",     1800,  6.20, "ended", "96% minted",      1731, "play", "Gaming"),
]


def main():
    src = os.path.join(HERE, "market.json")
    if not os.path.exists(src):
        raise SystemExit("market.json missing — run fetch_wide.py first")

    data = json.load(open(src))
    imgs, banners = [], []
    for c in data["collections"]:
        banners.append(c["banner"])
        for it in c["items"]:
            imgs.append(it["img"])
    if len(imgs) < len(DROPS):
        raise SystemExit("not enough artwork in market.json")

    step = max(1, len(imgs) // len(DROPS))
    drops = []
    for i, (name, by, supply, price, state, when, minted, lane, cat) in enumerate(DROPS):
        drops.append({
            "name": name, "by": by, "supply": supply, "price": price,
            "state": state, "when": when, "minted": minted, "lane": lane, "cat": cat,
            "img": imgs[(i * step) % len(imgs)],
            "banner": banners[i % len(banners)],
        })

    payload = {"drops": drops, "reveal": imgs[:16]}
    template = open(os.path.join(HERE, "template_launch.html"), encoding="utf-8").read()
    assert "__BLOB__" in template, "template_launch.html is missing __BLOB__"
    open(OUT, "w", encoding="utf-8").write(
        template.replace("__BLOB__", json.dumps(payload, separators=(",", ":"))))

    def n(s):
        return sum(1 for d in drops if d["state"] == s)
    print("drops: %d  (%d live, %d upcoming, %d past)" % (len(drops), n("live"), n("soon"), n("ended")))
    print("written: %s  (%.0f KB)" % (os.path.normpath(OUT), os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
