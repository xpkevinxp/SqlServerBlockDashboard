import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { verifyDashboardPassword } from "@/lib/auth/password";
import { createSessionToken, isAuthConfigured } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD no esta configurada" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { password?: string };
    const password = body.password ?? "";

    if (!verifyDashboardPassword(password)) {
      return NextResponse.json(
        { error: "Contrasena incorrecta" },
        { status: 401 },
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "No se pudo iniciar sesion" },
      { status: 500 },
    );
  }
}