/** Collections the marketplace indexes. Symbols are Magic Eden collection slugs. */
export type CollectionMeta = { symbol: string; name: string; cat: string };

export const COLLECTIONS: CollectionMeta[] = [
  { symbol: 'mad_lads', name: 'Mad Lads', cat: 'PFP' },
  { symbol: 'claynosaurz', name: 'Claynosaurz', cat: '3D' },
  { symbol: 'famous_fox_federation', name: 'Famous Fox Federation', cat: 'PFP' },
  { symbol: 'cets_on_creck', name: 'Cets on Creck', cat: 'PFP' },
  { symbol: 'taiyo_robotics', name: 'Taiyo Robotics', cat: '3D' },
  { symbol: 'blocksmith_labs', name: 'Blocksmith Labs', cat: '3D' },
  { symbol: 'aurory', name: 'Aurory', cat: 'Gaming' },
];
