import { NextResponse } from 'next/server';
import { getListings } from '@/lib/me';

export const revalidate = 30;

export async function GET(_req: Request, ctx: { params: Promise<{ sym: string }> }) {
  const { sym } = await ctx.params;
  try {
    return NextResponse.json({ listings: await getListings(sym, 24) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json(
      { listings: [], error: msg === 'rate_limited' ? 'Magic Eden rate limited us. Try again shortly.' : msg },
      { status: msg === 'rate_limited' ? 429 : 502 },
    );
  }
}
