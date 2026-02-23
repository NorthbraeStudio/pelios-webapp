"use client";

/**
 * ==========================================================
 * PROJECTS CLIENT COMPONENT
 * ----------------------------------------------------------
 * Purpose:
 * - Handles all UI logic.
 * - Uses React state + effects.
 * - Calls /api/projects (which uses cookie auth).
 *
 * Important:
 * - This file must stay a Client Component.
 * - Do NOT import next/headers or redirect here.
 * ==========================================================
 */

import React, { useEffect, useMemo, useState } from "react";

// Adjust this type to match your actual Source shape
type Source = {
  id: number;
  name?: string;
  url?: string;
  processed?: boolean;
};

export default function ProjectsClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  /**
   * Load projects from server
   * - Uses cookie-based auth (HttpOnly)
   * - credentials: "include" ensures cookie is sent
   */
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await fetch("/api/projects", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Failed to load projects (${res.status}): ${t}`);
        }

        const data = await res.json();
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
     Render UI
  ========================= */

  if (loading) {
    return <div className="p-6">Loading projects...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Projects</h1>

      {sources.length === 0 ? (
        <div>No projects found.</div>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="rounded-md border p-3 bg-white shadow-sm"
            >
              {s.name ?? s.url ?? `Project ${s.id}`}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}