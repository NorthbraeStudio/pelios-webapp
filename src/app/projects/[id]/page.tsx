export const dynamic = 'force-dynamic';
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
    // 1. Use the environment variable for the base URL
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
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
    
    // 2. Flexible Matching: Compare strings to strings to avoid type errors
    if (Array.isArray(data)) {
      projectData = data.find((p: any) => 
        (p.id?.toString() === id) || 
        (p.sourceId?.toString() === id) ||
        (p.clipId?.toString() === id)
      );
    } else if (data && (data.id?.toString() === id || data.sourceId?.toString() === id)) {
      projectData = data;
    }

    // 3. MVP Failsafe: If data exists but ID matching is inconsistent, use the first item
    if (!projectData && Array.isArray(data) && data.length > 0) {
        projectData = data[0];
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