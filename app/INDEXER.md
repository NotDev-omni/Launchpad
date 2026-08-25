# Independent on-chain indexer

Goal: stop depending on the Magic Eden API by reading the same data from Solana and
decentralised storage, in the same shapes, so the two sources are interchangeable.

**The existing ME integration is untouched.** `src/lib/me.ts` is unchanged; the new code
lives in `src/lib/sources/chain.ts` and its own route. Nothing switches over until you
choose to.

---

## Read this first: the RPC caveat

"Directly from the blockchain" still requires **an RPC provider**. You cannot talk to
Solana without one. Unless you run your own validator (~$500–1000/mo, plus ops), you are
swapping a dependency on Magic Eden for a dependency on Helius, Triton or QuickNode.

That is still a real win — RPC providers are commodities, interchangeable, and speak a
standard interface, whereas ME's API is proprietary with its own terms. But it is not
"no vendor", and the plan shouldn't be sold internally as such.

---

## Tier 1 — asset metadata · **built and working**

`src/lib/sources/chain.ts`, exposed at `GET /api/chain/asset/[mint]`.

Derives the Metaplex Token Metadata PDA, decodes the account by hand (no
`mpl-token-metadata` dependency — the layout is stable and this keeps the bundle small),
then fetches the JSON from wherever the `uri` points.

Verified against two live collections on the public RPC:

| | Mad Lads #7006 | Okay Bear #3822 |
|---|---|---|
| name / symbol | Mad Lads #7006 / MAD | Okay Bear #3822 / OKB |
| royalty | 420 bps | 500 bps |
| creators (verified) | 2 (2) | 2 (1) |
| collection | verified ✓ | verified ✓ |
| storage | **http (S3)** | **arweave** |
| attributes | 9 | 7 |

Cross-checked against the ME route for the same mint: `name`, `image` and `mint` are
**identical**. On-chain additionally exposes royalties, verified creators, the collection
key, mutability and full attributes — none of which ME's listing payload returns.

### Storage is not always decentralised

Worth correcting an assumption in the brief: **Mad Lads' metadata is on S3**, not IPFS or
Arweave. Plenty of major collections host on S3 or their own CDN. `resolveUri()` handles
`ipfs://`, `ar://`, bare Arweave tx ids and plain HTTPS, and reports which it was as
`storage: 'arweave' | 'ipfs' | 'http'` so you can see your real decentralisation ratio
rather than assume it.

Gateways flake constantly, so IPFS has four fallbacks and Arweave two, tried in order.

---

## Tier 2 — listings and floor price · **not built**

Listings live in marketplace program accounts. For Magic Eden that is M2:

```
M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K
```

Approach: `getProgramAccounts` with a `memcmp` filter on the sell-order discriminator,
then decode price / seller / mint / expiry. Two real obstacles:

1. **Public RPCs refuse or throttle `getProgramAccounts`** on programs this large. This
   needs a paid plan, ideally with `getProgramAccountsV2` or gRPC streaming.
2. **Every marketplace has its own layout.** A true floor price is the union of ME +
   Tensor + others, each decoded separately. Whoever owns this inherits that ongoing
   maintenance whenever a program upgrades.

Estimate: days, not hours, and it is the point where you need a paid RPC.

---

## Tier 3 — volume and history · **not built, and it's a pipeline**

Volume is not in account state anywhere. It only exists as transaction history, so it
must be ingested and stored:

- **Yellowstone/Geyser gRPC** — real-time, lowest latency, needs a dedicated node
- **Helius webhooks** — simplest, provider-coupled
- **`getSignaturesForAddress` polling** — cheapest, laggy, heavy backfill

Then parse sale instructions per marketplace program and write to your own database.
`volume7d` and `avgPrice24hr` become queries against that, not API calls.

This is the largest piece of the three and the one most often underestimated.

---

## Compressed NFTs — a hard blocker

cNFT state lives in **Merkle trees, not accounts**. `getAccountInfo` returns nothing;
`indexAsset` will throw `no metadata account`. Reading them requires either the **DAS
API** (Helius/Triton) or self-indexing Bubblegum logs, which means running the Tier 3
pipeline first.

If any target collection is compressed, budget for DAS separately.

---

## Suggested order

1. **Tier 1 for assets now** — already done. Point item detail pages at
   `/api/chain/asset/[mint]` and you have removed ME from that path entirely.
2. **Get a paid RPC** (Helius). Unblocks Tier 2 *and* gives DAS for cNFTs.
3. **Tier 2 for ME listings only.** Compare your computed floor against ME's for a week
   before trusting it.
4. **Add Tensor** once ME-only decoding is stable.
5. **Tier 3 last.** Until then, keep pulling volume from ME — one narrow, honest
   dependency beats a half-built pipeline.

## Interchangeability

Both sources emit the same shapes. Suggested next step is a thin resolver:

```ts
// src/lib/sources/index.ts
export async function getAsset(mint: string) {
  try { return await chain.indexAsset(conn, mint); }   // preferred
  catch { return await me.getAsset(mint); }            // fallback while Tier 2/3 land
}
```

Chain-first with ME as fallback lets you migrate per-field instead of all at once, and
keeps the site up if a gateway or RPC has a bad day.
