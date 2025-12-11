"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, logout } from "@/lib/api";

type Circle = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  workspaceId: string;
};

type PaymentEvent = {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  createdAt: string;
};

type Member = {
  id: string;
  name: string | null;
  email: string;
};

export default function CirclePage() {
  const params = useParams<{ circleId: string }>();
  const router = useRouter();
  const circleId = params.circleId;

  const [circle, setCircle] = useState<Circle | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [loadingCircle, setLoadingCircle] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!circleId) {
      setLoadingCircle(false);
      return;
    }

    async function loadCircle() {
      try {
        setLoadingCircle(true);
        setError(null);

        const res = await apiFetch(
          `/circles/${encodeURIComponent(circleId)}`,
          {
            cache: "no-store",
          }
        );

        if (!res.ok) {
          let message = `Failed to load circle (${res.status})`;
          try {
            const body = await res.json();
            if (body && typeof body.message === "string") {
              message = body.message;
            }
          } catch {
            // ignore
          }
          setError(message);
          setCircle(null);
          setLoadingCircle(false);
          return;
        }

        const body = await res.json();
        setCircle(body.circle as Circle);
        setLoadingCircle(false);
      } catch (err) {
        console.error(err);
        setError("Something went wrong loading circle");
        setLoadingCircle(false);
      }
    }

    loadCircle();
  }, [circleId]);

  async function loadEvents(currentCircleId: string) {
    try {
      setLoadingEvents(true);
      setError(null);

      const url = `/payment-events/by-circle?circleId=${encodeURIComponent(
        currentCircleId
      )}`;

      const res = await apiFetch(url, {
        cache: "no-store",
      });

      if (!res.ok) {
        let message = `Failed to load events (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            message = body.message;
          }
        } catch {
          // ignore
        }
        setError(message);
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      const body = await res.json();
      setEvents((body.events || []) as PaymentEvent[]);
      setLoadingEvents(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong loading events");
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    if (!circleId) return;
    loadEvents(circleId);
  }, [circleId]);

  async function loadMembers(currentCircleId: string) {
    try {
      setLoadingMembers(true);
      setError(null);

      const url = `/memberships/by-circle?circleId=${encodeURIComponent(
        currentCircleId
      )}`;

      const res = await apiFetch(url, {
        cache: "no-store",
      });

      if (!res.ok) {
        let message = `Failed to load members (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            message = body.message;
          }
        } catch {
          // ignore
        }
        setError(message);
        setMembers([]);
        setLoadingMembers(false);
        return;
      }

      const body = await res.json();
      setMembers((body.members || []) as Member[]);
      setLoadingMembers(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong loading members");
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    if (!circleId) return;
    loadMembers(circleId);
  }, [circleId]);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!circleId) return;

    const title = newTitle.trim();
    const amountNumber = Number(newAmount);
    const dueDate = newDueDate;

    if (!title || !amountNumber || !dueDate) return;

    try {
      setCreatingEvent(true);
      setError(null);

      const res = await apiFetch("/payment-events", {
        method: "POST",
        body: JSON.stringify({
          title,
          amount: amountNumber,
          dueDate,
          circleId,
        }),
      });

      if (!res.ok) {
        let message = `Failed to create event (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            message = body.message;
          }
        } catch {
          // ignore
        }
        setError(message);
        setCreatingEvent(false);
        return;
      }

      const body = await res.json();
      const created = body.event as PaymentEvent;

      setEvents((prev) => [created, ...prev]);
      setNewTitle("");
      setNewAmount("");
      setNewDueDate("");
      setCreatingEvent(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong creating event");
      setCreatingEvent(false);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!circleId) return;

    const email = inviteEmail.trim();
    const name = inviteName.trim();

    if (!email) return;

    try {
      setInviting(true);
      setError(null);

      const res = await apiFetch("/memberships/circles", {
        method: "POST",
        body: JSON.stringify({
          circleId,
          email,
          name: name || undefined,
        }),
      });

      if (!res.ok) {
        let message = `Failed to add member (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            message = body.message;
          }
        } catch {
          // ignore
        }
        setError(message);
        setInviting(false);
        return;
      }

      const body = await res.json();
      const newMembership = body.membership as {
        user: { id: string; name: string | null; email: string };
      };

      setMembers((prev) => [
        ...prev,
        {
          id: newMembership.user.id,
          name: newMembership.user.name,
          email: newMembership.user.email,
        },
      ]);

      setInviteEmail("");
      setInviteName("");
      setInviting(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong adding member");
      setInviting(false);
    }
  }


  const handleLogout = async () => {
    await logout();
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">
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
              {circle?.name || "Circle"}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage payment events and members in this circle
            </p>
            {circle?.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                {circle.description}
              </p>
            )}
          </div>
          {circle && (
            <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
              Created {new Date(circle.createdAt).toLocaleDateString()}
            </div>
          )}
        </header>


        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 flex items-start">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <section className="space-y-6">
            {/* Create event form */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Create Payment Event
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Set up a new dues collection (e.g., Fall Dues, Tournament Buy-In)
                </p>
              </div>
              <form onSubmit={handleCreateEvent} className="px-6 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Event Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g., Fall Dues 2024"
                      className="w-full rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="$0.00"
                      className="w-full rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="w-full md:w-40">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      creatingEvent ||
                      !newTitle.trim() ||
                      !newAmount.trim() ||
                      !newDueDate.trim()
                    }
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingEvent ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Events list */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Payment Events
                </h2>
                {events.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {events.length} {events.length === 1 ? "event" : "events"}
                  </p>
                )}
              </div>

              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 px-6">
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    No payment events yet
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Create one above to start tracking payments
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                      onClick={() =>
                        router.push(
                          `/payment-events/${encodeURIComponent(ev.id)}`
                        )
                      }
                    >
                      <div className="flex items-center justify-between">
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
                              {ev.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ${ev.amount.toFixed(2)} · Due{" "}
                              {new Date(ev.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(ev.createdAt).toLocaleDateString()}
                          </span>
                          <svg
                            className="w-5 h-5 text-gray-400 dark:text-gray-600"
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Members list + invite */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Circle Members
                </h2>
                {members.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </p>
                )}
              </div>

              <div className="px-6 py-4 space-y-4">
                <form
                  onSubmit={handleInviteMember}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4"
                >
                  <div className="mb-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Add Member
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Invite someone to this circle to track their payments
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Name (optional)"
                      className="flex-1 sm:flex-initial sm:w-40 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                      {inviting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Adding...
                        </>
                      ) : (
                        "Add"
                      )}
                    </button>
                  </div>
                </form>

                {loadingMembers ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-6">
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
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      No members yet
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Add someone above to start tracking their dues
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center space-x-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3"
                      >
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                          {(m.name || m.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {m.name || m.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {m.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
      </div>
    </main>
  );
}
