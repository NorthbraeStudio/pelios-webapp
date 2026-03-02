import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AnalysisDashboard from "./AnalysisDashboard";

// Force the page to never cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    
    // We add a timestamp (?t=...) to the end of the URL. 
    // This trick stops Vercel from showing you a cached "Project Not Found" page.
    const timestamp = Date.now();
    const res = await fetch(
      `${baseUrl}/api/Pelios/GetPlaybackData?sourceId=${id}&t=${timestamp}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      }
    );

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    
    // DEBUG: This will show up in your Vercel Logs so we can see the 'Shape' of the data
    console.log(`VERCEL DEBUG: Data for ID ${id}:`, JSON.stringify(data).substring(0, 100));

    // Handle different API shapes (Array vs Object)
    if (Array.isArray(data)) {
      projectData = data.find((p: any) => String(p.id) === String(id) || String(p.sourceId) === String(id)) || data[0];
    } else {
      projectData = data;
    }

    if (!projectData || Object.keys(projectData).length === 0) {
      error = `Project ${id} was found but contains no analysis data yet.`;
    }

  } catch (e) {
    console.error("Critical Fetch Error:", e);
    error = "The system encountered a connection error. Please refresh.";
  }

  return <AnalysisDashboard initialData={projectData} projectId={id} error={error} />;
}