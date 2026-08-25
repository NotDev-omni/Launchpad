'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false, loading: () => <span className="btn" style={{ opacity: 0.5 }}>Connect</span> },
);

/** Same 9 destinations as the prototype's rail. `href` ones actually navigate. */
const RAIL: { label: string; d: string; href?: string }[] = [
  { label: 'Explore', d: 'M12 2 2 7l10 5 10-5z M2 17l10 5 10-5 M2 12l10 5 10-5', href: '/' },
  { label: 'Collections', d: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', href: '/' },
  { label: 'Tokens', d: 'M12 2a10 10 0 100 20 10 10 0 000-20 M12 6v12 M9 9h6 M9 15h6' },
  { label: 'Swap', d: 'M7 16V4 M3 8l4-4 4 4 M17 8v12 M13 16l4 4 4-4' },
  { label: 'Drops', d: 'M12 2s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z', href: '/drops' },
  { label: 'Activity', d: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { label: 'Rewards', d: 'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z' },
  { label: 'Studio', d: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z M2 2l7.5 7.5' },
  { label: 'Profile', d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8' },
];

export function Shell({ children, side }: { children: React.ReactNode; side?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [rpcErr, setRpcErr] = useState(false);

  useEffect(() => {
    if (!publicKey) return setBalance(null);
    let live = true;
    connection
      .getBalance(publicKey)
      .then((l) => live && (setBalance(l / LAMPORTS_PER_SOL), setRpcErr(false)))
      .catch(() => live && setRpcErr(true));
    return () => {
      live = false;
    };
  }, [publicKey, connection]);

  return (
    <>
      <nav className="rail">
        <Link href="/" aria-label="Trove home">
          <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="4" y="12" width="32" height="24" rx="8" style={{ fill: 'var(--acc)' }} />
            <rect x="4" y="12" width="32" height="8" rx="4" style={{ fill: 'var(--acc-2)' }} />
            <circle cx="15" cy="27" r="2.6" fill="#fff" />
            <circle cx="25" cy="27" r="2.6" fill="#fff" />
            <path d="M17 32 q3 2.4 6 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </Link>
        {RAIL.map((r, i) => (
          <button
            key={r.label}
            className={r.href === path || (i === 0 && path === '/') ? 'on' : ''}
            aria-label={r.label}
            onClick={() => r.href && router.push(r.href)}
            /* unrouted entries are honest about being unbuilt rather than dead */
            title={r.href ? r.label : `${r.label} — not built yet`}
          >
            <svg viewBox="0 0 24 24">
              <path d={r.d} />
            </svg>
            <span className="tip">{r.href ? r.label : `${r.label} · soon`}</span>
          </button>
        ))}
      </nav>

      <div className="top">
        <div className="search">
          <span style={{ color: 'var(--text-faint)' }}>🔍</span>
          <input placeholder="Search collections and items" aria-label="Search" />
          <kbd>/</kbd>
        </div>
        <span className="grow" />
        {publicKey && (
          <span className="bal">
            {rpcErr ? 'RPC limited' : balance === null ? 'loading…' : `${balance.toFixed(3)} ◎`}
          </span>
        )}
        <WalletMultiButton />
      </div>

      <div className="shell">
        <div style={{ minWidth: 0 }}>{children}</div>
        {side && <aside className="side">{side}</aside>}
      </div>

      <div className="status">
        <span className="live">
          <i />
          Live
        </span>
        <span>Aggregating</span>
        <span>Solana</span>
        <span className="grow" />
        <span>Magic Eden · keyless reads</span>
      </div>
    </>
  );
}
