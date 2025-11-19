"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "MEMBER";
};

type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  role: "ADMIN" | "MEMBER";
  members: Member[];
};

type Circle = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creatingCircle, setCreatingCircle] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [circleDesc, setCircleDesc] = useState("");

  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [deletingCircleId, setDeletingCircleId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("circlefundr_token");
    setToken(stored);
  }, []);

  async function loadWorkspace(currentToken: string, id: string) {
    setError(null);

    const res = await fetch(`http://localhost:4000/workspaces/${id}`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      let msg = `Failed to load workspace (${res.status})`;
      try {
        const body = await res.json();
        if (body && typeof body.message === "string") msg = body.message;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const body = (await res.json()) as { workspace: Workspace };
    setWorkspace(body.workspace);
  }

  async function loadCircles(currentToken: string, id: string) {
    const url = `http://localhost:4000/circles/by-workspace?workspaceId=${encodeURIComponent(
      id
    )}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      let msg = `Failed to load circles (${res.status})`;
      try {
        const body = await res.json();
        if (body && typeof body.message === "string") msg = body.message;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const body = (await res.json()) as { circles: Circle[] };
    setCircles(body.circles || []);
  }

  useEffect(() => {
    if (!token || !workspaceId) return;

    setLoading(true);
    (async () => {
      try {
        await loadWorkspace(token, workspaceId);
        await loadCircles(token, workspaceId);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setLoading(false);
      }
    })();
  }, [token, workspaceId]);

  async function handleCreateCircle() {
    if (!token || !workspaceId) return;
    if (!circleName.trim()) return;

    setCreatingCircle(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:4000/circles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          name: circleName.trim(),
          description: circleDesc.trim() || null,
        }),
      });

      if (!res.ok) {
        let msg = `Failed to create circle (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") msg = body.message;
        } catch {
          // ignore
        }
        setError(msg);
        setCreatingCircle(false);
        return;
      }

      const body = (await res.json()) as { circle: Circle };
      setCircles((prev) => [...prev, body.circle]);
      setCircleName("");
      setCircleDesc("");
      setCreatingCircle(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong creating circle");
      setCreatingCircle(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!token || !workspaceId || !workspace) return;
    if (workspace.role !== "ADMIN") return;

    const ok = window.confirm(
      "Delete this workspace and all its circles, dues events, and payments? This cannot be undone."
    );
    if (!ok) return;

    setDeletingWorkspace(true);
    setError(null);

    try {
      const res = await fetch(`http://localhost:4000/workspaces/${workspaceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let msg = `Failed to delete workspace (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") msg = body.message;
        } catch {
          // ignore
        }
        setError(msg);
        setDeletingWorkspace(false);
        return;
      }

      // Go back to workspace list
      router.push("/workspaces");
    } catch (err) {
      console.error(err);
      setError("Something went wrong deleting workspace");
      setDeletingWorkspace(false);
    }
  }

  async function handleDeleteCircle(circleId: string) {
    if (!token || !workspace || workspace.role !== "ADMIN") return;

    const ok = window.confirm(
      "Delete this circle and all dues events and payments inside it? This cannot be undone."
    );
    if (!ok) return;

    setDeletingCircleId(circleId);
    setError(null);

    try {
      const res = await fetch(`http://localhost:4000/circles/${circleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let msg = `Failed to delete circle (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") msg = body.message;
        } catch {
          // ignore
        }
        setError(msg);
        setDeletingCircleId(null);
        return;
      }

      setCircles((prev) => prev.filter((c) => c.id !== circleId));
      setDeletingCircleId(null);
    } catch (err) {
      console.error(err);
      setError("Something went wrong deleting circle");
      setDeletingCircleId(null);
    }
  }

  const authed = Boolean(token);
  const isAdmin = workspace?.role === "ADMIN";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] text-slate-500 mb-1">
              Workspace ID:{" "}
              <span className="font-mono text-[10px] text-slate-400">
                {workspaceId}
              </span>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {workspace ? workspace.name : "Workspace"}
            </h1>
            {workspace && (
              <p className="text-xs text-slate-400">
                You are a{" "}
                <span className="font-semibold">{workspace.role}</span> in this
                workspace.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={handleDeleteWorkspace}
                disabled={deletingWorkspace}
                className="text-[11px] px-3 py-1.5 rounded-md border border-red-700/60 bg-red-900/40 text-red-100 hover:bg-red-800/70 disabled:opacity-60"
              >
                {deletingWorkspace ? "Deleting…" : "Delete workspace"}
              </button>
            )}
            <button
              onClick={() => router.push("/workspaces")}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-4"
            >
              Back to all workspaces
            </button>
          </div>
        </header>

        {!authed && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs text-amber-100">
            No token found in <span className="font-mono">localStorage</span>.
            Sign in again, then come back here.
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {loading && (
          <p className="text-xs text-slate-400">Loading workspace…</p>
        )}

        {!loading && workspace && (
          <div className="grid gap-4 md:grid-cols-[2fr,1.3fr]">
            {/* Circles panel */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 flex flex-col">
              <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-slate-300">
                  Circles
                </p>
              </div>

              <div className="px-4 py-3 space-y-3 flex-1">
                {isAdmin && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3 space-y-2">
                    <p className="text-[11px] text-slate-400 mb-1">
                      Create a circle (ex: Spring Trip 2025)
                    </p>
                    <input
                      type="text"
                      placeholder="Circle name"
                      value={circleName}
                      onChange={(e) => setCircleName(e.target.value)}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                    />
                    <textarea
                      placeholder="Short description (optional)"
                      value={circleDesc}
                      onChange={(e) => setCircleDesc(e.target.value)}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 resize-none h-16"
                    />
                    <button
                      onClick={handleCreateCircle}
                      disabled={
                        creatingCircle || !circleName.trim() || !token
                      }
                      className="mt-1 text-[11px] px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      {creatingCircle ? "Creating…" : "Create circle"}
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {circles.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No circles yet. {isAdmin ? "Create one above." : ""}
                    </p>
                  )}

                  {circles.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5 flex items-center justify-between gap-3"
                    >
                      <button
                        onClick={() => router.push(`/circles/${c.id}`)}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {c.description || "No description"}
                        </p>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteCircle(c.id)}
                          disabled={deletingCircleId === c.id}
                          className="text-[10px] px-2 py-1 rounded-md border border-red-700/60 bg-red-900/40 text-red-100 hover:bg-red-800/70 disabled:opacity-60"
                        >
                          {deletingCircleId === c.id
                            ? "Deleting…"
                            : "Delete"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Members panel */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/70">
              <div className="border-b border-slate-800 px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-slate-300">
                  Members
                </p>
              </div>
              <div className="px-4 py-3 space-y-2">
                {workspace.members.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No members yet. (You should at least see yourself here.)
                  </p>
                )}
                {workspace.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm">
                        {m.name || m.email}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {m.email}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-200">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
