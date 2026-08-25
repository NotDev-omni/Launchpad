/**
 * Probe candidate Magic Eden collection symbols and print the ones that resolve
 * with a real floor price, sorted by 7d volume.
 *
 *   node scripts/probe-collections.mjs
 *
 * Paced deliberately — ME rate-limits hard and will start returning 429s if you
 * hammer it. Output is meant to be pasted into src/lib/collections.ts.
 */

const CANDIDATES = [
  ['mad_lads', 'PFP'], ['claynosaurz', '3D'], ['famous_fox_federation', 'PFP'],
  ['cets_on_creck', 'PFP'], ['taiyo_robotics', '3D'], ['blocksmith_labs', '3D'],
  ['aurory', 'Gaming'], ['okay_bears', 'PFP'], ['solana_monkey_business', 'Pixel'],
  ['degenerate_ape_academy', 'PFP'], ['froganas', 'PFP'], ['smb_gen3', '3D'],
  ['lifinity_flares', 'Art'], ['galactic_geckos', 'PFP'], ['the_stoned_ape_crew', 'PFP'],
  ['boryoku_dragonz', 'Art'], ['catalina_whale_mixer', '3D'], ['primates', 'PFP'],
  ['udderchaos', 'PFP'], ['shadowy_super_coder_dao', 'Pixel'], ['degods', 'PFP'],
  ['y00ts', 'PFP'], ['abc', 'Art'], ['bohemia', 'Art'], ['sharx', 'PFP'],
  ['portals', '3D'], ['genopets', 'Gaming'], ['star_atlas', 'Gaming'],
  ['transdimensional_fox_federation', 'PFP'], ['solgods', '3D'],
  ['thugbirdz', 'Pixel'], ['communi3', 'PFP'], ['bodoggos', 'PFP'],
  ['retardio_cousins', 'PFP'], ['gamblers_of_gamba', 'Gaming'],
  ['just_ape', 'PFP'], ['solcasino_slots', 'Gaming'], ['homeowners_association', 'PFP'],
];

const BASE = 'https://api-mainnet.magiceden.dev/v2';
const UA = { accept: 'application/json', 'user-agent': 'trove-probe/1.0' };
const PAUSE = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function stats(symbol, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}/collections/${symbol}/stats`, { headers: UA });
    if (res.status === 429) {
      const wait = 8000 * (i + 1);
      process.stdout.write(` [429, waiting ${wait / 1000}s]`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

const good = [];
for (const [sym, cat] of CANDIDATES) {
  process.stdout.write(`  ${sym.padEnd(34)}`);
  try {
    const s = await stats(sym);
    const floor = (s?.floorPrice ?? 0) / 1e9;
    if (floor > 0) {
      const vol = (s?.volume7d ?? 0) / 1e9;
      good.push({ sym, cat, floor, vol, listed: s.listedCount ?? 0 });
      console.log(` OK   floor ${floor.toFixed(3)}  7d ${vol.toFixed(0)}`);
    } else {
      console.log(' no floor');
    }
  } catch (e) {
    console.log(` fail ${e.name}`);
  }
  await sleep(PAUSE);
}

good.sort((a, b) => b.vol - a.vol);
console.log(`\n${good.length} of ${CANDIDATES.length} usable\n`);
console.log('// paste into src/lib/collections.ts');
for (const g of good) {
  console.log(`  { symbol: '${g.sym}', name: '', cat: '${g.cat}' },   // floor ${g.floor.toFixed(2)}  7d ${g.vol.toFixed(0)}`);
}
