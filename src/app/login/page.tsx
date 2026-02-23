"use client";

/**
 * Login Page
 *
 * Purpose:
 * - Collect user credentials
 * - Call our internal Next.js auth route (/api/auth/token)
 * - That route talks to Azure and sets an HttpOnly cookie
 * - On success → redirect to /projects
 *
 * Important:
 * - We DO NOT call Azure directly from the browser
 * - We NEVER expose the real API base URL here
 */

import React, { useState } from "react";

export default function LoginPage() {
  /**
   * Local state
   *
   * We intentionally start with empty fields.
   * No credentials should ever be hardcoded into the UI.
   */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /**
   * UI state
   *
   * result  → displays error messages
   * loading → prevents double submits + disables button
   */
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  /**
   * handleLogin
   *
   * Flow:
   * 1) Prevent default form submission
   * 2) Call internal auth route
   * 3) If success → redirect
   * 4) If fail → show error
   */
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Prevent accidental double-click submissions
    if (loading) return;

    setLoading(true);
    setResult("");

    try {
      /**
       * We call our own API route:
       * POST /api/auth/token
       *
       * That route:
       * - Talks to Azure
       * - Receives access_Token
       * - Stores it in an HttpOnly cookie (pelios_token)
       */
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // IMPORTANT: backend expects userName (not email)
          userName: email.trim(),
          password,
        }),
      });

      // If Azure rejected credentials, bubble up readable error
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Login failed (${res.status}): ${t}`);
      }

      const data = await res.json();

      /**
       * SECURITY NOTE:
       *
       * The real auth token should be set server-side in an HttpOnly cookie.
       * We should NOT rely on localStorage for authentication.
       *
       * If your /api/auth/token route already sets pelios_token cookie,
       * storing token in localStorage is not required.
       */

      // Store username for UI display only (non-sensitive)
      localStorage.setItem("pelios_user", data.userName);

      // Clear password from memory immediately
      setPassword("");

      /**
       * Hard redirect ensures:
       * - Fresh load
       * - Middleware runs
       * - Protected routes are enforced cleanly
       */
      window.location.assign("/projects");
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm space-y-4"
      >
        <h1 className="text-2xl font-semibold">Pelios Login</h1>

        {/* Email Field */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="w-full rounded-md border px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="name@company.com"
            required
          />
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="w-full rounded-md border px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••••"
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-3 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* Error Output */}
        {result ? (
          <pre className="max-h-64 overflow-auto rounded-md bg-gray-100 p-3 text-xs">
            {result}
          </pre>
        ) : null}
      </form>
    </main>
  );
}