'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';

type Coll = {
  symbol: string;
  name: string;
  cat: string;
  floorPrice: number;
  listedCount: number;
  volume7d: number;
  avgPrice24hr: number;
  preview: string[];
  ok: boolean;
};

const sol = (n: number) =>
  n < 10 ? n.toFixed(3) : n < 1000 ? n.toFixed(1) : Math.round(n).toLocaleString();

/** Banner = a row of the collection's own artwork. No compositing step needed. */
function Strip({ imgs, n = 5 }: { imgs: string[]; n?: number }) {
  const use = imgs.length ? Array.from({ length: n }, (_, i) => imgs[i % imgs.length]) : [];
  return (
    <span className="strip-img">
      {use.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
      ))}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const [cols, setCols] = useState<Coll[] | null>(null);
  const [cat, setCat] = useState('All');
  const [cur, setCur] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/collections')
      .then((r) => r.json())
      .then((d) => setCols(d.collections))
      .catch(() => setCols([]));
  }, []);

  const withArt = (cols ?? []).filter((c) => c.ok && c.preview.length);
  const feat = withArt.slice(0, 5);

  useEffect(() => {
    if (feat.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer.current = setInterval(() => setCur((c) => (c + 1) % feat.length), 6500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [feat.length]);

  const cats = ['All', ...Array.from(new Set((cols ?? []).map((c) => c.cat)))];
  const shown = (cols ?? []).filter((c) => cat === 'All' || c.cat === cat);

  const sidebar = (
    <>
      <div className="hd">
        <span>Collection</span>
        <span>Floor</span>
      </div>
      {(cols ?? []).map((c, i) => (
        <button key={c.symbol} className="sr" onClick={() => router.push(`/collection/${c.symbol}`)}>
          <span className="i">{i + 1}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.preview[0] ?? ''} alt="" loading="lazy" />
          <span className="n">{c.name}</span>
          <span className="a">{c.ok ? `${sol(c.floorPrice)} ◎` : '—'}</span>
        </button>
      ))}
    </>
  );

  return (
    <Shell side={cols ? sidebar : null}>
      {/* hero carousel */}
      <div className="hero">
        {feat.length === 0 && <div className="skel" style={{ position: 'absolute', inset: 0 }} />}
        {feat.map((c, i) => (
          <div
            key={c.symbol}
            className={`slide${i === cur ? ' on' : ''}`}
            onClick={() => router.push(`/collection/${c.symbol}`)}
          >
            <Strip imgs={c.preview} />
            <span className="veil" />
            <div className="body">
              <div className="nm">{c.name}</div>
              <div className="by">
                {c.cat} · {c.listedCount.toLocaleString()} listed on Solana
              </div>
              <div className="strip">
                <div>
                  <div className="k">Floor price</div>
                  <div className="v">{sol(c.floorPrice)} ◎</div>
                </div>
                <div>
                  <div className="k">7d volume</div>
                  <div className="v">{sol(c.volume7d)} ◎</div>
                </div>
                <div>
                  <div className="k">24h avg</div>
                  <div className="v">{c.avgPrice24hr ? `${sol(c.avgPrice24hr)} ◎` : '—'}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {feat.length > 1 && (
          <>
            <div className="hnav">
              <button
                aria-label="Previous"
                onClick={(e) => {
                  e.stopPropagation();
                  setCur((c) => (c - 1 + feat.length) % feat.length);
                }}
              >
                ‹
              </button>
              <button
                aria-label="Next"
                onClick={(e) => {
                  e.stopPropagation();
                  setCur((c) => (c + 1) % feat.length);
                }}
              >
                ›
              </button>
            </div>
            <div className="dots">
              {feat.map((_, i) => (
                <i
                  key={i}
                  className={i === cur ? 'on' : ''}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCur(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="banner">
        <span className="dot" />
        <span>
          Live from the Magic Eden API ·{' '}
          <b>
            {(cols ?? []).filter((c) => c.ok).length} of {(cols ?? []).length}
          </b>{' '}
          collections responding
        </span>
        <span className="grow" />
        <span style={{ fontSize: '.8rem' }}>Prices refresh every 60s</span>
      </div>

      <div className="sec">
        <h2>Explore collections</h2>
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

        {!cols ? (
          <div className="cgrid2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skel" style={{ aspectRatio: '1.1' }} />
            ))}
          </div>
        ) : (
          <div className="cgrid2">
            {shown.map((c) => (
              <a
                key={c.symbol}
                className="ccard"
                onClick={() => router.push(`/collection/${c.symbol}`)}
              >
                <Strip imgs={c.preview} n={3} />
                <span className="ov" />
                <span className="txt">
                  <span className="cat">{c.cat}</span>
                  <span className="n">{c.name}</span>
                  <span className="f">
                    {c.ok ? (
                      <>
                        Floor <b>{sol(c.floorPrice)} ◎</b> · {c.listedCount.toLocaleString()} listed
                      </>
                    ) : (
                      'stats rate limited'
                    )}
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="sec">
        <div className="note">
          <b>This is the real app, not the prototype.</b> Every floor, listing count and piece of
          artwork above is fetched live through a server-side route — no API key in the browser, no
          CORS. Connect a wallet and it reads your actual balance. Open a collection for live asks
          and a real buy attempt.
        </div>
      </div>
    </Shell>
  );
}
