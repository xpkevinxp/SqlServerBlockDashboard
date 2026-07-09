import { NextResponse } from "next/server";
import { formatSqlError } from "@/lib/sql/errors";
import { getBlockingSnapshot } from "@/lib/sql/queries";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const snapshot = await getBlockingSnapshot();
    return NextResponse.json(snapshot, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const formatted = formatSqlError(error);
    return NextResponse.json(
      { error: formatted.message },
      { status: formatted.status, headers: NO_STORE_HEADERS },
    );
  }
}
