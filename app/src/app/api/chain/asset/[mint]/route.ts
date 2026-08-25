import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { indexAsset } from '@/lib/sources/chain';

export const revalidate = 300;

/**
 * On-chain asset lookup. Independent of the Magic Eden API — reads the Metaplex
 * metadata account and then the JSON from wherever it lives (Arweave/IPFS/HTTP).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  try {
    const asset = await indexAsset(new Connection(rpc, 'confirmed'), mint);
    return NextResponse.json({ source: 'chain', rpc: new URL(rpc).host, asset });
  } catch (e) {
    return NextResponse.json(
      { source: 'chain', error: e instanceof Error ? e.message : 'unknown' },
      { status: 502 },
    );
  }
}
