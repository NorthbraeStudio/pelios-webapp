"use client";

/**
 * ==========================================================
 * PROJECT CLIENT (DETAIL UI)
 * ----------------------------------------------------------
 * What this file does:
 * - Runs in the browser (client component)
 * - Fetches the project list from /api/projects (cookie auth)
 * - Finds the project by id
 * - Shows a clean UI and a button to go back to /projects
 *
 * Why we do it this way:
 * - No token in JS (HttpOnly cookie does the auth)
 * - Same API route you already have working
 * ==========================================================
 */

import React, { useEffect, useMemo, useState } from "react";

type Face = any; // keep loose for now until you start using faces data properly

type Source = {
  id: number;
  url: string;
  timeFrom: number;
  timeTo: number;
  processed: boolean;
  userId: string;
  faces: Face[];
};

function formatDuration(from: number, to: number) {
  const secs = Math.max(0, (to ?? 0) - (from ?? 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ProjectClient({ sourceId }: { sourceId: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Convert route param to number once
  const idNum = useMemo(() => Number(sourceId), [sourceId]);

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
          throw new Error(`Failed to load project (${res.status}): ${t}`);
        }

        const data = (await res.json()) as Source[];
        setSources(data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const project = useMemo(() => sources.find((s) => s.id === idNum), [sources, idNum]);

  if (loading) return <div className="p-6">Loading project…</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="font-semibold">Couldn’t load project</div>
          <pre className="mt-2 max-h-64 overflow-auto text-xs">{error}</pre>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 space-y-4">
        <button
          className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => window.location.assign("/projects")}
        >
          ← Back to Projects
        </button>

        <div className="rounded-lg border bg-white p-6">
          <div className="text-lg font-semibold">Project not found</div>
          <div className="mt-2 text-sm text-gray-600">
            No project exists with ID: <span className="font-mono">{sourceId}</span>
          </div>
        </div>
      </div>
    );
  }

  const duration = formatDuration(project.timeFrom, project.timeTo);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <button
          className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => window.location.assign("/projects")}
        >
          ← Back to Projects
        </button>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">
                Project Analysis — ID {project.id}
              </h1>
              <div className="mt-2 truncate text-sm text-gray-600">{project.url}</div>
            </div>

            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                project.processed
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {project.processed ? "Processed" : "Processing"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Duration</div>
              <div className="mt-1 font-semibold">{duration}</div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Faces detected</div>
              <div className="mt-1 font-semibold">{project.faces?.length ?? 0}</div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Clips detected</div>
              <div className="mt-1 font-semibold">—</div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border bg-white p-4">
            <div className="text-sm font-semibold">Next step</div>
            <div className="mt-1 text-sm text-gray-600">
              Wire this page to GetPlaybackData and render:
              line chart + clips list + jump-to-video controls.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}