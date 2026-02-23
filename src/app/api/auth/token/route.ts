import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_API_BASE_URL" },
      { status: 500 }
    );
  }

  const { userName, password } = await req.json();

  const qs = new URLSearchParams({
    userName: String(userName ?? ""),
    password: String(password ?? ""),
  });

  const url = `${baseUrl}/api/Auth/Token?${qs.toString()}`;

  const res = await fetch(url, { method: "GET" });
  const text = await res.text();

  if (!res.ok) {
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Auth server returned non-JSON response" },
      { status: 502 }
    );
  }

  const accessToken = data?.access_Token;
  const returnedUserName = data?.userName ?? userName;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Auth server did not return access_Token" },
      { status: 502 }
    );
  }

  const isProd = process.env.NODE_ENV === "production";

  const response = NextResponse.json({
    ok: true,
    userName: returnedUserName,
  });

  response.cookies.set("pelios_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });

  response.cookies.set("pelios_user", String(returnedUserName), {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
