import type { NextConfig } from "next";

// Keep the hot-reload cache separate from the production build used by the
// desktop launcher. Otherwise a build can replace files that a dev server is
// still serving, leaving the browser with missing JS or CSS chunks.
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
