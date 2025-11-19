"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type WorkspaceSummary = {
  id: string;
  name: string;
  createdAt: string;
  role: "ADMIN" | "MEMBER";
};

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("circlefundr_token");
    if (!token) {
      setError("You need to be signed in.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await fetch("http://localhost:4000/workspaces", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const body = await res.json().catch(() => ({} as any));

        if (!res.ok) {
          setError(body.message || "Failed to load workspaces");
          setLoading(false);
          return;
        }

        setWorkspaces(body.workspaces || []);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Something went wrong loading workspaces");
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleCreate() {
    setError("");
    const name = newName.trim();
    if (!name) return;

    const token = localStorage.getItem("circlefundr_token");
    if (!token) {
      setError("You need to be signed in.");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("http://localhost:4000/workspaces", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const body = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setError(body.message || "Failed to create workspace");
        setCreating(false);
        return;
      }

      if (body.workspace) {
        setWorkspaces((prev) => [...prev, body.workspace]);
        setNewName("");
      }

      setCreating(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong creating workspace");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex justify-center px-4 py-8">
      <div className="w-full max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Your workspaces
            </h1>
            <p className="text-sm text-slate-400">
              Create a new workspace or jump into an existing one.
            </p>
          </div>
          <Link
            href="/workspaces/join"
            className="text-xs rounded-md border border-emerald-500/60 px-3 py-1.5 text-emerald-300 hover:bg-emerald-500/10"
          >
            Join workspace
          </Link>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4 space-y-3">
          <p className="text-xs font-semibold text-slate-300">
            Create workspace
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="EESA Exec Board, Fantasy League, Housemates, etc."
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-300"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </section>

        {loading && (
          <p className="text-sm text-slate-400">Loading workspaces…</p>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {!loading && !error && workspaces.length === 0 && (
          <p className="text-sm text-slate-500">
            You do not have any workspaces yet. Create one above or join an
            existing workspace with an invite code.
          </p>
        )}

        {!loading && workspaces.length > 0 && (
          <div className="space-y-2">
            {workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/workspaces/${w.id}`}
                className="block rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 hover:border-emerald-500/60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-[11px] text-slate-400">
                      Role: {w.role}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
