/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // NFT artwork lives on these hosts; Next optimises them at request time
    remotePatterns: [
      { protocol: 'https', hostname: '**.arweave.net' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: '**.irys.xyz' },
      { protocol: 'https', hostname: '**.ipfs.nftstorage.link' },
      { protocol: 'https', hostname: '**.shdwdrive.com' },
      { protocol: 'https', hostname: 'img-cdn.magiceden.dev' },
      { protocol: 'https', hostname: '**.magiceden.dev' },
      { protocol: 'https', hostname: 'nftstorage.link' },
      { protocol: 'https', hostname: '**.pinata.cloud' },
      { protocol: 'https', hostname: 'madlads.s3.us-west-2.amazonaws.com' },
    ],
  },
};
export default nextConfig;
