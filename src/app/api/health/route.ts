import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/sql/queries/health";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const health = await getHealthStatus();
    const statusCode = health.connected ? 200 : 503;
    return NextResponse.json(health, {
      status: statusCode,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        serverVersion: null,
        serverTime: null,
        latencyMs: 0,
        hasViewServerState: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
