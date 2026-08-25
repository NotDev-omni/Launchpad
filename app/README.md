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

## Caching

`src/lib/me.ts` keeps a 60s in-process cache because Magic Eden rate-limits hard
(HTTP 429) and dev hot-reload will otherwise hammer it. If you see empty stats, that's
almost always a 429 — the UI marks those collections rather than showing a false zero.
