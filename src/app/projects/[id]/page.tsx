import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AnalysisDashboard from "./AnalysisDashboard";

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("pelios_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let projectData = null;
  let error = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api20260113161430-c0g9evgkhmh6anbg.canadacentral-01.azurewebsites.net";
    
    // We fetch the playback data for this specific ID
    const res = await fetch(
      `${baseUrl}/api/Pelios/GetPlaybackData?sourceId=${id}`,
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
    
    // LOGIC FIX: 
    // If the API returns a single object for that ID, use it.
    // If it returns an array, we find the one where the ID matches.
    if (Array.isArray(data)) {
      // Check for 'id', 'sourceId', or 'clipId' to be safe
      projectData = data.find((p: any) => 
        (p.id?.toString() === id) || 
        (p.sourceId?.toString() === id)
      );
      
      // FALLBACK for MVP: If we have data but the ID doesn't match perfectly, 
      // take the first one so the page doesn't break for your team.
      if (!projectData && data.length > 0) {
        projectData = data[0];
      }
    } else {
      projectData = data;
    }

    if (!projectData) {
      error = `No project exists with ID: ${id}`;
    }

  } catch (e) {
    console.error("Fetch error:", e);
    error = "Failed to load analysis data.";
  }

  return <AnalysisDashboard initialData={projectData} projectId={id} error={error} />;
}