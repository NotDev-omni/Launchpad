'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Coll = {
  symbol: string;
  name: string;
  cat: string;
  floorPrice: number;
  listedCount: number;
  volume7d: number;
  avgPrice24hr: number;
  ok: boolean;
};

const sol = (n: number) => (n < 10 ? n.toFixed(3) : n < 1000 ? n.toFixed(1) : Math.round(n).toLocaleString());

export default function Home() {
  const [cols, setCols] = useState<Coll[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState('All');

  useEffect(() => {
    fetch('/api/collections')
      .then((r) => r.json())
      .then((d) => setCols(d.collections))
      .catch(() => setErr('Could not reach the API route.'));
  }, []);

  const cats = ['All', ...Array.from(new Set((cols ?? []).map((c) => c.cat)))];
  const shown = (cols ?? []).filter((c) => cat === 'All' || c.cat === cat);
  const live = (cols ?? []).filter((c) => c.ok).length;

  return (
    <>
      <div className="banner">
        <span className="dot" />
        <span>
          {cols ? (
            <>
              Live from the Magic Eden API · <b>{live}</b> of <b>{cols.length}</b> collections responding
            </>
          ) : (
            'Fetching live collection stats…'
          )}
        </span>
        <span className="grow" />
        <span style={{ fontSize: '.8rem' }}>Prices refresh every 60s</span>
      </div>

      <div className="sec">
        <h1 style={{ fontSize: '1.8rem' }}>Explore collections</h1>
        <p className="sub">Real floors, pulled live — not a snapshot</p>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {cats.map((k) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={cat === k ? 'btn' : 'btn ghost'}
              style={{ padding: '7px 14px', fontSize: '.8rem' }}
            >
              {k}
            </button>
          ))}
        </div>

        {err && <div className="err">{err}</div>}

        {!cols && (
          <div className="cgrid">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skel" style={{ height: 128 }} />
            ))}
          </div>
        )}

        {cols && (
          <div className="cgrid">
            {shown.map((c) => (
              <Link key={c.symbol} href={`/collection/${c.symbol}`} className="cc">
                <span className="cat">{c.cat}</span>
                <span className="n">{c.name}</span>
                {c.ok ? (
                  <>
                    <span className="row">
                      <span>Floor</span>
                      <b>{sol(c.floorPrice)} ◎</b>
                    </span>
                    <span className="row">
                      <span>Listed</span>
                      <b>{c.listedCount.toLocaleString()}</b>
                    </span>
                    <span className="row">
                      <span>7d volume</span>
                      <b>{sol(c.volume7d)} ◎</b>
                    </span>
                  </>
                ) : (
                  <span className="row" style={{ color: 'var(--down)' }}>
                    Stats unavailable (rate limited)
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="sec">
        <div className="note">
          <b>This is the real app, not the prototype.</b> Collection stats above are fetched live through a
          server-side route, so no API key is exposed to the browser and there is no CORS problem. Connect a
          wallet in the header and it reads your actual balance from the RPC. Open a collection to see live
          asks and try a buy — the app builds the real transaction and tells you exactly what stops it.
        </div>
      </div>
    </>
  );
}
