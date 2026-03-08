import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Keep middleware behavior neutral while ensuring dev emits middleware manifests reliably.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}
