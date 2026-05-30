import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Niivue/daikon need Node polyfill fallbacks — use webpack until migrated to turbopack
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      "@niivue/niivue": path.resolve(__dirname, "node_modules/@niivue/niivue"),
    };
    return config;
  },
};

export default nextConfig;
