import { NextResponse } from 'next/server';
import { getStats } from '@/lib/me';
import { COLLECTIONS } from '@/lib/collections';

export const revalidate = 60;

export async function GET() {
  const out = await Promise.all(
    COLLECTIONS.map(async (c) => {
      try {
        const s = await getStats(c.symbol);
        return { ...c, ...s, ok: true as const };
      } catch (e) {
        // One collection failing (usually a 429) must not blank the whole page.
        return { ...c, floorPrice: 0, listedCount: 0, volume7d: 0, avgPrice24hr: 0, ok: false as const };
      }
    }),
  );
  return NextResponse.json({ collections: out.sort((a, b) => b.volume7d - a.volume7d) });
}
