"use client";

/**
 * ==========================================================
 * PROJECTS CLIENT (UI)
 * ----------------------------------------------------------
 * Purpose:
 * - Fetches projects from /api/projects (cookie auth)
 * - Renders a dashboard-style Projects page:
 *   - top nav (Pelios AI + user + logout)
 *   - stat tiles
 *   - search + filter + create button (MVP placeholder)
 *   - project cards with hover + status badge + quick metrics
 *
 * Notes:
 * - This is a Client Component (uses React state/effects).
 * - Auth guard happens in src/app/projects/page.tsx (Server Component).
 * - Any missing data from the API is shown as placeholder "—" for now.
 * ==========================================================
 */

import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Types (match your API)
========================= */

type Score = {
  scoreId: number;
  faceId: number;
  scoreType: number;
  score: number;
  timeIndex: number;
};

type TextItem = {
  textId: number;
  clipId: number;
  topicId: number;
  text: string;
};

type Clip = {
  clipId: number;
  timeFrom: number;
  timeTo: number;
  faceId: number;
  speaker: boolean;
  visible: boolean;
  clipScore: number;
  transcribed: string;
  text: TextItem[];
};

type Face = {
  faceId: number;
  sourceId: number;
  faceIndex: number;
  clips: Clip[];
  scores: Score[];
};

type Source = {
  id: number;
  url: string;
  timeFrom: number;
  timeTo: number;
  processed: boolean;
  userId: string;
  faces: Face[];
};

/* =========================
   Small helpers
========================= */

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);

    // youtu.be/VIDEO_ID
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "") || null;
    }

    // youtube.com/watch?v=VIDEO_ID
    const v = u.searchParams.get("v");
    if (v) return v;

    // youtube.com/shorts/VIDEO_ID
    const parts = u.pathname.split("/").filter(Boolean);
    const shortsIndex = parts.indexOf("shorts");
    if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];

    // youtube.com/embed/VIDEO_ID
    const embedIndex = parts.indexOf("embed");
    if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];

    return null;
  } catch {
    return null;
  }
}

function getThumbnail(url: string): string {
  const id = getYouTubeId(url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  // Fallback image from the design
  return "https://lh3.googleusercontent.com/aida-public/AB6AXuCjITzw7c3wXOmKeFrGrjdHWbDrED_qcpO3OSTJHfgUZc6WqTGHwUQ5YJLhCfB_dCnHii_lPMHs6LEJLd_4a5qa_uIRZiqwaEv0WBztxD2GOT1CcmfwJXffsFKGg5Ordr0jf16m6VWoHS4DWv0r0r5wcPE4P5JUeqeyfvO9dff2X0s3Zb5hGtsOITLl5H7hjjKeLGH4qCSJ6P0G0W11tfLcXtK_uimdt95wG_ztCosOpJqihlsrfdjJYedQGIJkNO8IwVgLALSfC2gf";
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.split("=")[1] ?? "") : "";
}

function initialsFromName(name: string) {
  const v = (name || "").trim();
  if (!v) return "U";
  const base = v.includes("@") ? v.split("@")[0] : v;
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function sumClips(source: Source) {
  if (!source.faces?.length) return 0;
  return source.faces.reduce((acc, f) => acc + (f.clips?.length ?? 0), 0);
}

function peakIntensity(source: Source): number | null {
  if (!source.faces?.length) return null;
  let max: number | null = null;
  for (const f of source.faces) {
    for (const s of f.scores ?? []) {
      if (max === null || s.score > max) max = s.score;
    }
  }
  return max;
}

/* =========================
   Component
========================= */

export default function ProjectsClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Toolbar state
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "processing">("all");

  // User display (non-sensitive)
  const [userName, setUserName] = useState("user");

  useEffect(() => {
    const u = readCookie("pelios_user") || localStorage.getItem("pelios_user") || "user";
    setUserName(u);
  }, []);

  const initials = initialsFromName(userName);

  /* =========================
     Load projects
     - Cookie auth (HttpOnly token)
  ========================= */
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await fetch("/api/projects", {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          // If guard failed for any reason, bounce to login
          window.location.assign("/login");
          return;
        }

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Failed to load projects (${res.status}): ${t}`);
        }

        const data = (await res.json()) as Source[];
        setSources(data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // Set dark mode based on system preference
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  /* =========================
     Logout
  ========================= */
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("pelios_user");
      window.location.assign("/login");
    }
  }

  /* =========================
     Derived values (stats + filtering)
  ========================= */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return sources
      .filter((s) => {
        if (!q) return true;
        const idMatch = String(s.id).includes(q);
        const urlMatch = String(s.url ?? "").toLowerCase().includes(q);
        const yt = getYouTubeId(s.url ?? "") || "";
        const ytMatch = yt.toLowerCase().includes(q);
        return idMatch || urlMatch || ytMatch;
      })
      .filter((s) => {
        if (filter === "all") return true;
        if (filter === "active") return Boolean(s.processed);
        if (filter === "processing") return !Boolean(s.processed);
        return true;
      });
  }, [sources, search, filter]);

  const stats = useMemo(() => {
    const total = sources.length;
    const processed = sources.filter((s) => s.processed).length;
    const clips = sources.reduce((acc, s) => acc + sumClips(s), 0);

    const peaks = sources
      .map((s) => peakIntensity(s))
      .filter((v): v is number => typeof v === "number");

    const avgPeak =
      peaks.length > 0 ? Math.round((peaks.reduce((a, b) => a + b, 0) / peaks.length) * 100) / 100 : null;

    return { total, processed, clips, avgPeak };
  }, [sources]);

  /* =========================
     Render
  ========================= */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0F0F0F] flex items-center justify-center text-gray-800 dark:text-gray-100">
        Loading projects…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0F0F0F] p-6 flex items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="font-semibold">Couldn’t load projects</div>
          <pre className="mt-2 max-h-64 overflow-auto text-xs">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F3F4F6] dark:bg-[#0F0F0F] text-gray-800 dark:text-gray-100 min-h-screen transition-colors duration-300 font-sans">
      {/* Styles from input */}
      <style jsx global>{`
        .glass-card {
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .dark .glass-card {
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .immersive-card {
            position: relative;
            overflow: hidden;
            border-radius: 1.5rem;
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .immersive-card:hover {
            transform: translateY(-5px) scale(1.01);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 15px rgba(210, 255, 31, 0.4);
            border-color: rgba(210, 255, 31, 0.8);
        }
        .immersive-bg {
            position: absolute;
            inset: 0;
            z-index: 0;
            transition: transform 0.6s ease;
        }
        .immersive-card:hover .immersive-bg img {
            transform: scale(1.05);
        }
        .frosted-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, rgba(15, 15, 15, 0.9) 0%, rgba(15, 15, 15, 0.98) 100%);
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            z-index: 1;
            transition: backdrop-filter 0.5s ease, background 0.5s ease;
        }
        .immersive-card:hover .frosted-overlay {
            backdrop-filter: blur(0px);
            -webkit-backdrop-filter: blur(0px);
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.9) 100%);
        }
        .immersive-card:hover .text-shadow-pop {
            text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        }
        .immersive-content {
            position: relative;
            z-index: 2;
            height: 100%;
            display: flex;
            flex-direction: column;
            transition: transform 0.4s ease;
        }
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #D2FF1F;
            border-radius: 4px;
        }
        .play-overlay {
            background: rgba(210, 255, 31, 0.9);
            color: black;
            transition: all 0.3s ease;
        }
        .immersive-card:hover .play-overlay {
            transform: scale(1.1);
            box-shadow: 0 0 20px rgba(210, 255, 31, 0.6);
        }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-24 bg-white dark:bg-[#1E1E1E] flex flex-col items-center py-8 shadow-xl z-50 transition-colors duration-300 border-r border-gray-100 dark:border-white/5">
        <div className="w-12 h-12 bg-[#D2FF1F] rounded-full flex items-center justify-center mb-12 shadow-lg shadow-[#D2FF1F]/30">
          <span className="material-symbols-outlined text-black font-bold">code</span>
        </div>
        <nav className="flex flex-col gap-8 w-full items-center">
          <a className="p-3 rounded-xl bg-gray-100 dark:bg-white/10 text-[#6200EA] dark:text-[#D2FF1F] transition hover:scale-105" href="#">
            <span className="material-symbols-outlined">home</span>
          </a>
          <a className="p-3 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-white transition" href="#">
            <span className="material-symbols-outlined">person</span>
          </a>
          <a className="p-3 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-white transition" href="#">
            <span className="material-symbols-outlined">schedule</span>
          </a>
          <a className="p-3 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-white transition" href="#">
            <span className="material-symbols-outlined">smart_display</span>
          </a>
        </nav>
        <div className="mt-auto">
          <a className="p-3 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-white transition" href="#">
            <span className="material-symbols-outlined">settings</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-24 p-8 lg:p-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Projects</h1>
            <p className="text-gray-500 dark:text-gray-400">Select a project to view emotional analysis</p>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-[#1E1E1E] p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5">
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
              <input
                className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 rounded-xl text-sm border-none focus:ring-2 focus:ring-[#D2FF1F] w-64 placeholder-gray-400 text-gray-700 dark:text-gray-200"
                placeholder="Start Searching Here..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 pl-2 border-l border-gray-200 dark:border-white/10">
              <div className="w-10 h-10 rounded-full bg-[#6200EA] text-white flex items-center justify-center font-bold text-sm">
                {initials}
              </div>
              <div className="hidden lg:block text-sm">
                <p className="font-medium dark:text-white">{userName}</p>
              </div>
              <button
                className="ml-2 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
                onClick={handleLogout}
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Stats Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="glass-card bg-white dark:bg-[rgba(30,30,30,0.60)] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#D2FF1F]/20 rounded-full blur-xl group-hover:bg-[#D2FF1F]/30 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Projects</h3>
              <div className="w-2 h-2 rounded-full bg-[#D2FF1F] shadow-[0_0_10px_#D2FF1F]"></div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
            </div>
          </div>
          <div className="glass-card bg-white dark:bg-[rgba(30,30,30,0.60)] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#6200EA]/20 rounded-full blur-xl group-hover:bg-[#6200EA]/30 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Projects Processed</h3>
              <div className="w-8 h-4 rounded-full bg-[#6200EA] text-[10px] text-white flex items-center justify-center">
                {stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-bold text-gray-900 dark:text-white mb-1">{stats.processed}</span>
              <span className="text-xs text-green-500 flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-xs">trending_up</span>
                + 2.5% vs last month
              </span>
            </div>
          </div>
          <div className="glass-card bg-white dark:bg-[rgba(30,30,30,0.60)] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Clips Detected</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">{stats.clips}</span>
            </div>
          </div>
          <div className="glass-card bg-white dark:bg-[rgba(30,30,30,0.60)] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Avg Peak Intensity</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">{stats.avgPeak ?? "—"}</span>
            </div>
          </div>
        </section>

        {/* Analysis Feed */}
        <section>
          <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analysis Feed</h2>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <input
                  className="pl-4 pr-10 py-2.5 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-[#6200EA] w-full md:w-64 text-gray-700 dark:text-gray-200 shadow-sm"
                  placeholder="Search projects..."
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="py-2.5 px-4 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-[#6200EA] text-gray-700 dark:text-gray-200 shadow-sm cursor-pointer"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="processing">Processing</option>
              </select>
              <button
                className="py-2.5 px-6 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition flex items-center gap-2"
                onClick={() => alert("Create Project (MVP placeholder)")}
              >
                <span className="material-symbols-outlined text-lg">add</span>
                New Analysis
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-lg border bg-white dark:bg-[#1E1E1E] dark:border-white/10 p-6 text-sm text-gray-600 dark:text-gray-400">
                No projects match your search.
              </div>
            ) : (
              filtered.map((s) => {
                const dur = formatDuration((s.timeTo ?? 0) - (s.timeFrom ?? 0));
                const yt = getYouTubeId(s.url) ?? "";
                const clips = sumClips(s);
                const peak = peakIntensity(s);
                const thumbnail = getThumbnail(s.url);

                return (
                  <article
                    key={s.id}
                    className="immersive-card h-[500px] group cursor-pointer"
                    onClick={() => window.location.assign(`/projects/${s.id}`)}
                  >
                    <div className={`immersive-bg ${!s.processed ? "grayscale opacity-70" : ""}`}>
                      <img
                        alt={`Project ${s.id} Background`}
                        className="w-full h-full object-cover"
                        src={thumbnail}
                      />
                    </div>
                    <div className="frosted-overlay"></div>
                    <div className="immersive-content p-6">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-2">
                          <span className="text-xs font-mono text-black font-bold bg-[#D2FF1F] px-3 py-1 rounded shadow-lg shadow-black/20 group-hover:scale-110 transition-transform">
                            Video ID: {s.id}
                          </span>
                          {s.processed ? (
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-md flex items-center gap-1.5 shadow-lg group-hover:bg-black/60 group-hover:border-white/40 transition-colors">
                              <span className="w-2 h-2 rounded-full bg-[#D2FF1F] shadow-[0_0_8px_rgba(210,255,31,0.8)]"></span>{" "}
                              Processed
                            </span>
                          ) : (
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-200 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span>{" "}
                              Processing
                            </span>
                          )}
                        </div>
                        {s.processed ? (
                          <div className="w-10 h-10 rounded-full play-overlay flex items-center justify-center cursor-pointer shadow-lg group-hover:bg-white group-hover:text-black">
                            <span className="material-symbols-outlined text-xl">play_arrow</span>
                          </div>
                        ) : (
                          <div className="px-3 py-1 bg-black/60 backdrop-blur rounded-full text-white text-[10px] font-bold border border-white/10">
                            ...
                          </div>
                        )}
                      </div>

                      <div className="flex-grow flex items-center justify-center">
                        {!s.processed && (
                          <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 group-hover:bg-black/60 group-hover:scale-105 transition-all">
                            <span className="material-symbols-outlined text-3xl text-orange-400 animate-spin">
                              sync
                            </span>
                            <span className="text-xs font-mono text-white">ANALYZING VIDEO...</span>
                          </div>
                        )}
                      </div>

                      <div className="relative z-10">
                        <div className="mb-4">
                          <div className="flex justify-between items-end mb-2">
                            <h3 className="text-2xl font-bold text-white leading-tight drop-shadow-md text-shadow-pop transition-all truncate">
                              {yt ? `YouTube: ${yt}` : `Project ${s.id}`}
                            </h3>
                            <span className="text-xs font-mono text-gray-300 bg-black/40 px-2 py-1 rounded backdrop-blur-sm group-hover:bg-black/70 group-hover:text-white transition-colors">
                              {dur}
                            </span>
                          </div>
                          <p className="text-sm text-gray-200 line-clamp-2 leading-relaxed drop-shadow-sm text-shadow-pop transition-all group-hover:text-white">
                            <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-widest mr-2">Source</span>
                            {s.url}
                          </p>
                        </div>

                        <div className={`grid grid-cols-3 gap-3 mb-5 border-t border-white/10 pt-4 group-hover:border-white/20 transition-colors ${!s.processed ? "opacity-50" : ""}`}>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1 group-hover:text-gray-300">
                              Analysis Duration
                            </p>
                            <div className="flex items-center gap-1.5 text-white text-xs font-mono text-shadow-pop">
                              <span className="material-symbols-outlined text-[14px] text-[#D2FF1F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                timer
                              </span>
                              <span className="drop-shadow-md">{s.processed ? `${s.timeTo - s.timeFrom}s` : "--"}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1 group-hover:text-gray-300">
                              Faces
                            </p>
                            <div className="flex items-center gap-1.5 text-white text-xs font-mono text-shadow-pop">
                              <span className="material-symbols-outlined text-[14px] text-[#6200EA] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                face
                              </span>
                              <span className="drop-shadow-md">{s.faces?.length ?? 0}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1 group-hover:text-gray-300">
                              Clips
                            </p>
                            <div className="flex items-center gap-1.5 text-white text-xs font-mono text-shadow-pop">
                              <span className="material-symbols-outlined text-[14px] text-blue-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                movie
                              </span>
                              <span className="drop-shadow-md">{clips} Clips</span>
                            </div>
                          </div>
                        </div>

                        <div className={`grid grid-cols-2 gap-4 ${!s.processed ? "opacity-70" : ""}`}>
                          <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 relative overflow-hidden group/metric hover:bg-black/60 transition-colors group-hover:border-white/20">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-[#6200EA]/30 rounded-bl-full -mr-4 -mt-4 blur-xl group-hover:bg-[#6200EA]/50 transition-all"></div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 group-hover:text-gray-300">
                              Valence
                            </p>
                            <p className={`text-2xl font-bold text-[#6200EA] drop-shadow-[0_0_10px_rgba(98,0,234,0.5)] text-shadow-pop ${!s.processed ? "animate-pulse" : ""}`}>
                              {s.processed ? "--" : "..."}
                            </p>
                          </div>
                          <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 relative overflow-hidden group/metric hover:bg-black/60 transition-colors group-hover:border-white/20">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-[#D2FF1F]/30 rounded-bl-full -mr-4 -mt-4 blur-xl group-hover:bg-[#D2FF1F]/50 transition-all"></div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 group-hover:text-gray-300">
                              Intensity
                            </p>
                            <p className={`text-2xl font-bold text-[#D2FF1F] drop-shadow-[0_0_10px_rgba(210,255,31,0.5)] text-shadow-pop ${!s.processed ? "animate-pulse" : ""}`}>
                              {s.processed ? (peak ?? "--") : "..."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}