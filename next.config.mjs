/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // This helps reduce function count by optimizing builds
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
  // Keep it simple
  trailingSlash: false,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Optimize server bundle to reduce function splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            default: {
              chunks: "all",
              minChunks: 1,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
