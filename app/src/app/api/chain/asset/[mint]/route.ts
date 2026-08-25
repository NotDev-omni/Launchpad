import { NextResponse } from 'next/server';
import { indexAsset } from '@/lib/sources/chain';
import { withFailover } from '@/lib/rpc';

export const revalidate = 300;

/**
 * On-chain asset lookup, independent of the Magic Eden API.
 * Goes through the multi-provider RPC layer, so a provider outage fails over
 * rather than failing the request.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  try {
    const { result, provider, attempts } = await withFailover((conn) => indexAsset(conn, mint));
    return NextResponse.json({ source: 'chain', provider, attempts, asset: result });
  } catch (e) {
    return NextResponse.json(
      { source: 'chain', error: e instanceof Error ? e.message : 'unknown' },
      { status: 502 },
    );
  }
}
