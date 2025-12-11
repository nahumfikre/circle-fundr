"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type EventSummary = {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  createdAt: string;
};

type EventsResponse = {
  events: EventSummary[];
};

export default function CircleDuesPage() {
  const params = useParams<{ circleId: string }>();
  const router = useRouter();
  const circleId = params.circleId;

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("20");
  const [dueDate, setDueDate] = useState<string>("");

  async function loadEvents(currentCircleId: string) {
    setLoading(true);
    setError(null);

    try {
      const url = `/payment-events/by-circle?circleId=${encodeURIComponent(
        currentCircleId
      )}`;

      const res = await apiFetch(url, {
        cache: "no-store",
      });

      if (!res.ok) {
        let message = `Failed to load dues events (${res.status})`;
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

      const body = (await res.json()) as EventsResponse;
      setEvents(body.events || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong loading dues events");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!circleId) return;
    loadEvents(circleId);
  }, [circleId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!circleId) return;
    if (!title.trim() || !dueDate.trim()) {
      setError("Title and due date are required");
      return;
    }

    const amountNumber = Number(amount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("Amount must be a positive number");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await apiFetch("/payment-events", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          amount: amountNumber,
          dueDate,
          circleId,
        }),
      });

      if (!res.ok) {
        let message = `Failed to create dues event (${res.status})`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body && typeof body.message === "string") {
            message = body.message;
          }
        } catch {
          // ignore
        }
        setError(message);
        setCreating(false);
        return;
      }

      const body = (await res.json()) as { event: EventSummary };

      // Prepend new event to list
      setEvents((prev) => [body.event, ...prev]);

      // reset form
      setTitle("");
      setAmount("20");
      setDueDate("");

      setCreating(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong creating dues event");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-500 mb-1">
              Circle ID:{" "}
              <span className="font-mono text-[10px] text-slate-400">
                {circleId}
              </span>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Circle Dues
            </h1>
            <p className="text-sm text-slate-300">
              Create dues events and track who&apos;s paid within this circle.
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4"
          >
            Back
          </button>
        </header>

        <div className="space-y-6">
            {/* Create dues event form */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-100">
                New dues event
              </h2>
              <form
                onSubmit={handleCreate}
                className="grid gap-3 md:grid-cols-4 md:items-end"
              >
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Title
                  </label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="Fall Dues"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Amount per member
                  </label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Due date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={creating}
                    className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-300"
                  >
                    {creating ? "Creating..." : "Create dues event"}
                  </button>
                </div>
              </form>
              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
            </section>

            {/* Existing dues events */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Dues events
                </h2>
                {loading && (
                  <span className="text-[11px] text-slate-400">
                    Loading…
                  </span>
                )}
              </div>

              {events.length === 0 && !loading && (
                <p className="text-xs text-slate-500">
                  No dues events yet. Create your first one above.
                </p>
              )}

              <div className="space-y-2">
                {events.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/payment-events/${ev.id}`}
                    className="block rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 hover:border-emerald-500/60 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {ev.title}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          ${ev.amount.toFixed(2)} per member · Due{" "}
                          {new Date(ev.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-500 text-right">
                        <p>
                          Created{" "}
                          {new Date(ev.createdAt).toLocaleDateString()}
                        </p>
                        <p className="font-mono text-[9px] mt-1">
                          {ev.id.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
        </div>
      </div>
    </main>
  );
}
