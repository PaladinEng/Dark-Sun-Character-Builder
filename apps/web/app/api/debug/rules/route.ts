import { NextResponse } from "next/server";

import { generateRulesCoverageReport } from "@dark-sun/rules";

import { getMergedContent } from "../../../../src/lib/content";

export const runtime = "nodejs";

export async function GET() {
  const { content } = await getMergedContent();
  const coverage = generateRulesCoverageReport(content);
  return NextResponse.json({ coverage });
}
