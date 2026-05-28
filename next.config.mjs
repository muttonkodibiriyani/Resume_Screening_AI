/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    // These packages must stay outside the Next.js bundle: they ship Node-only
    // binaries (pdf-parse, mammoth), are optional Azure providers loaded only
    // when STORAGE_PROVIDER/QUEUE_PROVIDER/APPLICATIONINSIGHTS_* are set, or
    // talk to the file-system in ways webpack cannot statically analyse.
    serverComponentsExternalPackages: [
      'pdf-parse',
      'mammoth',
      '@azure/storage-blob',
      '@azure/service-bus',
      '@azure/identity',
      'applicationinsights',
    ],
  },
  webpack: (config, { isServer }) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    if (isServer) {
      // Optional Azure SDKs that may not be installed in local dev.
      // Treating them as commonjs externals means webpack won't fail the
      // build when they're missing; the lazy `await import(...)` call will
      // throw a friendly error at runtime instead.
      const optional = ['@azure/storage-blob', '@azure/service-bus', '@azure/identity', 'applicationinsights'];
      for (const m of optional) {
        config.externals.push({ [m]: `commonjs ${m}` });
      }
    }
    return config;
  },
};

export default nextConfig;
