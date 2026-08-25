import { NextResponse } from 'next/server';
import { buyNow, type Listing } from '@/lib/me';

export async function POST(req: Request) {
  const body = (await req.json()) as { buyer?: string; listing?: Listing };
  if (!body.buyer || !body.listing) {
    return NextResponse.json({ ok: false, reason: 'error', detail: 'Missing buyer or listing.' }, { status: 400 });
  }
  return NextResponse.json(await buyNow({ buyer: body.buyer, listing: body.listing }));
}
