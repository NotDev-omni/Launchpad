import { NextResponse } from 'next/server';
import { providerHealth } from '@/lib/rpc';
import { sourceHealth } from '@/lib/sources/registry';

export const dynamic = 'force-dynamic';

/** Which RPC providers and market-data sources are configured and reachable. */
export async function GET() {
  const rpc = providerHealth();
  const market = sourceHealth();
  return NextResponse.json({
    rpc: {
      providers: rpc,
      dasCapable: rpc.filter((p) => p.das).map((p) => p.name),
      // A single usable RPC is a single point of failure, which is what this design exists to avoid.
      redundant: rpc.filter((p) => p.status === 'up').length > 1,
    },
    market: {
      sources: market,
      usable: market.filter((s) => s.status === 'live' && s.implemented).map((s) => s.name),
      redundant: market.filter((s) => s.status === 'live' && s.implemented).length > 1,
    },
  });
}
