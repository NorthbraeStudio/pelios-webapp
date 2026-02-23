import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/projects
 *
 * This is a Next.js App Router route handler.
 * It runs server-side and proxies requests to the Pelios Azure API.
 *
 * Flow:
 * 1) Reads NEXT_PUBLIC_API_BASE_URL from .env.local
 * 2) Reads pelios_token from HttpOnly cookie (set by /api/auth/token)
 * 3) Calls Azure: GET {BASE}/api/Pelios/GetSources
 * 4) Returns Azure response to the browser (status + body)
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_API_BASE_URL" },
      { status: 500 }
    );
  }

  const token = req.cookies.get("pelios_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated (missing pelios_token cookie)" },
      { status: 401 }
    );
  }

  const apiBase = baseUrl.replace(/\/+$/, "");
  const url = `${apiBase}/api/Pelios/GetSources`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const bodyText = await res.text();

    return new NextResponse(bodyText, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Failed to reach Pelios API",
        detail: err instanceof Error ? err.message : String(err),
        endpoint: url,
      },
      { status: 502 }
    );
  }
}