import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AnalysisDashboard from "./AnalysisDashboard";

export const dynamic = 'force-dynamic';

export default async function AnalysisPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params;
  const sParams = await searchParams;
  
  // LOG CLUE: Your logs show 'nxtPid'. We'll capture that just in case.
  const nxtPid = sParams.nxtPid as string;
  const targetId = nxtPid || id;

  const cookieStore = await cookies();
  const token = cookieStore.get("pelios_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let projectData = null;
  let error = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // Fetch using the ID we found (either from URL path or nxtPid)
    const res = await fetch(
      `${baseUrl}/api/Pelios/GetPlaybackData?sourceId=${targetId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store", 
      }
    );

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    
    // UNIVERSAL MATCHING:
    // If the API returns data for this sourceId, it IS our project.
    if (Array.isArray(data) && data.length > 0) {
      projectData = data[0]; 
    } else if (data && !Array.isArray(data)) {
      projectData = data;
    }

    if (!projectData) {
      error = `No analysis data found for ID: ${targetId}`;
    }

  } catch (e) {
    console.error("Fetch error:", e);
    error = "Failed to load analysis data.";
  }

  return <AnalysisDashboard initialData={projectData} projectId={targetId} error={error} />;
}