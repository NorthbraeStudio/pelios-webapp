"use client";

import React, { useState } from "react";

export default function LoginPage() {
  // ✅ Start empty (no credentials visible in UI)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // ✅ prevent accidental double submit
    if (loading) return;

    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ keep backend contract: userName + password
        body: JSON.stringify({
          userName: email.trim(),
          password,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Login failed (${res.status}): ${t}`);
      }

      const data = await res.json();

      // ✅ store token + username once
      // NOTE: confirm your API returns access_Token and userName exactly like this
      localStorage.setItem("pelios_token", data.access_Token);
      localStorage.setItem("pelios_user", data.userName);

      // ✅ optional: clear password from state as soon as we can
      setPassword("");

      // ✅ hard redirect
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

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-3 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {result ? (
          <pre className="max-h-64 overflow-auto rounded-md bg-gray-100 p-3 text-xs">
            {result}
          </pre>
        ) : null}
      </form>
    </main>
  );
}
