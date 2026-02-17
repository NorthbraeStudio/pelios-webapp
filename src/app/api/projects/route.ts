import { NextResponse } from "next/server";

/**
 * GET /api/projects
 *
 * Reads pelios_token from HttpOnly cookie (set at login),
 * forwards it to the Pelios API as an Authorization header,
 * and returns the result.
 */
export async function GET(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_API_BASE_URL" },
      { status: 500 }
    );
  }

  // ✅ Read the token from cookies (HttpOnly -> only server can read it)
  const cookieHeader = req.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)pelios_token=([^;]+)/);
  const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(`${baseUrl}/Pelios/GetSources`, {
    method: "GET",
    headers: {
      accept: "application/json",
      // ✅ Backend still expects Bearer token
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
