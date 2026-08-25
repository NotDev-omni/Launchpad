'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function TopBar() {
  const path = usePathname();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [rpcError, setRpcError] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let live = true;
    connection
      .getBalance(publicKey)
      .then((l) => live && (setBalance(l / LAMPORTS_PER_SOL), setRpcError(false)))
      // The public RPC rate-limits hard; surface it rather than showing a stale zero.
      .catch(() => live && setRpcError(true));
    return () => {
      live = false;
    };
  }, [publicKey, connection]);

  return (
    <div className="top">
      <div className="wrap top-in">
        <Link href="/" className="logo">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <rect x="4" y="12" width="32" height="24" rx="8" style={{ fill: 'var(--acc)' }} />
            <rect x="4" y="12" width="32" height="8" rx="4" style={{ fill: 'var(--acc-2)' }} />
            <circle cx="15" cy="27" r="2.6" fill="#fff" />
            <circle cx="25" cy="27" r="2.6" fill="#fff" />
            <path d="M17 32 q3 2.4 6 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          Trove
        </Link>

        <nav className="nav">
          <Link href="/" className={path === '/' ? 'on' : ''}>
            Explore
          </Link>
          <Link href="/drops" className={path.startsWith('/drops') ? 'on' : ''}>
            Drops
          </Link>
        </nav>

        <span className="grow" />

        {publicKey && (
          <span className="bal">
            {rpcError ? 'RPC rate limited' : balance === null ? 'loading…' : `${balance.toFixed(3)} ◎`}
          </span>
        )}
        <WalletMultiButton />
      </div>
    </div>
  );
}
