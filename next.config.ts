import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["*.replit.dev", "*.sisko.replit.dev"],

  // Prevent Next.js from bundling ifct2017 and its sub-packages so that
  // their internal __dirname-based file paths (e.g. index.csv) resolve
  // correctly at runtime instead of pointing to the /ROOT bundle dir.
  serverExternalPackages: [
    'ifct2017',
    '@ifct2017/compositions',
    '@ifct2017/columns',
    '@ifct2017/codes',
    '@ifct2017/languages',
    '@ifct2017/groups',
    '@ifct2017/regions',
    '@ifct2017/nutrients',
    '@ifct2017/methods',
    '@ifct2017/hierarchy',
    'html-encoding-sniffer',
    '@exodus/bytes',
    'jsdom',
    'whatwg-encoding',
  ],

  // Skip type-check and lint during builds (already fast, keep them off)
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Disable source maps in production — biggest single build-time saving
  productionBrowserSourceMaps: false,

  experimental: {
    // Tree-shake large packages so webpack handles smaller chunks
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-color",
      "@tiptap/extension-font-family",
      "@tiptap/extension-highlight",
      "@tiptap/extension-image",
      "@tiptap/extension-link",
      "@tiptap/extension-placeholder",
      "@tiptap/extension-table",
      "@tiptap/extension-table-cell",
      "@tiptap/extension-table-header",
      "@tiptap/extension-table-row",
      "@tiptap/extension-text-align",
      "@tiptap/extension-text-style",
      "@tiptap/extension-underline",
    ],
  },

  webpack: (config, { isServer, dev }) => {
    // ── Filesystem cache: compiled modules are written to .next/cache/webpack
    //    and reused on the next build — dramatically cuts rebuild time
    if (!dev) {
      config.cache = {
        type: 'filesystem',
        cacheDirectory: path.resolve('.next/cache/webpack'),
        buildDependencies: {
          // Invalidate cache when this config file changes
          config: [__filename],
        },
      };
    }

    // Node built-ins that don't exist in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "X-Frame-Options", value: "ALLOWALL" }],
      },
    ];
  },
};

export default nextConfig;
