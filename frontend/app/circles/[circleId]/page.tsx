"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

  const [token, setToken] = useState<string | null>(null);

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
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("circlefundr_token")
        : null;
    setToken(stored);
  }, []);

  useEffect(() => {
    if (!token || !circleId) {
      setLoadingCircle(false);
      return;
    }

    async function loadCircle() {
      try {
        setLoadingCircle(true);
        setError(null);

        const res = await fetch(
          `http://localhost:4000/circles/${encodeURIComponent(circleId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
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
  }, [token, circleId]);

  async function loadEvents(currentToken: string, currentCircleId: string) {
    try {
      setLoadingEvents(true);
      setError(null);

      const url = `http://localhost:4000/payment-events/by-circle?circleId=${encodeURIComponent(
        currentCircleId
      )}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
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
    if (!token || !circleId) return;
    loadEvents(token, circleId);
  }, [token, circleId]);

  async function loadMembers(currentToken: string, currentCircleId: string) {
    try {
      setLoadingMembers(true);
      setError(null);

      const url = `http://localhost:4000/memberships/by-circle?circleId=${encodeURIComponent(
        currentCircleId
      )}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
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
    if (!token || !circleId) return;
    loadMembers(token, circleId);
  }, [token, circleId]);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !circleId) return;

    const title = newTitle.trim();
    const amountNumber = Number(newAmount);
    const dueDate = newDueDate;

    if (!title || !amountNumber || !dueDate) return;

    try {
      setCreatingEvent(true);
      setError(null);

      const res = await fetch("http://localhost:4000/payment-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    if (!token || !circleId) return;

    const email = inviteEmail.trim();
    const name = inviteName.trim();

    if (!email) return;

    try {
      setInviting(true);
      setError(null);

      const res = await fetch("http://localhost:4000/memberships/circles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  const authed = Boolean(token);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/workspaces")}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-4 mb-1"
            >
              All workspaces
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">
              {circle?.name || "Circle"}
            </h1>
            <p className="text-sm text-slate-300">
              Manage dues events and members in this circle.
            </p>
          </div>
          {circle && (
            <div className="text-right text-[11px] text-slate-500">
              <p>
                Created: {new Date(circle.createdAt).toLocaleDateString()}
              </p>
              {circle.description && (
                <p className="max-w-xs text-slate-400 mt-1">
                  {circle.description}
                </p>
              )}
            </div>
          )}
        </header>

        {!authed && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs text-amber-100">
            No token found in <span className="font-mono">localStorage</span>.{" "}
            Sign in again to access this circle.
          </div>
        )}

        {authed && error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {authed && (
          <section className="space-y-4">
            {/* Create event form */}
            <form
              onSubmit={handleCreateEvent}
              className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    Create a dues event for this circle
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Example: &quot;Fall Dues&quot;, &quot;Tournament
                    Buy-In&quot;, &quot;Trip Deposit&quot;.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Event title"
                  className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm flex-1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Amount"
                  className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm w-32"
                />
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm w-40"
                />
                <button
                  type="submit"
                  disabled={
                    creatingEvent ||
                    !newTitle.trim() ||
                    !newAmount.trim() ||
                    !newDueDate.trim()
                  }
                  className="px-3 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {creatingEvent ? "Creating..." : "Create event"}
                </button>
              </div>
            </form>

            {/* Events list */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70">
              <div className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-slate-300">
                  Dues events
                </p>
              </div>

              {loadingEvents ? (
                <div className="px-4 py-4 text-xs text-slate-400">
                  Loading events…
                </div>
              ) : events.length === 0 ? (
                <div className="px-4 py-4 text-xs text-slate-400">
                  No dues events yet. Create one above to start tracking
                  payments.
                </div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-950/70 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/payment-events/${encodeURIComponent(ev.id)}`
                        )
                      }
                    >
                      <div>
                        <p className="text-sm font-medium">{ev.title}</p>
                        <p className="text-[11px] text-slate-400">
                          ${ev.amount.toFixed(2)} · Due{" "}
                          {new Date(ev.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Created{" "}
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Members list + invite */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70">
              <div className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-slate-300">
                  Members
                </p>
              </div>

              <div className="p-4 space-y-4">
                <form
                  onSubmit={handleInviteMember}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Add a member to this circle
                    </p>
                    <p className="text-[11px] text-slate-400">
                      They&apos;ll be able to see events and be tracked for
                      payments.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm min-w-[200px]"
                    />
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Name (optional)"
                      className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm min-w-[160px]"
                    />
                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className="px-3 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {inviting ? "Adding..." : "Add member"}
                    </button>
                  </div>
                </form>

                {loadingMembers ? (
                  <p className="text-xs text-slate-400">
                    Loading members…
                  </p>
                ) : members.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No members yet. Add someone above to start tracking
                    their dues.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="px-2 py-2 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm">{m.name || m.email}</p>
                          <p className="text-[11px] text-slate-500">
                            {m.email}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
