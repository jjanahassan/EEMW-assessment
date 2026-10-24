import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    // standalone output is only used for the Docker image, so "npm run build && npm start" still works locally
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
