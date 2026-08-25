import { NextResponse } from 'next/server';
import { getStats, getPreview } from '@/lib/me';
import { COLLECTIONS } from '@/lib/collections';

export const revalidate = 60;

export async function GET() {
  const out = await Promise.all(
    COLLECTIONS.map(async (c) => {
      try {
        // stats and artwork in parallel; a failure in either must not blank the card
        const [s, preview] = await Promise.all([getStats(c.symbol), getPreview(c.symbol, 5)]);
        return { ...c, ...s, preview, ok: true as const };
      } catch {
        return {
          ...c, floorPrice: 0, listedCount: 0, volume7d: 0, avgPrice24hr: 0,
          preview: [] as string[], ok: false as const,
        };
      }
    }),
  );
  return NextResponse.json({ collections: out.sort((a, b) => b.volume7d - a.volume7d) });
}
