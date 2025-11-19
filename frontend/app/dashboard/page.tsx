"use client";

import { useEffect, useState } from "react";

type StoredUser = {
  id: string;
  name: string | null;
  email: string;
} | null;

type Workspace = {
  id: string;
  name: string;
  role?: string;
  createdAt?: string;
};

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("circlefundr_token");
    const storedUser = localStorage.getItem("circlefundr_user");

    setToken(storedToken);

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    async function fetchWorkspaces() {
      setLoadingWorkspaces(true);
      setWorkspaceError(null);

      try {
        const res = await fetch("http://localhost:4000/workspaces", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          let message = `Failed to load workspaces (${res.status})`;
          try {
            const data = await res.json();
            if (data && typeof data.message === "string") {
              message = data.message;
            }
          } catch {
            // ignore
          }
          setWorkspaceError(message);
          setLoadingWorkspaces(false);
          return;
        }

        const data = await res.json();
        // expecting shape: { workspaces: [...] }
        const list: Workspace[] = data.workspaces ?? [];
        setWorkspaces(list);
        setLoadingWorkspaces(false);
      } catch (err) {
        console.error(err);
        setWorkspaceError("Something went wrong loading workspaces");
        setLoadingWorkspaces(false);
      }
    }

    fetchWorkspaces();
  }, [token]);

  const isAuthed = Boolean(token);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-3xl w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-300">
            View your workspaces and, soon, circles and dues events. This page
            is talking directly to your backend on <span className="font-mono text-xs">localhost:4000</span>.
          </p>
        </div>

        {!isAuthed && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs text-amber-100">
            No token found in <span className="font-mono">localStorage</span>.
            Try signing in again from the home page.
          </div>
        )}

        {isAuthed && (
          <>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 space-y-1">
              <p className="text-xs text-slate-400 mb-1">Signed-in user</p>
              {user ? (
                <>
                  <p className="text-sm font-medium">
                    {user.name || "No name set"}
                  </p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  No user object stored. Login response might not be saving user
                  info yet.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Workspaces</p>
                  <p className="text-sm font-medium">
                    Groups where you track dues and buy-ins
                  </p>
                </div>
              </div>

              {loadingWorkspaces && (
                <p className="text-xs text-slate-400">Loading workspaces...</p>
              )}

              {workspaceError && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
                  {workspaceError}
                </p>
              )}

              {!loadingWorkspaces && !workspaceError && workspaces.length === 0 && (
                <p className="text-xs text-slate-500">
                  You don&apos;t have any workspaces yet. For now, create one via
                  Thunder Client with <span className="font-mono text-[11px]">POST /workspaces</span>.
                </p>
              )}

              {!loadingWorkspaces && workspaces.length > 0 && (
                <div className="space-y-2">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{ws.name}</p>
                        {ws.role && (
                          <p className="text-[11px] text-slate-500">
                            Role: {ws.role}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-slate-900 text-slate-300">
                        workspace
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">Stored token</p>
              {token ? (
                <p className="text-[11px] break-all text-slate-200">
                  {token}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  No token in localStorage.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

