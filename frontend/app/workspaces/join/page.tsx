"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function JoinWorkspacePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleJoin() {
    setError("");
    setSuccess("");

    const trimmed = code.trim();
    if (!trimmed) {
      setError("Invite code is required");
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiFetch("/workspaces/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: trimmed }),
      });

      const body = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setError(body.message || "Failed to join workspace");
        setSubmitting(false);
        return;
      }

      setSuccess("Joined workspace successfully");
      setSubmitting(false);

      setTimeout(() => {
        router.push("/workspaces");
      }, 1000);
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Join a workspace
          </h1>
          <p className="text-sm text-slate-400">
            Paste the invite code you received from an admin.
          </p>
        </header>

        <div className="space-y-2">
          <label className="text-xs text-slate-300">
            Invite code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="w_abc123xyz"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-300"
        >
          {submitting ? "Joining..." : "Join workspace"}
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 rounded-md px-3 py-2">
            {success}
          </p>
        )}

        <button
          onClick={() => router.push("/workspaces")}
          className="w-full text-xs text-slate-400 hover:text-slate-200 mt-2"
        >
          Back to workspaces
        </button>
      </div>
    </main>
  );
}
