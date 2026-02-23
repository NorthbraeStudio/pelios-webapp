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
  const userName = readCookie("pelios_user") || localStorage.getItem("pelios_user") || "user";
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
    return <div className="p-6">Loading projects…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="font-semibold">Couldn’t load projects</div>
          <pre className="mt-2 max-h-64 overflow-auto text-xs">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white">
              {"{}"}
            </div>
            <div className="text-sm font-semibold">Pelios AI</div>
            <div className="ml-6 text-xl font-semibold">Projects</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-white text-sm font-semibold">
              {initials}
            </div>
            <div className="hidden text-sm text-gray-700 sm:block">{userName}</div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <div className="text-sm text-gray-600">Select a project to view emotional analysis</div>

        {/* Stat tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Total Projects</div>
            <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Projects Processed</div>
            <div className="mt-1 text-2xl font-semibold">{stats.processed}</div>
            <div className="mt-1 text-xs text-green-700">+ placeholder vs last month</div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Total Clips Detected</div>
            <div className="mt-1 text-2xl font-semibold">{stats.clips}</div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Avg Peak Intensity</div>
            <div className="mt-1 text-2xl font-semibold">{stats.avgPeak ?? "—"}</div>
          </div>
        </div>

        {/* Section header + toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg font-semibold">Your Projects</div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                className="w-72 rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="w-44 rounded-md border bg-white px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="processing">Processing</option>
            </select>

            <button
              type="button"
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={() => alert("Create Project (MVP placeholder)")}
            >
              + Create Project
            </button>
          </div>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">No projects match your search.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => {
              const dur = formatDuration((s.timeTo ?? 0) - (s.timeFrom ?? 0));
              const yt = getYouTubeId(s.url) ?? "";
              const clips = sumClips(s);
              const peak = peakIntensity(s);

              const statusLabel = s.processed ? "Active" : "Processing";
              const statusStyle = s.processed
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-blue-50 text-blue-700 border-blue-200";

              return (
                <div
                  key={s.id}
                  className="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {yt ? `YouTube • ${yt}` : `Project ${s.id}`}
                      </div>
                      <div className="mt-1 truncate text-xs text-gray-500">{s.url}</div>
                    </div>

                    <div className={`shrink-0 rounded-full border px-2 py-1 text-xs ${statusStyle}`}>
                      {statusLabel}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">⏱</span>
                      <span>{dur}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">📅</span>
                      <span className="text-gray-500">Date placeholder</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">🎬</span>
                      <span>{clips > 0 ? `${clips} clips detected` : "— clips detected"}</span>
                    </div>
                  </div>

                  {/* Peak badge */}
                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Peak Emotional Intensity</div>
                    <div className="mt-1 text-sm font-semibold">{peak ?? "—"}</div>
                    <div className="mt-1 text-xs text-gray-500">Peak emotion: placeholder</div>
                  </div>

                  <button
                    type="button"
                    className="mt-4 w-full rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                    onClick={() => window.location.assign(`/projects/${s.id}`)}
                  >
                    Open Analysis
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}