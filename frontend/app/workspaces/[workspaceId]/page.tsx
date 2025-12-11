"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, logout } from "@/lib/api";

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

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creatingCircle, setCreatingCircle] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [circleDesc, setCircleDesc] = useState("");

  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [deletingCircleId, setDeletingCircleId] = useState<string | null>(null);

  const [addingMember, setAddingMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"MEMBER" | "ADMIN">("MEMBER");

  async function loadWorkspace(id: string) {
    setError(null);

    const res = await apiFetch(`/workspaces/${id}`, {
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

  async function loadCircles(id: string) {
    const url = `/circles/by-workspace?workspaceId=${encodeURIComponent(id)}`;

    const res = await apiFetch(url, {
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
    if (!workspaceId) return;

    setLoading(true);
    (async () => {
      try {
        await loadWorkspace(workspaceId);
        await loadCircles(workspaceId);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  async function handleCreateCircle() {
    if (!workspaceId) return;
    if (!circleName.trim()) return;

    setCreatingCircle(true);
    setError(null);

    try {
      const res = await apiFetch("/circles", {
        method: "POST",
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
    if (!workspaceId || !workspace) return;
    if (workspace.role !== "ADMIN") return;

    const ok = window.confirm(
      "Delete this workspace and all its circles, dues events, and payments? This cannot be undone."
    );
    if (!ok) return;

    setDeletingWorkspace(true);
    setError(null);

    try {
      const res = await apiFetch(`/workspaces/${workspaceId}`, {
        method: "DELETE",
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
    if (!workspace || workspace.role !== "ADMIN") return;

    const ok = window.confirm(
      "Delete this circle and all dues events and payments inside it? This cannot be undone."
    );
    if (!ok) return;

    setDeletingCircleId(circleId);
    setError(null);

    try {
      const res = await apiFetch(`/circles/${circleId}`, {
        method: "DELETE",
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

  async function handleAddMember() {
    if (!workspaceId || !workspace) return;
    if (workspace.role !== "ADMIN") return;
    if (!memberEmail.trim()) return;

    setAddingMember(true);
    setError(null);

    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: memberEmail.trim(),
          role: memberRole,
        }),
      });

      if (!res.ok) {
        let msg = `Failed to add member (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") msg = body.message;
        } catch {
          // ignore
        }
        setError(msg);
        setAddingMember(false);
        return;
      }

      const body = (await res.json()) as { member: Member };
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              members: [...prev.members, body.member],
            }
          : null
      );
      setMemberEmail("");
      setMemberRole("MEMBER");
      setAddingMember(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong adding member");
      setAddingMember(false);
    }
  }

  const isAdmin = workspace?.role === "ADMIN";

  const handleLogout = async () => {
    await logout();
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/workspaces")}
                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to workspaces
              </button>
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {workspace ? workspace.name : "Workspace"}
            </h1>
            {workspace && (
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  workspace.role === "ADMIN"
                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                }`}>
                  {workspace.role}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {workspace.members.length} {workspace.members.length === 1 ? "member" : "members"}
                </span>
              </div>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={handleDeleteWorkspace}
              disabled={deletingWorkspace}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deletingWorkspace ? "Deleting…" : "Delete workspace"}
            </button>
          )}
        </header>


        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && workspace && (
          <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
            {/* Circles panel */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Circles
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Manage dues and payments for specific events
                </p>
              </div>

              <div className="px-6 py-4 space-y-4">
                {isAdmin && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Create a new circle
                      </label>
                      <input
                        type="text"
                        placeholder="Circle name (e.g., Spring Trip 2025)"
                        value={circleName}
                        onChange={(e) => setCircleName(e.target.value)}
                        className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <textarea
                        placeholder="Description (optional)"
                        value={circleDesc}
                        onChange={(e) => setCircleDesc(e.target.value)}
                        className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-20 transition-shadow"
                      />
                    </div>
                    <button
                      onClick={handleCreateCircle}
                      disabled={creatingCircle || !circleName.trim()}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                      {creatingCircle ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create circle
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {circles.length === 0 && (
                    <div className="text-center py-8">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        No circles yet
                      </p>
                      {isAdmin && (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Create one above to get started
                        </p>
                      )}
                    </div>
                  )}

                  {circles.map((c) => (
                    <div
                      key={c.id}
                      className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-200"
                    >
                      <button
                        onClick={() => router.push(`/circles/${c.id}`)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
                            <svg
                              className="w-5 h-5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {c.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {c.description || "No description"}
                            </p>
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0 ml-3"
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
                      </button>
                      {isAdmin && (
                        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-end">
                          <button
                            onClick={() => handleDeleteCircle(c.id)}
                            disabled={deletingCircleId === c.id}
                            className="inline-flex items-center text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {deletingCircleId === c.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Members panel */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Members
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Manage workspace access
                </p>
              </div>
              <div className="px-6 py-4 space-y-4">
                {/* Add member form (admin only) */}
                {isAdmin && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Add member
                      </label>
                      <input
                        type="email"
                        placeholder="user@example.com"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Role
                      </label>
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value as "MEMBER" | "ADMIN")}
                        className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    <button
                      onClick={handleAddMember}
                      disabled={addingMember || !memberEmail.trim()}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                      {addingMember ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Adding…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          Add member
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Members list */}
                <div className="space-y-2">
                  {workspace.members.length === 0 && (
                    <div className="text-center py-6">
                      <svg
                        className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        No members yet
                      </p>
                    </div>
                  )}
                  {workspace.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                          {(m.name || m.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {m.name || m.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {m.email}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ml-3 flex-shrink-0 ${
                        m.role === "ADMIN"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
