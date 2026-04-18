import analyzer from '@next/bundle-analyzer';
import withSerwistInit from '@serwist/next';

const isProd = process.env.NODE_ENV === 'production';

const withBundleAnalyzer = analyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: isProd,
  pageExtensions: ['tsx', 'ts'],
  experimental: {
    optimizePackageImports: [
      '@lobehub/ui',
      '@lobehub/icons',
      'chroma-js',
      'shiki',
      '@icons-pack/react-simple-icons',
      'gpt-tokenizer',
    ],
  },
  reactStrictMode: true,
  rewrites: async () => {
    return [
      {
        source: '/r2-proxy/:path*',
        destination: 'https://r2.vidol.chat/:path*',
      },
      {
        source: '/market-proxy/:path*',
        destination: 'https://vidol-market.lobehub.com/:path*',
      },
    ];
  },
  redirects: async () => {
    return [
      {
        destination: '/manifest.webmanifest',
        permanent: true,
        source: '/manifest.json',
      },
    ];
  },
  webpack(config) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    // to fix shikiji compile error
    // refs: https://github.com/antfu/shikiji/issues/23
    config.module.rules.push(
      {
        test: /\.m?js$/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        type: 'asset/source',
      },
    );

    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    };

    return config;
  },
};

const noWrapper = (config) => config;

const withPWA = isProd
  ? withSerwistInit({
      register: false,
      swDest: 'public/sw.js',
      swSrc: 'src/app/sw.ts',
      // 增加预缓存大小限制，单位：字节（例如 15 MB）
      maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB
    })
  : noWrapper;

export default isProd ? withBundleAnalyzer(withPWA(nextConfig)) : nextConfig;
