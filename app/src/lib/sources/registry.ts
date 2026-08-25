/**
 * Market-data source registry with failover. SERVER-SIDE ONLY.
 *
 * Listings, floors and volume come from marketplace aggregators. Each is wrapped as a
 * MarketSource so they are interchangeable and the app never depends on one.
 *
 * Provider status as verified in August 2026 — see INDEXER.md for the research:
 *
 *   magiceden   LIVE      reads keyless; buy-transaction building needs a key
 *   tensor      GATED     access is an application form, not self-serve signup
 *   simplehash  DEAD      acquired by Phantom Feb 2025, API sunset 27 Mar 2025
 *
 * SimpleHash cannot be integrated. The slot is kept, disabled, so nobody re-adds it
 * from the original plan without reading why.
 */

import type { Listing, Stats } from '@/lib/me';
import * as me from '@/lib/me';

export type SourceName = 'magiceden' | 'tensor' | 'simplehash';

export type SourceStatus = 'live' | 'needs-key' | 'gated' | 'dead';

export type MarketSource = {
  name: SourceName;
  status: SourceStatus;
  /** Why it is unavailable, shown in the health endpoint. */
  note?: string;
  getStats?: (symbol: string) => Promise<Stats>;
  getListings?: (symbol: string, limit?: number) => Promise<Listing[]>;
};

function tensorConfigured() {
  return Boolean(process.env.TENSOR_API_KEY);
}

export function sources(): MarketSource[] {
  return [
    {
      name: 'magiceden',
      status: 'live',
      getStats: me.getStats,
      getListings: me.getListings,
    },
    {
      name: 'tensor',
      status: tensorConfigured() ? 'live' : 'gated',
      note: tensorConfigured()
        ? undefined
        : 'Tensor API access is granted via an application form for traders and market-makers, ' +
          'not self-serve signup. Set TENSOR_API_KEY once approved and implement the adapter.',
      // Intentionally unimplemented: no key to develop or test against yet.
    },
    {
      name: 'simplehash',
      status: 'dead',
      note:
        'SimpleHash was acquired by Phantom in Feb 2025 and the standalone API was sunset ' +
        'on 27 Mar 2025. Not integrable. Replacement candidates: Birdeye (self-serve) or a ' +
        'DAS provider (Helius/QuickNode/Triton) for asset data.',
    },
  ];
}

export type SourceResult<T> = {
  data: T;
  source: SourceName;
  attempts: { source: SourceName; error?: string }[];
};

/** Try each usable source in order; first success wins. */
async function race<T>(
  pick: (s: MarketSource) => ((...a: never[]) => Promise<T>) | undefined,
  call: (fn: NonNullable<ReturnType<typeof pick>>) => Promise<T>,
): Promise<SourceResult<T>> {
  const attempts: { source: SourceName; error?: string }[] = [];

  for (const s of sources()) {
    const fn = pick(s);
    if (s.status === 'dead' || s.status === 'gated' || !fn) {
      attempts.push({ source: s.name, error: s.note ?? `status: ${s.status}` });
      continue;
    }
    try {
      const data = await call(fn);
      attempts.push({ source: s.name });
      return { data, source: s.name, attempts };
    } catch (e) {
      attempts.push({ source: s.name, error: e instanceof Error ? e.message : 'unknown' });
    }
  }

  throw new Error(
    'all market-data sources failed: ' +
      attempts.map((a) => `${a.source}(${a.error ?? 'ok'})`).join(', '),
  );
}

export function getStats(symbol: string) {
  return race<Stats>(
    (s) => s.getStats as never,
    (fn) => (fn as unknown as typeof me.getStats)(symbol),
  );
}

export function getListings(symbol: string, limit = 20) {
  return race<Listing[]>(
    (s) => s.getListings as never,
    (fn) => (fn as unknown as typeof me.getListings)(symbol, limit),
  );
}

export function sourceHealth() {
  return sources().map((s) => ({
    name: s.name,
    status: s.status,
    implemented: Boolean(s.getStats || s.getListings),
    note: s.note ?? null,
  }));
}
