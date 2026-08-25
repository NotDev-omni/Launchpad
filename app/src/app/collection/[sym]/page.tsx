'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction, Transaction } from '@solana/web3.js';

type Listing = {
  tokenMint: string;
  price: number;
  seller: string;
  auctionHouse: string;
  tokenATA: string;
  sellerReferral: string;
  sellerExpiry: number;
  name: string;
  image: string;
  rank: number | null;
  isPool: boolean;
};

const BANDS: [number, string, string][] = [
  [100, 'Godly', '--r7'],
  [400, 'Mythic', '--r6'],
  [1000, 'Legendary', '--r5'],
  [2000, 'Epic', '--r4'],
  [4000, 'Rare', '--r3'],
  [7000, 'Uncommon', '--r2'],
];
function band(rank: number | null) {
  if (rank == null) return { k: 'Unranked', v: '--r1' };
  for (const [max, k, v] of BANDS) if (rank <= max) return { k, v };
  return { k: 'Common', v: '--r1' };
}

export default function CollectionPage({ params }: { params: Promise<{ sym: string }> }) {
  const { sym } = use(params);
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [items, setItems] = useState<Listing[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/listings/${sym}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        return d;
      })
      .then((d) => setItems(d.listings))
      .catch((e) => setErr(e.message));
  }, [sym]);

  async function buy(l: Listing) {
    setMsg(null);
    if (!publicKey || !signTransaction) {
      setMsg({ kind: 'warn', text: 'Connect a wallet first — the buy needs a signer.' });
      return;
    }
    setBusy(l.tokenMint);
    try {
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ buyer: publicKey.toBase58(), listing: l }),
      });
      const out = await res.json();

      if (!out.ok) {
        setMsg({ kind: out.reason === 'needs_api_key' ? 'warn' : 'err', text: out.detail });
        return;
      }

      // Real transaction from Magic Eden — deserialise and hand to the wallet.
      const raw = Buffer.from(out.tx, 'base64');
      let tx: Transaction | VersionedTransaction;
      try {
        tx = VersionedTransaction.deserialize(raw);
      } catch {
        tx = Transaction.from(raw);
      }
      const signed = await signTransaction(tx as never);
      const sig = await connection.sendRawTransaction((signed as never as VersionedTransaction).serialize());
      setMsg({ kind: 'ok', text: `Sent. Signature ${sig.slice(0, 20)}…` });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Buy failed.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div style={{ margin: '18px 0' }}>
        <Link href="/" className="btn ghost" style={{ padding: '7px 14px', fontSize: '.8rem' }}>
          ← All collections
        </Link>
      </div>

      <h1 style={{ fontSize: '1.6rem' }}>{sym.replace(/_/g, ' ')}</h1>
      <p className="sub">
        {items ? `${items.length} live asks · ${items.filter((i) => i.isPool).length} are AMM pool listings` : 'Loading live asks…'}
      </p>

      {err && <div className="err">Could not load listings: {err}</div>}

      {msg && (
        <div
          className={msg.kind === 'err' ? 'err' : 'note'}
          style={{ margin: '14px 0', ...(msg.kind === 'ok' ? { background: 'rgba(53,201,155,.12)' } : {}) }}
        >
          {msg.text}
        </div>
      )}

      {!items && !err && (
        <div className="igrid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skel" style={{ height: 240 }} />
          ))}
        </div>
      )}

      {items && (
        <div className="igrid">
          {items.map((l) => {
            const b = band(l.rank);
            return (
              <div key={l.tokenMint} className="it" style={{ ['--tc' as string]: `var(${b.v})` }}>
                <div className="art">
                  {/* plain img: NFT art lives on many hosts and Next/Image would need each allowlisted */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image} alt={l.name} loading="lazy" />
                  <span className="tier">{b.k}</span>
                  {l.isPool && <span className="pool">POOL</span>}
                </div>
                <div className="info">
                  <span className="n">{l.name}</span>
                  {l.rank != null && <span className="rk">rank {l.rank}</span>}
                  <span className="p">{l.price.toFixed(3)} ◎</span>
                  <button
                    className="btn"
                    style={{ marginTop: 6, width: '100%' }}
                    disabled={busy === l.tokenMint}
                    onClick={() => buy(l)}
                  >
                    {busy === l.tokenMint ? 'Building…' : 'Buy now'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sec" style={{ marginBottom: 40 }}>
        <div className="note">
          <b>What happens when you hit Buy.</b> The app posts the listing to its own API route, which asks
          Magic Eden to build an unsigned transaction, hands it back, deserialises it, and passes it to your
          wallet to sign. Two things can stop it and the UI says which: a pool listing needs the AMM
          instruction instead, and the transaction builder returns <b>401</b> unless <code>ME_API_KEY</code> is
          set. Reading listings needs no key at all.
        </div>
      </div>
    </>
  );
}
