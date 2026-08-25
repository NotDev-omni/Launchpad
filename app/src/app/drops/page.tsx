import Link from 'next/link';

export const metadata = { title: 'Drops — Trove' };

export default function Drops() {
  return (
    <>
      <div className="sec">
        <h1 style={{ fontSize: '1.8rem' }}>Drops &amp; Launchpad</h1>
        <p className="sub">The launch half — mint flow and creator Studio</p>
        <div className="note" style={{ marginTop: 14 }}>
          <b>Not ported yet.</b> The drops calendar, crate-opening mint and four-screen Studio wizard are
          fully built as static prototypes and are the next thing to bring across into this app. They need an
          on-chain program behind them to be real, which needs the Solana CLI and Anchor — not installed on
          this machine (they want WSL on Windows).
          <div style={{ marginTop: 10 }}>
            <a
              className="btn ghost"
              href="https://notdev-omni.github.io/Launchpad/directions/06-launchpad.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '7px 14px', fontSize: '.8rem' }}
            >
              See the prototype ↗
            </a>
          </div>
        </div>
      </div>
      <div className="sec" style={{ marginBottom: 40 }}>
        <Link href="/" className="btn ghost" style={{ padding: '7px 14px', fontSize: '.8rem' }}>
          ← Back to marketplace
        </Link>
      </div>
    </>
  );
}
