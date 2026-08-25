/**
 * Multi-provider RPC with automatic failover. SERVER-SIDE ONLY.
 *
 * Order is Alchemy -> Helius -> public mainnet. Any provider that errors or times out
 * is marked unhealthy and skipped for a cooldown, so one bad provider degrades latency
 * once rather than on every request.
 *
 * Both Alchemy and Helius speak the Metaplex DAS API, so compressed NFTs work through
 * either. Alchemy's DAS is currently marked Beta by Alchemy — that is the reason Helius
 * is a configured fallback and not merely a nice-to-have.
 */

import { Connection } from '@solana/web3.js';

export type ProviderName = 'alchemy' | 'helius' | 'public';

export type Provider = {
  name: ProviderName;
  url: string;
  /** Does this endpoint implement the DAS API (needed for compressed NFTs)? */
  das: boolean;
};

const COOLDOWN_MS = 60_000;
const health = new Map<ProviderName, { failedAt: number; lastError: string }>();

export function providers(): Provider[] {
  const list: Provider[] = [];

  if (process.env.ALCHEMY_RPC_URL) {
    list.push({ name: 'alchemy', url: process.env.ALCHEMY_RPC_URL, das: true });
  }
  if (process.env.HELIUS_RPC_URL) {
    list.push({ name: 'helius', url: process.env.HELIUS_RPC_URL, das: true });
  }
  // Always last: no key needed, but heavily rate limited and no DAS.
  list.push({
    name: 'public',
    url: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
    das: false,
  });

  return list;
}

function healthy(p: Provider) {
  const h = health.get(p.name);
  return !h || Date.now() - h.failedAt > COOLDOWN_MS;
}

function markDown(p: Provider, err: unknown) {
  health.set(p.name, {
    failedAt: Date.now(),
    lastError: err instanceof Error ? err.message : String(err),
  });
}

function markUp(p: Provider) {
  health.delete(p.name);
}

export function providerHealth() {
  return providers().map((p) => {
    const h = health.get(p.name);
    return {
      name: p.name,
      host: safeHost(p.url),
      das: p.das,
      status: healthy(p) ? 'up' : 'cooling-down',
      lastError: h?.lastError ?? null,
      cooldownRemainingMs: h ? Math.max(0, COOLDOWN_MS - (Date.now() - h.failedAt)) : 0,
    };
  });
}

/** Never leak an API key that lives in the URL path or query. */
export function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

/**
 * Run `fn` against each healthy provider in order until one succeeds.
 * `needsDas` skips providers that cannot serve DAS methods.
 */
export async function withFailover<T>(
  fn: (conn: Connection, p: Provider) => Promise<T>,
  opts: { needsDas?: boolean; timeoutMs?: number } = {},
): Promise<{ result: T; provider: ProviderName; attempts: ProviderName[] }> {
  const { needsDas = false, timeoutMs = 15_000 } = opts;

  const candidates = providers().filter((p) => (needsDas ? p.das : true));
  if (!candidates.length) {
    throw new Error(
      needsDas
        ? 'No DAS-capable RPC configured. Set ALCHEMY_RPC_URL or HELIUS_RPC_URL — compressed NFTs cannot be read without one.'
        : 'No RPC configured.',
    );
  }

  // Healthy ones first, but still try cooling-down ones rather than fail outright.
  const ordered = [...candidates.filter(healthy), ...candidates.filter((p) => !healthy(p))];
  const attempts: ProviderName[] = [];
  let lastErr: unknown = new Error('no providers tried');

  for (const p of ordered) {
    attempts.push(p.name);
    try {
      const conn = new Connection(p.url, { commitment: 'confirmed', disableRetryOnRateLimit: true });
      const result = await withTimeout(fn(conn, p), timeoutMs);
      markUp(p);
      return { result, provider: p.name, attempts };
    } catch (e) {
      markDown(p, e);
      lastErr = e;
    }
  }

  throw new Error(
    `all RPC providers failed (${attempts.join(' -> ')}): ` +
      (lastErr instanceof Error ? lastErr.message : String(lastErr)),
  );
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}
