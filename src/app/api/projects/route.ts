import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pelios_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use the same base URL logic as your other pages
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api20260113161430-c0g9evgkhmh6anbg.canadacentral-01.azurewebsites.net";
  
  // We assume the endpoint to get the list is GetSources
  const apiUrl = `${baseUrl}/api/Pelios/GetSources`;

  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return new NextResponse(errorText, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}