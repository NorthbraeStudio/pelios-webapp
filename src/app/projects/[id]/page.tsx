import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AnalysisDashboard from "./AnalysisDashboard";

export const dynamic = 'force-dynamic';

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
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // We fetch using the sourceId directly
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
    
    // VERCEL FIX: Normalize the data search
    // We check if the data exists at all. If the API returns 
    // an array for that specific sourceId, we just take the first result.
    if (Array.isArray(data) && data.length > 0) {
      projectData = data[0]; 
    } else if (data && !Array.isArray(data)) {
      projectData = data;
    }

    if (!projectData) {
      error = `No analysis data found for ID: ${id}. Please ensure the video has been processed.`;
    }

  } catch (e) {
    console.error("Fetch error:", e);
    error = "Failed to load analysis data. Please check your connection.";
  }

  return <AnalysisDashboard initialData={projectData} projectId={id} error={error} />;
}