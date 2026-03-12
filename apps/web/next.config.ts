import type { NextConfig } from "next";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const isProduction = process.env.NODE_ENV === "production";

async function ensureJsonFile(filePath: string, defaultValue: unknown) {
  try {
    await access(filePath, constants.F_OK);
    return;
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(defaultValue, null, 2)}\n`, "utf8");
  }
}

const CORE_TRACE_PLACEHOLDERS = [
  ["server", "app", "_not-found", "page.js.nft.json"],
  ["server", "pages", "_app.js.nft.json"],
  ["server", "pages", "_document.js.nft.json"],
  ["server", "pages", "_error.js.nft.json"],
  ["server", "pages", "404.js.nft.json"],
] as const;

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  transpilePackages: ["@dark-sun/content", "@dark-sun/rules"],
  compiler: {
    runAfterProductionCompile: async ({ distDir }) => {
      await ensureJsonFile(path.join(distDir, "server", "pages-manifest.json"), {});
      for (const segments of CORE_TRACE_PLACEHOLDERS) {
        await ensureJsonFile(path.join(distDir, ...segments), {
          version: 1,
          files: [],
        });
      }
    },
  },
  experimental: isProduction
    ? {
        webpackBuildWorker: false,
      }
    : undefined,
};

export default nextConfig;
