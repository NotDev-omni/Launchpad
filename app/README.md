# Trove — the real app

Next.js 15 + `@solana/wallet-adapter`. This is the working application, as opposed to
the static prototypes in `../directions/`.

```bash
npm install
cp .env.example .env.local     # optional but recommended
npm run dev                    # http://localhost:3000
```

## What actually works

- **Real wallet connect** — Phantom, Solflare, and anything Wallet Standard exposes.
  Your real SOL balance is read from the RPC and shown in the header.
- **Live listing data** — collection stats and asks are fetched from Magic Eden
  through *server-side* API routes, so no key touches the browser and there's no CORS
  problem. Prices are current, not a snapshot.
- **A real buy path** — pressing Buy posts the listing to `/api/buy`, which asks Magic
  Eden to build an unsigned transaction, returns it, and the page deserialises it and
  hands it to your wallet to sign.

## What stops a buy, and why the UI says so

Two things, both surfaced as messages rather than silent failures:

| Condition | What happens |
|---|---|
| `ME_API_KEY` not set | `/v2/instructions/buy_now` returns **401**. Reading listings is keyless; *building a transaction* is not. |
| Listing is an AMM pool ask | No auction-house account, so it fills through the pool program — a different instruction, not wired up. Pool asks are badged `POOL` in the grid. |

Roughly a third of real asks are pool listings, so this is not an edge case. An
aggregator that assumes one fill path silently breaks on them.

## Environment

```
NEXT_PUBLIC_RPC_URL=   # Helius or similar. The public endpoint is heavily rate limited.
ME_API_KEY=            # only needed to build buy transactions
```

`NEXT_PUBLIC_` is browser-visible by design (it's just an RPC URL). `ME_API_KEY` is
server-only — it is read in `src/lib/me.ts`, which must never be imported into a
`'use client'` component.

## Layout

```
src/
  app/
    page.tsx                    marketplace — live collection stats
    collection/[sym]/page.tsx   live asks + buy flow
    drops/page.tsx              placeholder; see "Not ported yet"
    providers.tsx               wallet + RPC context
    api/
      collections/route.ts      stats for every indexed collection
      listings/[sym]/route.ts   live asks for one collection
      buy/route.ts              builds the unsigned buy transaction
  components/TopBar.tsx         nav, balance, connect button
  lib/
    me.ts                       Magic Eden client — SERVER ONLY
    collections.ts              which collections are indexed
```

Add or remove collections by editing `src/lib/collections.ts`.

## Not ported yet

The **drops calendar, crate-opening mint, and the four-screen creator Studio** exist as
finished static prototypes in `../directions/06-launchpad.html`. They aren't in this app
yet because minting needs an on-chain program, which needs the **Solana CLI and Anchor** —
neither is installed here, and on Windows both realistically want WSL.

Order of work to finish it:

1. `npm run build` and deploy this to Vercel — the marketplace half is done.
2. Install Solana CLI + Anchor under WSL, write the crate program, deploy to devnet.
3. Port the Studio wizard, pointing "Deploy" at the program.
4. Port the drops calendar, reading real drop state from the program.
5. Wire the crate reveal to the program's randomness rather than `Math.random()`.


## Adding collections

`src/lib/collections.ts` is a curated list, ranked at runtime by live 7d volume.

It's curated because Magic Eden's **keyless tier has no working ranked endpoint**:
`/v2/marketplace/popular_collections` returns `[]` for every timeRange,
`leaderboard` and `marketplace/collections` return 400, and `/v2/collections` is
unranked (arbitrary order, mostly obscure collections).

To add candidates, put them in `scripts/probe-collections.mjs` and run:

```bash
node scripts/probe-collections.mjs
```

It checks which symbols resolve to a real floor, backs off on 429s, and prints a
block ready to paste in. 28 of 38 candidates resolved on the last run.

The list can grow freely — `/api/collections` fetches with **bounded concurrency**
(`mapLimit`, 4 in flight). 27 collections x 2 requests completes in ~14s with zero
rate limiting; `Promise.all` over the same list gets 429'd immediately.

`EXCLUDE` at the top of the file hides a symbol without deleting it.

## Gotcha: never run `build` while `dev` is running

`npm run dev` and `npm run build` share the same `.next/` directory. Running a build —
or deleting `.next` — while the dev server is up pulls the ground out from under it.
The symptom is nasty because the page still *loads*: it just serves a stylesheet with
`globals.css` missing, so everything renders unstyled. The logo SVG has no size
constraint and fills the entire screen.

If the page looks wildly broken, that's almost always this. Fix:

```bash
# stop the dev server first, then
rm -rf .next && npm run dev
```

## Gotcha: only ever ONE copy of `@solana/wallet-adapter-react`

Symptom — hundreds of these at runtime, even though `WalletProvider` clearly *is* an
ancestor:

```
Error: You have tried to read "publicKey" on a WalletContext without providing one.
  at BaseWalletMultiButton
```

Cause is the dual-package hazard. React Context identity is per *module instance*. If
two copies of `wallet-adapter-react` end up in the tree, there are two distinct
`WalletContext` objects: your provider fills one, the button reads the other and finds
it empty.

It happened here because `package.json` pinned `0.15.35` while
`@solana/wallet-adapter-base-ui` depends on `^0.15.39`, so npm nested a second copy:

```
node_modules/@solana/wallet-adapter-react                                    0.15.35
node_modules/@solana/wallet-adapter-base-ui/node_modules/@solana/…-react     0.15.39
```

Fixed by matching the dependency to `^0.15.39` **and** adding an `overrides` entry.
Check after any adapter bump:

```bash
npm ls @solana/wallet-adapter-react     # must show exactly one version
```

## Gotcha: React 18 vs 19 types

`@solana/wallet-adapter-*` ships its own nested `@types/react` (v18). Against React 19
that produces:

```
error TS2786: 'ConnectionProvider' cannot be used as a JSX component.
```

Fixed by the `overrides` block in `package.json`, which forces a single `@types/react`
across the whole tree. **Don't remove it** — and if you bump React or the wallet
adapters, bump the override to match or this comes straight back.

## Caching

`src/lib/me.ts` keeps a 60s in-process cache because Magic Eden rate-limits hard
(HTTP 429) and dev hot-reload will otherwise hammer it. If you see empty stats, that's
almost always a 429 — the UI marks those collections rather than showing a false zero.
