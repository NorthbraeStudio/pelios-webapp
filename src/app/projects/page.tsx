"use client";

import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Types
========================= */
type Source = {
  id: number;
  url: string;
  timeFrom: number; // seconds (absolute)
  timeTo: number;   // seconds (absolute)
  processed: boolean;
};

type Card = {
  id: number;
  title: string;
  subtitle: string;
  status: "Active" | "Processing";
  duration: string;        // m:ss
  windowLabel: string;     // "Window Analysed"
  windowRange: string;     // "1:00:00 – 1:01:26"
  processed: boolean;
  thumb: string | null;

  // placeholders for when backend adds data
  mainEmotion: string;     // e.g. "Joy" or "—"
  peakIntensity: number;   // 0–100 placeholder
  speakers: number;        // placeholder
};

type StatCard = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
};

/* =========================
   Helpers (time + youtube)
========================= */

// Seconds -> H:MM:SS or M:SS
function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatDuration(from: number, to: number) {
  const secs = Math.max(0, (to ?? 0) - (from ?? 0));
  return formatClock(secs);
}

function windowAnalysed(from: number, to: number) {
  // Convert absolute seconds into a user-readable range
  // e.g. 3600 -> 1:00:00
  return `${formatClock(from)} – ${formatClock(to)}`;
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "") || null;
    }

    const v = u.searchParams.get("v");
    if (v) return v;

    const parts = u.pathname.split("/").filter(Boolean);
    const shortsIndex = parts.indexOf("shorts");
    if (shortsIndex !== -1 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];

    return null;
  } catch {
    return null;
  }
}

function getYouTubeThumb(url: string) {
  const id = getYouTubeId(url);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function titleFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube") || u.hostname.includes("youtu.be")
      ? "YouTube Source"
      : u.hostname;
  } catch {
    return "Source";
  }
}

function initialsFromName(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function emotionBadgeClass(emotion: string) {
  const e = (emotion || "").toLowerCase();

  if (e.includes("joy") || e.includes("happy")) return "bg-yellow-50 text-yellow-800 border-yellow-200";
  if (e.includes("anger") || e.includes("rage")) return "bg-red-50 text-red-800 border-red-200";
  if (e.includes("sad") || e.includes("grief")) return "bg-blue-50 text-blue-800 border-blue-200";
  if (e.includes("fear") || e.includes("anx")) return "bg-purple-50 text-purple-800 border-purple-200";
  if (e.includes("surprise")) return "bg-indigo-50 text-indigo-800 border-indigo-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

/* =========================
   Tiny inline icons (no deps)
========================= */
function IconFolder() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-600">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-600">
      <path
        d="M7 3v3M17 3v3M4 8h16M6 21h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-600">
      <path
        d="M15 10l5-3v10l-5-3v-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrendUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-600">
      <path
        d="M3 17l7-7 4 4 7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 7h7v7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================
   Component
========================= */
export default function ProjectsPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Toolbar state
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "processing">("all");

  // UI user display (cookie or localStorage; either is fine since it’s not sensitive)
  const userName =
    (typeof window !== "undefined" && (localStorage.getItem("pelios_user") || "")) ||
    "bob@bob.com";
  const initials = initialsFromName(userName);

  /* =========================
     Load projects (COOKIE AUTH)
     - token is in HttpOnly cookie
     - we must include cookies in request
  ========================= */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/projects", {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Failed to load projects (${res.status}): ${t}`);
        }

        const data = (await res.json()) as Source[];
        setSources(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* =========================
     Stats (MVP computed)
  ========================= */
  const stats: StatCard[] = useMemo(() => {
    const totalProjects = sources.length;
    const analysedThisMonth = sources.filter((s) => s.processed).length;
    const totalVideosProcessed = sources.filter((s) => s.processed).length;
    const avgIntensity = 78; // placeholder

    return [
      { label: "Total Projects", value: String(totalProjects), icon: <IconFolder /> },
      {
        label: "Projects Analysed This Month",
        value: String(analysedThisMonth),
        sub: "+3 from last month",
        icon: <IconCalendar />,
      },
      { label: "Total Videos Processed", value: String(totalVideosProcessed), icon: <IconVideo /> },
      { label: "Avg Emotional Intensity", value: String(avgIntensity), icon: <IconTrendUp /> },
    ];
  }, [sources]);

  /* =========================
     Cards (with placeholders)
     - this is where backend fields will slot in later
  ========================= */
  const cards: Card[] = useMemo(() => {
    return sources.map((s) => {
      const status: Card["status"] = s.processed ? "Active" : "Processing";

      // Placeholders until DB is ready
      const mainEmotion = s.processed ? "Joy" : "—";
      const peakIntensity = 82; // placeholder %
      const speakers = 2; // placeholder

      return {
        id: s.id,
        title: titleFromUrl(s.url),
        subtitle: s.url,
        status,
        duration: formatDuration(s.timeFrom, s.timeTo),
        windowLabel: "Window Analysed",
        windowRange: windowAnalysed(s.timeFrom, s.timeTo),
        processed: s.processed,
        thumb: getYouTubeThumb(s.url),
        mainEmotion,
        peakIntensity,
        speakers,
      };
    });
  }, [sources]);

  /* =========================
     Filtered cards (search + status)
  ========================= */
  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase();

    return cards.filter((c) => {
      const matchesSearch =
        q.length === 0 ||
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q);

      const matchesFilter =
        filter === "all" ||
        (filter === "active" && c.status === "Active") ||
        (filter === "processing" && c.status === "Processing");

      return matchesSearch && matchesFilter;
    });
  }, [cards, search, filter]);

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

  return (
    <main className="min-h-screen bg-white">
      {/* =========================
          Top Nav
      ========================= */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
              <span className="text-sm font-semibold">P</span>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-sm font-medium text-gray-900">Pelios AI</div>
              <div className="text-2xl font-semibold text-gray-900">Projects</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                {initials}
              </div>
              <div className="text-sm text-gray-700">{userName}</div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-gray-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-600">
                <path
                  d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M15 12H3m0 0l3-3m-3 3l3 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* =========================
          Page Content
      ========================= */}
      <div className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        <p className="text-sm text-gray-600">Select a project to view emotional analysis</p>

        {loading ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600 shadow-sm">
            Loading projects…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">
            {error}
          </div>
        ) : null}

        {/* Stats */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">{s.label}</div>
                  <div className="text-2xl font-semibold text-gray-900">{s.value}</div>
                  {s.sub ? <div className="text-sm text-green-600">{s.sub}</div> : null}
                </div>
                <div className="rounded-lg bg-gray-50 p-2">{s.icon}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Toolbar */}
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your Projects</h2>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[260px]">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                  <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M21 21l-4.3-4.3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full rounded-xl border bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div className="w-full sm:w-[160px]">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="w-full rounded-xl border bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="processing">Processing</option>
              </select>
            </div>

            <button
              onClick={() => alert("Create Project (hook up later)")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              <span className="text-lg leading-none">+</span>
              Create Project
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((c) => (
            <article
              key={c.id}
              className="group flex h-[560px] flex-col rounded-2xl border bg-white p-6 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{c.title}</h3>
                  <p className="text-xs text-gray-500 break-all">{c.subtitle}</p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs border ${
                    c.status === "Active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {c.status}
                </span>
              </div>

              {/* Media (fixed height so all cards match) */}
              <div className="mt-4 h-[220px] overflow-hidden rounded-xl bg-gray-100">
                {c.thumb ? (
                  <img
                    src={c.thumb}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                    No thumbnail
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="mt-4 flex-1 text-sm text-gray-700">
                <div className="grid grid-cols-2 gap-y-3">
                  <div className="text-gray-500">Duration</div>
                  <div className="text-right font-medium text-gray-900">{c.duration}</div>

                  <div className="text-gray-500">{c.windowLabel}</div>
                  <div className="text-right font-medium text-gray-900">{c.windowRange}</div>

                  <div className="text-gray-500">Peak Intensity</div>
                  <div className="text-right font-medium text-gray-900">{c.peakIntensity}%</div>

                  <div className="text-gray-500">Speakers</div>
                  <div className="text-right font-medium text-gray-900">{c.speakers}</div>
                </div>

                {/* Main Emotion badge */}
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Main Emotion</span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${emotionBadgeClass(c.mainEmotion)}`}
                    title="Placeholder until backend provides main emotion"
                  >
                    {c.mainEmotion === "—" ? "Pending" : c.mainEmotion}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <button
                disabled={!c.processed}
                onClick={() => window.location.assign(`/analysis/${c.id}`)}
                className="mt-5 w-full rounded-xl bg-gray-900 px-3 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-50 disabled:hover:bg-gray-900"
                title={!c.processed ? "Processing — analysis not ready yet" : ""}
              >
                Open Analysis
              </button>
            </article>
          ))}
        </section>

        {!loading && !error && visibleCards.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600 shadow-sm">
            No projects match your filters.
          </div>
        ) : null}
      </div>
    </main>
  );
}
