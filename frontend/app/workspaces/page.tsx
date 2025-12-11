"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, logout } from "@/lib/api";

type WorkspaceSummary = {
  id: string;
  name: string;
  createdAt: string;
  role: "ADMIN" | "MEMBER";
};

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleLogout = async () => {
    await logout(); // Handles cookie clearing and redirect
  };

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/workspaces", {
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

    setCreating(true);

    try {
      const res = await apiFetch("/workspaces", {
        method: "POST",
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
    <main className="min-h-screen bg-white dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Your Workspaces
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Create a new workspace or manage your existing ones
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
          <Link
            href="/workspaces/join"
            className="inline-flex items-center px-4 py-2 rounded-lg border border-blue-600 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Join Workspace
          </Link>
        </header>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Create Workspace
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Start a new workspace for your group
            </p>
          </div>
          <div className="px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., EESA Exec Board, Fantasy League, Housemates..."
                className="flex-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading workspaces…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 flex items-start">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!loading && !error && workspaces.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
              No workspaces yet
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Create one above or join an existing workspace with an invite code
            </p>
          </div>
        )}

        {!loading && workspaces.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                My Workspaces
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
              </p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {workspaces.map((w) => (
                <Link
                  key={w.id}
                  href={`/workspaces/${w.id}`}
                  className="block px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-gray-900 dark:text-white truncate">
                          {w.name}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            w.role === "ADMIN"
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                          }`}>
                            {w.role}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Created {new Date(w.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 dark:text-gray-600 flex-shrink-0 ml-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
