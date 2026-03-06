#!/usr/bin/env node

import process from "node:process";

import {
  encodePrintPayloadFromExportRequest,
  makeKnownValidExportPayload,
} from "./smoke-fixture.mjs";
import { startWebDevServer } from "./smoke-server.mjs";

const FAILURE_PATTERNS = [
  /Unhandled Runtime Error/i,
  /Failed to compile/i,
  /Module not found/i,
  /ReferenceError:/i,
  /TypeError:/i,
  /Cannot find module/i,
];

function assertNoFailureMarkup(route, html) {
  for (const pattern of FAILURE_PATTERNS) {
    if (pattern.test(html)) {
      throw new Error(`Route ${route} contains failure marker: ${pattern}`);
    }
  }
}

function assertContentMarkers(route, html, requiredAny = [], requiredAll = []) {
  for (const marker of requiredAll) {
    if (!html.includes(marker)) {
      throw new Error(`Route ${route} is missing required text marker: "${marker}"`);
    }
  }

  if (requiredAny.length > 0 && !requiredAny.some((marker) => html.includes(marker))) {
    throw new Error(
      `Route ${route} did not include any expected text markers: ${requiredAny.join(" | ")}`
    );
  }
}

async function main() {
  const repoRoot = process.cwd();
  const port = Number.parseInt(process.env.WEB_SMOKE_PORT ?? "4010", 10);
  const knownPayload = makeKnownValidExportPayload();
  const encodedPrintPayload = encodePrintPayloadFromExportRequest(knownPayload);
  const routes = [
    {
      path: "/builder",
      requiredAny: ["Builder", "Export Ready"],
      requiredAll: [],
    },
    {
      path: `/print?payload=${encodeURIComponent(encodedPrintPayload)}`,
      requiredAny: ["Character Name", "Dark Sun Character Builder Sheet"],
      requiredAll: [],
    },
    {
      path: `/sheet?payload=${encodeURIComponent(encodedPrintPayload)}`,
      requiredAny: ["Character Sheet (HTML)", "Abilities", "Core Stats"],
      requiredAll: [],
    },
    {
      path: "/debug/content",
      requiredAny: ["Debug: Content", "Merged Entity JSON", "Merged Counts"],
      requiredAll: [],
    },
  ];

  const server = await startWebDevServer({ repoRoot, port, readyPath: "/builder" });

  try {
    for (const route of routes) {
      const response = await fetch(`${server.baseUrl}${route.path}`, {
        redirect: "manual",
        cache: "no-store",
      });

      if (response.status !== 200) {
        throw new Error(`Route ${route.path} returned ${response.status}, expected 200.`);
      }

      const html = await response.text();
      assertNoFailureMarkup(route.path, html);
      assertContentMarkers(route.path, html, route.requiredAny, route.requiredAll);
      console.log(`[web:smoke] ${route.path} -> 200`);
    }

    console.log("[web:smoke] PASS");
  } finally {
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
