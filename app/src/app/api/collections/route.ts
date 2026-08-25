import { NextResponse } from 'next/server';
import { getStats, getPreview, mapLimit } from '@/lib/me';
import { COLLECTIONS } from '@/lib/collections';

export const revalidate = 120;

export async function GET() {
  // Bounded concurrency: firing 2 requests x N collections at once gets us 429'd.
  const out = await mapLimit(COLLECTIONS, 4, async (c) => {
    try {
      const s = await getStats(c.symbol);
      const preview = await getPreview(c.symbol, 5);
      return { ...c, ...s, preview, ok: true as const };
    } catch {
      return {
        ...c, floorPrice: 0, listedCount: 0, volume7d: 0, avgPrice24hr: 0,
        preview: [] as string[], ok: false as const,
      };
    }
  });

  // Live ones first, ranked by volume; unreachable ones sink to the bottom.
  out.sort((a, b) => Number(b.ok) - Number(a.ok) || b.volume7d - a.volume7d);
  return NextResponse.json({ collections: out });
}
