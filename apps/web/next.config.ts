import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  transpilePackages: ["@dark-sun/content", "@dark-sun/rules"],
  experimental: isProduction
    ? {
        webpackBuildWorker: false,
      }
    : undefined,
};

export default nextConfig;
