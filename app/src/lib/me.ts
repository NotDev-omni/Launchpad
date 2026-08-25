/**
 * Magic Eden API client. SERVER-SIDE ONLY — never import this into a
 * 'use client' component.
 *
 * Read endpoints (stats, listings) are keyless. The instruction endpoints that
 * build a buy transaction are NOT — they return 401 without ME_API_KEY. That
 * split is the whole reason `buyNow` returns a discriminated result instead of
 * throwing: the UI needs to explain the gate, not just fail.
 */

const BASE = 'https://api-mainnet.magiceden.dev/v2';
const UA = { accept: 'application/json', 'user-agent': 'trove/0.1' };

export type Listing = {
  tokenMint: string;
  price: number;
  seller: string;
  auctionHouse: string;
  tokenATA: string;
  sellerReferral: string;
  sellerExpiry: number;
  name: string;
  image: string;
  rank: number | null;
  /** Empty auctionHouse => AMM/pool ask. Fills through a different program. */
  isPool: boolean;
};

export type Stats = {
  symbol: string;
  floorPrice: number;
  listedCount: number;
  volume7d: number;
  avgPrice24hr: number;
};

/** Small in-process cache. ME rate-limits hard (HTTP 429) and dev hot-reloads hammer it. */
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 60_000;
const STATS_TTL = 300_000;

async function get<T>(path: string, ttl = TTL): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.data as T;

  const res = await fetch(BASE + path, { headers: UA, cache: 'no-store' });
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(`me_${res.status}`);
  const data = (await res.json()) as T;
  cache.set(path, { at: Date.now(), data });
  return data;
}


/**
 * Run `fn` over `items` with bounded concurrency.
 * Promise.all over a large list fires every request at once and Magic Eden
 * answers with 429s. Four in flight is empirically fine.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function getStats(symbol: string): Promise<Stats> {
  const raw = await get<Record<string, number>>(`/collections/${symbol}/stats`, STATS_TTL);
  return {
    symbol,
    floorPrice: (raw.floorPrice ?? 0) / 1e9,
    listedCount: raw.listedCount ?? 0,
    volume7d: (raw.volume7d ?? 0) / 1e9,
    avgPrice24hr: (raw.avgPrice24hr ?? 0) / 1e9,
  };
}

export async function getListings(symbol: string, limit = 20): Promise<Listing[]> {
  const raw = await get<Record<string, any>[]>(
    `/collections/${symbol}/listings?offset=0&limit=${limit}`,
  );
  return raw
    .map((l) => {
      const tok = l.token ?? {};
      return {
        tokenMint: l.tokenMint ?? '',
        price: Number(l.price ?? 0),
        seller: l.seller ?? '',
        auctionHouse: l.auctionHouse ?? '',
        tokenATA: l.tokenAddress ?? '',
        sellerReferral: l.sellerReferral ?? '',
        sellerExpiry: Number(l.expiry ?? -1),
        name: tok.name ?? 'Unnamed',
        image: tok.image ?? l.extra?.img ?? '',
        rank: l.rarity?.moonrank?.rank ?? null,
        isPool: !l.auctionHouse,
      } as Listing;
    })
    .filter((l) => l.tokenMint && l.image && l.price > 0);
}


/** A few artwork URLs per collection, for cards and hero banners. */
export async function getPreview(symbol: string, n = 5): Promise<string[]> {
  try {
    const ls = await getListings(symbol, n);
    return ls.map((l) => l.image).filter(Boolean).slice(0, n);
  } catch {
    return [];
  }
}

export type BuyResult =
  | { ok: true; tx: string }
  | { ok: false; reason: 'needs_api_key' | 'pool_listing' | 'error'; detail: string };

/**
 * Ask Magic Eden to build an unsigned buy transaction.
 * Returns base64 the client can deserialise and hand to the wallet to sign.
 */
export async function buyNow(args: {
  buyer: string;
  listing: Listing;
}): Promise<BuyResult> {
  const { buyer, listing } = args;

  if (listing.isPool) {
    return {
      ok: false,
      reason: 'pool_listing',
      detail:
        'This is an AMM pool ask with no auction house. It fills through the pool ' +
        'program, not the auction-house instruction — a different code path that ' +
        'is not wired up here yet.',
    };
  }

  const key = process.env.ME_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason: 'needs_api_key',
      detail:
        'ME_API_KEY is not set. Magic Eden allows reading listings without a key, ' +
        'but /v2/instructions/buy_now returns 401 without one. Every other field ' +
        'needed for the fill is already present.',
    };
  }

  const qs = new URLSearchParams({
    buyer,
    seller: listing.seller,
    auctionHouseAddress: listing.auctionHouse,
    tokenMint: listing.tokenMint,
    tokenATA: listing.tokenATA,
    price: String(listing.price),
    sellerReferral: listing.sellerReferral,
    sellerExpiry: String(listing.sellerExpiry),
  });

  const res = await fetch(`${BASE}/instructions/buy_now?${qs}`, {
    headers: { ...UA, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      ok: false,
      reason: res.status === 401 ? 'needs_api_key' : 'error',
      detail: `Magic Eden returned HTTP ${res.status}.`,
    };
  }

  const json = (await res.json()) as { txSigned?: { data: number[] }; tx?: { data: number[] } };
  const bytes = json.txSigned?.data ?? json.tx?.data;
  if (!bytes) return { ok: false, reason: 'error', detail: 'No transaction in response.' };

  return { ok: true, tx: Buffer.from(bytes).toString('base64') };
}
