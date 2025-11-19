"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("nahum.dev@example.com");
  const [password, setPassword] = useState("password123");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem("circlefundr_token");
    if (existing) {
      // optional: auto-redirect if already logged in
      // router.push("/workspaces");
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!res.ok) {
        let message = `Failed to sign in (${res.status})`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body && typeof body.message === "string") {
            message = body.message;
          }
        } catch {
          // ignore
        }
        setError(message);
        setLoading(false);
        return;
      }

      const body = (await res.json()) as {
        user: { id: string; name: string; email: string };
        token: string;
      };

      localStorage.setItem("circlefundr_token", body.token);

      router.push("/workspaces");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to CircleFundr
          </h1>
          <p className="text-sm text-slate-400">
            Manage circles, members, and dues in one place.
          </p>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Email</label>
              <input
                type="email"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Password</label>
              <input
                type="password"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-sm px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-300"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center">
            Need an account?{" "}
            <Link
              href="/register"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
            >
              Sign up
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
