/**
 * Collections the marketplace indexes. `symbol` is the Magic Eden collection slug.
 *
 * Why a curated list rather than a live "top collections" feed: Magic Eden's keyless
 * tier has no working ranked endpoint. `/v2/marketplace/popular_collections` returns
 * `[]` for every timeRange, `leaderboard` and `marketplace/collections` return 400,
 * and `/v2/collections` is unranked (it hands back obscure collections in arbitrary
 * order). So the list is seeded here and ranked at runtime by live 7d volume.
 *
 * To regenerate after adding candidates:
 *   node scripts/probe-collections.mjs
 *
 * Every entry below was verified to return a real floor price. Adding more is free —
 * the API route fetches with bounded concurrency, so the list can grow without
 * tripping rate limits.
 */
export type CollectionMeta = { symbol: string; name: string; cat: string };

/** Symbols to index but not display. Remove an entry to surface it. */
export const EXCLUDE = new Set<string>([
  // Real collection with real volume — left out only because of the name.
  // Delete this line to include it.
  'retardio_cousins',
]);

const ALL: CollectionMeta[] = [
  { symbol: 'degods', name: 'DeGods', cat: 'PFP' },
  { symbol: 'mad_lads', name: 'Mad Lads', cat: 'PFP' },
  { symbol: 'solana_monkey_business', name: 'Solana Monkey Business', cat: 'Pixel' },
  { symbol: 'claynosaurz', name: 'Claynosaurz', cat: '3D' },
  { symbol: 'famous_fox_federation', name: 'Famous Fox Federation', cat: 'PFP' },
  { symbol: 'galactic_geckos', name: 'Galactic Gecko Space Garage', cat: 'PFP' },
  { symbol: 'boryoku_dragonz', name: 'Boryoku Dragonz', cat: 'Art' },
  { symbol: 'y00ts', name: 'y00ts', cat: 'PFP' },
  { symbol: 'transdimensional_fox_federation', name: 'Transdimensional Fox Federation', cat: 'PFP' },
  { symbol: 'degenerate_ape_academy', name: 'Degenerate Ape Academy', cat: 'PFP' },
  { symbol: 'aurory', name: 'Aurory', cat: 'Gaming' },
  { symbol: 'okay_bears', name: 'Okay Bears', cat: 'PFP' },
  { symbol: 'smb_gen3', name: 'SMB Gen3', cat: '3D' },
  { symbol: 'retardio_cousins', name: 'Retardio Cousins', cat: 'PFP' },
  { symbol: 'communi3', name: 'Communi3', cat: 'PFP' },
  { symbol: 'bodoggos', name: 'BoDoggos', cat: 'PFP' },
  { symbol: 'portals', name: 'Portals', cat: '3D' },
  { symbol: 'primates', name: 'Primates', cat: 'PFP' },
  { symbol: 'blocksmith_labs', name: 'Blocksmith Labs', cat: '3D' },
  { symbol: 'froganas', name: 'Froganas', cat: 'PFP' },
  { symbol: 'cets_on_creck', name: 'Cets on Creck', cat: 'PFP' },
  { symbol: 'lifinity_flares', name: 'Lifinity Flares', cat: 'Art' },
  { symbol: 'sharx', name: 'SharX', cat: 'PFP' },
  { symbol: 'thugbirdz', name: 'Thugbirdz', cat: 'Pixel' },
  { symbol: 'shadowy_super_coder_dao', name: 'Shadowy Super Coder DAO', cat: 'Pixel' },
  { symbol: 'taiyo_robotics', name: 'Taiyo Robotics', cat: '3D' },
  { symbol: 'solgods', name: 'SOLGODS', cat: '3D' },
  { symbol: 'genopets', name: 'Genopets', cat: 'Gaming' },
];

export const COLLECTIONS: CollectionMeta[] = ALL.filter((c) => !EXCLUDE.has(c.symbol));
