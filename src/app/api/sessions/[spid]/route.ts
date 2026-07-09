import { NextResponse } from "next/server";
import { formatSqlError } from "@/lib/sql/errors";
import { getSessionDetail } from "@/lib/sql/queries/lock-details";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

interface RouteContext {
  params: Promise<{ spid: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { spid } = await context.params;
  const sessionId = Number(spid);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json(
      { error: "SPID invalido" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const session = await getSessionDetail(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Sesion no encontrada" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(session, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const formatted = formatSqlError(error);
    return NextResponse.json(
      { error: formatted.message },
      { status: formatted.status, headers: NO_STORE_HEADERS },
    );
  }
}
