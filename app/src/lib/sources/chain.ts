/**
 * On-chain asset indexer. SERVER-SIDE ONLY.
 *
 * Reads NFT data straight from Solana + decentralised storage instead of the
 * Magic Eden API. Deliberately emits the SAME shapes as `src/lib/me.ts` so the two
 * are interchangeable and the existing ME integration is untouched.
 *
 * Decodes Metaplex Token Metadata by hand rather than pulling in
 * @metaplex-foundation/mpl-token-metadata — the layout is stable, and this keeps the
 * dependency surface (and bundle) small.
 *
 * SCOPE, honestly:
 *   works now  — asset metadata, creators, collection membership, artwork URI,
 *                attributes, royalties. Runs on a plain RPC.
 *   needs more — listings/floor (decode marketplace program accounts, see notes at
 *                the bottom), volume/history (transaction ingestion), compressed
 *                NFTs (Merkle trees; unreadable via getAccountInfo, needs DAS).
 */

import { Connection, PublicKey } from '@solana/web3.js';

export const TOKEN_METADATA_PROGRAM = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

/** Gateways tried in order. Arweave and IPFS both flake; one gateway is not enough. */
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];
const ARWEAVE_GATEWAYS = ['https://arweave.net/', 'https://ar-io.net/'];

export type OnChainMetadata = {
  mint: string;
  updateAuthority: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: { address: string; verified: boolean; share: number }[];
  /** Metaplex Certified Collection, if the asset declares one. */
  collection: { key: string; verified: boolean } | null;
  primarySaleHappened: boolean;
  isMutable: boolean;
};

export type OffChainMetadata = {
  image: string;
  description: string;
  attributes: { trait_type: string; value: string }[];
  /** Where the JSON actually came from — S3 and CDNs are common, not just IPFS/Arweave. */
  storage: 'arweave' | 'ipfs' | 'http';
};

export function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM,
  )[0];
}

/** Borsh cursor over the Metadata account. */
class Cursor {
  constructor(private d: Buffer, private o = 0) {}
  u8() { return this.d.readUInt8(this.o++); }
  bool() { return this.u8() === 1; }
  u16() { const v = this.d.readUInt16LE(this.o); this.o += 2; return v; }
  u32() { const v = this.d.readUInt32LE(this.o); this.o += 4; return v; }
  pubkey() { const v = new PublicKey(this.d.subarray(this.o, this.o + 32)); this.o += 32; return v; }
  /** Fixed-capacity strings are null-padded on chain. */
  str() {
    const len = this.u32();
    const s = this.d.subarray(this.o, this.o + len).toString('utf8').replace(/\0+$/, '');
    this.o += len;
    return s;
  }
  option<T>(read: () => T): T | null {
    return this.bool() ? read() : null;
  }
}

export function decodeMetadata(data: Buffer): OnChainMetadata {
  const c = new Cursor(data);
  c.u8(); // key discriminator
  const updateAuthority = c.pubkey();
  const mint = c.pubkey();
  const name = c.str();
  const symbol = c.str();
  const uri = c.str();
  const sellerFeeBasisPoints = c.u16();

  const creators =
    c.option(() => {
      const n = c.u32();
      return Array.from({ length: n }, () => ({
        address: c.pubkey().toBase58(),
        verified: c.bool(),
        share: c.u8(),
      }));
    }) ?? [];

  const primarySaleHappened = c.bool();
  const isMutable = c.bool();
  c.option(() => c.u8()); // editionNonce
  c.option(() => c.u8()); // tokenStandard
  const collection = c.option(() => {
    const verified = c.bool();
    return { key: c.pubkey().toBase58(), verified };
  });

  return {
    mint: mint.toBase58(),
    updateAuthority: updateAuthority.toBase58(),
    name,
    symbol,
    uri,
    sellerFeeBasisPoints,
    creators,
    collection,
    primarySaleHappened,
    isMutable,
  };
}

/** Turn ipfs:// / ar:// / bare CIDs into concrete URLs, most-likely first. */
export function resolveUri(uri: string): { urls: string[]; storage: OffChainMetadata['storage'] } {
  const u = uri.trim();

  if (u.startsWith('ipfs://')) {
    const path = u.slice('ipfs://'.length).replace(/^ipfs\//, '');
    return { urls: IPFS_GATEWAYS.map((g) => g + path), storage: 'ipfs' };
  }
  if (u.startsWith('ar://')) {
    const id = u.slice('ar://'.length);
    return { urls: ARWEAVE_GATEWAYS.map((g) => g + id), storage: 'arweave' };
  }
  // Already a gateway URL — keep it, but add siblings as fallbacks.
  for (const g of ARWEAVE_GATEWAYS) {
    if (u.startsWith(g)) {
      const id = u.slice(g.length);
      return { urls: [u, ...ARWEAVE_GATEWAYS.filter((x) => x !== g).map((x) => x + id)], storage: 'arweave' };
    }
  }
  for (const g of IPFS_GATEWAYS) {
    if (u.startsWith(g)) {
      const id = u.slice(g.length);
      return { urls: [u, ...IPFS_GATEWAYS.filter((x) => x !== g).map((x) => x + id)], storage: 'ipfs' };
    }
  }
  if (/^[A-Za-z0-9]{43,}$/.test(u)) {
    return { urls: ARWEAVE_GATEWAYS.map((g) => g + u), storage: 'arweave' };
  }
  // Plenty of real collections host on S3 or their own CDN. Not decentralised, but valid.
  return { urls: [u], storage: 'http' };
}

async function fetchJsonWithFallback(urls: string[], timeoutMs = 12_000) {
  let lastErr = 'no urls';
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
      return await res.json();
    } catch (e) {
      lastErr = e instanceof Error ? e.name : 'error';
    }
  }
  throw new Error(`all gateways failed (${lastErr})`);
}

export async function fetchOffChain(uri: string): Promise<OffChainMetadata> {
  const { urls, storage } = resolveUri(uri);
  const j = await fetchJsonWithFallback(urls);
  const image: string = j.image ?? j.image_url ?? j.properties?.files?.[0]?.uri ?? '';
  return {
    // The image itself can be an ipfs:// URI too.
    image: image ? resolveUri(image).urls[0] : '',
    description: j.description ?? '',
    attributes: Array.isArray(j.attributes) ? j.attributes : [],
    storage,
  };
}

export type IndexedAsset = OnChainMetadata & {
  offChain: OffChainMetadata | null;
  offChainError: string | null;
};

/** Full record for one mint, straight from chain + storage. No third-party API. */
export async function indexAsset(conn: Connection, mintStr: string): Promise<IndexedAsset> {
  const mint = new PublicKey(mintStr);
  const info = await conn.getAccountInfo(metadataPda(mint));
  if (!info) throw new Error('no metadata account — wrong mint, or a compressed NFT (needs DAS)');

  const meta = decodeMetadata(info.data as Buffer);
  try {
    return { ...meta, offChain: await fetchOffChain(meta.uri), offChainError: null };
  } catch (e) {
    return {
      ...meta,
      offChain: null,
      offChainError: e instanceof Error ? e.message : 'unknown',
    };
  }
}

/** Index many mints with bounded concurrency — RPCs rate-limit just like ME does. */
export async function indexAssets(
  conn: Connection,
  mints: string[],
  limit = 5,
): Promise<(IndexedAsset | { mint: string; error: string })[]> {
  const out = new Array(mints.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= mints.length) return;
      try {
        out[i] = await indexAsset(conn, mints[i]);
      } catch (e) {
        out[i] = { mint: mints[i], error: e instanceof Error ? e.message : 'unknown' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, mints.length) }, worker));
  return out;
}

/* ---------------------------------------------------------------------------
 * NOT YET IMPLEMENTED — and why, so nobody assumes these are cheap.
 *
 * Listings & floor price
 *   Live in marketplace program accounts, e.g. Magic Eden M2
 *   M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K. Reachable via
 *   getProgramAccounts + a memcmp filter on the sell-order discriminator, then
 *   decoding price/seller/mint. Two catches: public RPCs refuse or throttle
 *   getProgramAccounts on programs this large, and each marketplace has its own
 *   layout, so "the floor" means union-ing ME + Tensor + others yourself.
 *
 * Volume & history
 *   Not in account state at all. Requires ingesting transactions —
 *   getSignaturesForAddress polling, Helius webhooks, or a Yellowstone/Geyser
 *   plugin — parsing sale instructions, and storing them. This is the part that
 *   is a real data pipeline, not a function.
 *
 * Compressed NFTs
 *   State lives in Merkle trees, not accounts. getAccountInfo returns nothing.
 *   Needs the DAS API (Helius/Triton) or self-indexing Bubblegum logs.
 * ------------------------------------------------------------------------- */
