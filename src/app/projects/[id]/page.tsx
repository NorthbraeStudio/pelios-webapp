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
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api20260113161430-c0g9evgkhmh6anbg.canadacentral-01.azurewebsites.net";
    const apiUrl = `${baseUrl}/api/Pelios/GetPlaybackData?sourceId=${id}&t=${Date.now()}`;
    
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      }
    });

    // 🚨 THE MAGIC TRICK: We grab the RAW text before it even tries to process it
    const rawText = await res.text();

    if (!res.ok) {
       error = `Backend Error ${res.status}. Raw Response: ${rawText.substring(0, 200)}`;
    } else {
       // Now we parse the raw text into JSON
       const data = JSON.parse(rawText);
       
       if (Array.isArray(data) && data.length > 0) {
         projectData = data[0]; 
       } else if (data && !Array.isArray(data) && Object.keys(data).length > 0) {
         projectData = data;
       }

       if (!projectData) {
         // If it's empty, PRINT THE RAW AZURE RESPONSE to the screen!
         error = `API connected successfully, but no matching data was found. RAW AZURE RESPONSE: ${rawText}`;
       }
    }

  } catch (e: any) {
    console.error("Fetch error:", e);
    error = `System Error: ${e.message}`;
  }

  return <AnalysisDashboard initialData={projectData} projectId={id} error={error} />;
}