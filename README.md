# Trove — Solana Launchpad

Design prototypes for an NFT + token launchpad on Solana, built around a loot-crate
mint mechanic. Everything here is **static HTML** — no build step, no dependencies.
Open any file in `directions/` directly in a browser.

---

## Start here

| File | What it is |
|---|---|
| `directions/04-marketplace-live-data.html` | **The current direction.** Marketplace running on 48 real Solana listings. |
| `directions/03-marketplace-playful.html` | Same design language, synthetic data, includes the crate-opening animation. |
| `directions/02-marketplace-industrial.html` | Earlier dark/HUD direction. **Rejected** — kept for reference only. |
| `directions/01-crate-mechanic.html` | The crate mechanic pitch: reel animation, motion spec, reference board. |

`03` and `04` are the live direction. `01` and `02` are history — `01` still has the
best writeup of *why* the crate mechanic works, even though its visual style was dropped.

---

## Design system (directions 03 + 04)

**Type** — [Fredoka](https://fonts.google.com/specimen/Fredoka) for display,
[Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) for body. Both Google Fonts.

**Color** — all CSS custom properties on `:root`. Light is the default; dark is a deep
plum (`#161226`), never black.

```
--acc / --acc-deep     lane accent (grape by default, sky in Pro lane)
--r1 … --r7            rarity ladder: grey, mint, sky, grape, bubblegum, coral, gold
--bg --surface --border --text --text-dim --text-faint
```

**Theming is three-state, don't collapse it to two.** A viewer can be light, dark, or
"system" (no attribute set at all). Every token is defined in all three places:

```css
:root { /* complete light palette */ }
@media (prefers-color-scheme:dark) { :root:not([data-theme="light"]) { /* dark */ } }
:root[data-theme="dark"] { /* dark again, so the toggle wins */ }
```

Never declare a color *only* inside a media query or `[data-theme]` block — it won't
apply in the un-stamped system state and the page renders one theme's text on the
other theme's background.

**The signature detail** — buttons sit on a 4px colored ledge (`box-shadow: 0 4px 0
var(--acc-deep)`) and physically drop on `:active`. Keep this. It's the one thing that
makes the UI recognizably ours.

**Rounded, not blocky.** Radii `13 / 20 / 30px` + pills. Shadows are tinted violet, not
black. An earlier hard-edged/notched direction was explicitly rejected.

**Motion** — spring easing `cubic-bezier(.34,1.56,.64,1)`. Hover lifts cards ~7px.
Everything is wrapped in a `prefers-reduced-motion` guard; keep that.

---

## Refreshing the listing data

```bash
pip install pillow
cd data
python fetch_listings.py    # pulls live listings + artwork from Magic Eden
python gen.py               # rebuilds directions/04-marketplace-live-data.html
```

Edit `SYMBOLS` in `fetch_listings.py` to change which collections appear.

Artwork is downloaded, center-cropped, resized to 224px and embedded as base64 WEBP,
so the output page is fully self-contained and works offline. 48 listings ≈ 324 KB.

---

## What we verified about actually selling these

Tested against the live API in **August 2026**. Re-check before relying on it.

**Reading the orderbook is free and keyless.** Every price, seller wallet, mint address
and auction-house account in `data.json` came from unauthenticated calls:

```
GET /v2/collections/{symbol}/stats        200
GET /v2/collections/{symbol}/listings     200
```

**Executing a fill is not.** The instruction builder that returns a signable buy
transaction requires an API key:

```
GET /v2/instructions/buy_now              401
```

So "list it and let people buy it from us" splits into two very different products:

1. **Aggregate other marketplaces** — free to read, but filling needs API keys and
   commercial terms per marketplace, and your fee stacks on top of theirs.
2. **Run your own orderbook** — deploy your own marketplace program, sellers list into
   your escrow, you keep the whole spread and nobody can gate you. The cost is a cold
   start: day one you have zero listings.

Most launchpads do both — own program for their own drops, aggregate everything else.

### Gotcha worth knowing before you write the integration

**Not every listing fills the same way.** 6 of the 48 listings in the current snapshot
have an **empty `auctionHouse`** field. Those are AMM/pool listings that fill against a
liquidity pool through a different instruction, not against a named seller.

An aggregator that assumes a single fill path silently breaks on roughly an eighth of
real listings. Branch on `if (!listing.ah)`. Open any CETS item in direction 04 to see
one flagged in the UI.

---

## These pages cannot transact

They are static HTML. No wallet, no signing, no live prices. `data.json` is a frozen
snapshot.

Making it real needs a proper app:

- **Next.js** (or Vite) on your own domain
- **`@solana/wallet-adapter`** for connect + signing
- **Helius** RPC + DAS API (DAS is how you read compressed NFTs)
- **Magic Eden or Tensor** API keys for aggregated asks
- **Your own Anchor program** for your own drops and crate opens
- **Switchboard VRF** if crate odds need to be verifiable on-chain

---

## Product decisions already made

- **Solana only** for v1.
- **Two lanes, hard split in the UI.** A permissionless "Play" lane (instant, loud,
  crate mechanic, risk shown inline) and a KYC-gated "Pro" lane (vesting, milestone
  escrow, audit status, Token-2022 extensions). The lane toggle in the header is a real
  mode switch — it changes accent color, density, and what the trust columns say.
- **Crate opening is the signature mechanic**, not a novelty. Reference is **Overwatch**
  (warm, bouncy, ~2s) — explicitly *not* CS:GO (cold, industrial, 6s).
- **Rarity ladder is the only saturated color** in the product, so color always means
  something.
- **Crates should be earned, not sold.** Paid randomized rewards are restricted in
  several jurisdictions (Belgium and the Netherlands outright). Earned crates dodge most
  of that and reward the behavior we want anyway. Get a lawyer before any paid crate ships.

---

## Good first tasks

1. Port direction 04 to a real Next.js app with wallet-adapter — the design is settled,
   it just needs a real runtime.
2. Wire the crate opener in `03` to a real program + VRF instead of `Math.random()`.
   Note the loot roll and the artwork PRNG are deliberately separate: artwork is seeded
   so items look stable, rolls are not.
3. Bring the ranking table and filter rail from `02` into the `03`/`04` visual language —
   they're the last pieces still wearing the rejected style.
4. Item detail page: traits, rarity rank, price history, offer book.
5. Creator "Studio" flow — the 60-second launch. This is where onboarding is won.
