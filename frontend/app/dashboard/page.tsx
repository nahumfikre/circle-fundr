"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, logout } from "@/lib/api";

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
  const router = useRouter();
  const [user, setUser] = useState<StoredUser>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Check if user is authenticated
  const isAuthed = !!user;

  const handleLogout = async () => {
    await logout();
  };

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("circlefundr_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    async function fetchWorkspaces() {
      setLoadingWorkspaces(true);
      setWorkspaceError(null);

      try {
        const res = await apiFetch("/workspaces");

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
  }, []);


  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              View and manage your workspaces, circles, and payment events
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

        {!isAuthed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              No authentication token found. Please{" "}
              <a href="/login" className="font-medium underline hover:no-underline">
                sign in
              </a>{" "}
              to continue.
            </p>
          </div>
        )}

        {isAuthed && (
          <>
            {/* User Info Card */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Account
                </h2>
              </div>
              <div className="px-6 py-4">
                {user ? (
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user.name || "User"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    User information not available
                  </p>
                )}
              </div>
            </div>

            {/* Workspaces Card */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                    Workspaces
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Manage your group finances and dues
                  </p>
                </div>
                {!loadingWorkspaces && workspaces.length > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
                  </span>
                )}
              </div>

              <div className="px-6 py-4">
                {loadingWorkspaces && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}

                {workspaceError && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {workspaceError}
                    </p>
                  </div>
                )}

                {!loadingWorkspaces && !workspaceError && workspaces.length === 0 && (
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
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      No workspaces yet
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Create one to get started with CircleFundr
                    </p>
                  </div>
                )}

                {!loadingWorkspaces && workspaces.length > 0 && (
                  <div className="space-y-3">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        className="group flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
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
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {ws.name}
                            </p>
                            {ws.role && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {ws.role}
                              </p>
                            )}
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
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
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

