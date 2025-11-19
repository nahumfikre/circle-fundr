"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type EventSummary = {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
};

type PaymentRow = {
  id: string;
  status: string;
  amountPaid: number;
  method: string;
  paidAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

type PaymentsResponse = {
  event: {
    id: string;
    title: string;
    amount: number;
    dueDate: string;
    circleId: string;
    createdAt: string;
  };
  circle: {
    id: string;
    name: string;
    workspaceId: string;
    workspaceName: string;
  };
  payments: PaymentRow[];
  currentUserId: string;
};

export default function PaymentEventPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = params.eventId;

  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load token
  useEffect(() => {
    const stored = window.localStorage.getItem("circlefundr_token");
    if (!stored) {
      router.push("/login");
      return;
    }
    setToken(stored);
  }, [router]);

  // Read query string flags from Stripe redirect
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      setSuccessMessage("Payment completed. It may take a moment to reflect.");
    } else if (canceled === "true") {
      setError("Payment canceled. You can try again any time.");
    }
  }, [searchParams]);

  // Load event + payments
  useEffect(() => {
    if (!token || !eventId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `http://localhost:4000/payments/by-event/${encodeURIComponent(
            eventId
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!res.ok) {
          let msg = `Failed to load event (${res.status})`;
          try {
            const body = await res.json();
            if (body && typeof body.message === "string") {
              msg = body.message;
            }
          } catch {
            // ignore
          }
          setError(msg);
          setData(null);
          return;
        }

        const body = (await res.json()) as PaymentsResponse;
        setData(body);
      } catch (err) {
        console.error("Error fetching payments:", err);
        setError("Something went wrong loading payments");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, eventId]);

  const handleStripePay = async (paymentId: string) => {
    if (!token) return;
    setActionLoading(paymentId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `http://localhost:4000/payments/${encodeURIComponent(
          paymentId
        )}/create-checkout-session`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        let msg = `Failed to start checkout (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            msg = body.message;
          }
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }

      const body = await res.json();
      if (body.url) {
        window.location.href = body.url;
      } else {
        setError("Stripe did not return a checkout URL");
      }
    } catch (err) {
      console.error("Error creating checkout session:", err);
      setError("Something went wrong starting checkout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaidManual = async (paymentId: string) => {
    if (!token) return;
    setActionLoading(paymentId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `http://localhost:4000/payments/${encodeURIComponent(
          paymentId
        )}/mark-paid`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        let msg = `Failed to mark as paid (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            msg = body.message;
          }
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }

      setSuccessMessage("Payment marked as paid.");
      // Refresh
      if (eventId) {
        const res2 = await fetch(
          `http://localhost:4000/payments/by-event/${encodeURIComponent(
            eventId
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );
        if (res2.ok) {
          const body = (await res2.json()) as PaymentsResponse;
          setData(body);
        }
      }
    } catch (err) {
      console.error("Error marking payment as paid:", err);
      setError("Something went wrong updating payment");
    } finally {
      setActionLoading(null);
    }
  };

  const isLoading = loading || !data;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {data ? data.event.title : "Loading event..."}
            </h1>
            {data && (
              <p className="text-sm text-slate-400 mt-1">
                Circle:{" "}
                <span className="font-medium text-slate-200">
                  {data.circle.name}
                </span>{" "}
                · Workspace:{" "}
                <span className="font-medium text-slate-200">
                  {data.circle.workspaceName}
                </span>
              </p>
            )}
          </div>

          {data && (
            <div className="text-right text-sm text-slate-400">
              <p>
                Amount per person:{" "}
                <span className="font-semibold text-slate-50">
                  ${data.event.amount.toFixed(2)}
                </span>
              </p>
              <p>
                Due date:{" "}
                <span className="font-medium">
                  {new Date(data.event.dueDate).toLocaleDateString()}
                </span>
              </p>
            </div>
          )}
        </header>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading payments…</p>
        ) : (
          data && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-slate-950/60">
              <div className="border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Circle Members & Payments
                </h2>
                <p className="text-xs text-slate-500">
                  Total members: {data.payments.length}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-slate-400">
                        Member
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-slate-400">
                        Email
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-slate-400">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-slate-400">
                        Paid Amount
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p, idx) => {
                      const isYou = p.user.id === data.currentUserId;
                      const isPaid = p.status === "PAID";
                      const isFailed = p.status === "FAILED";

                      return (
                        <tr
                          key={p.id}
                          className={
                            idx % 2 === 0
                              ? "bg-slate-950/40"
                              : "bg-slate-950/60"
                          }
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-slate-100">
                              {p.user.name || p.user.email.split("@")[0]}
                            </span>
                            {isYou && (
                              <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-[2px] text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                                You
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                            {p.user.email}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                                isPaid
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                                  : isFailed
                                  ? "bg-red-500/10 text-red-300 border border-red-500/40"
                                  : "bg-amber-500/10 text-amber-200 border border-amber-500/40",
                              ].join(" ")}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-200">
                            {p.amountPaid > 0
                              ? `$${p.amountPaid.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Pay with Stripe (only for yourself, when not already PAID) */}
                              {isYou && !isPaid && (
                                <button
                                  onClick={() => handleStripePay(p.id)}
                                  disabled={actionLoading === p.id}
                                  className="inline-flex items-center rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/20 transition"
                                >
                                  {actionLoading === p.id
                                    ? "Redirecting..."
                                    : "Pay with card"}
                                </button>
                              )}

                              {/* Manual mark-paid (for admins) – we don’t know admin on FE,
                                  but backend enforces it, so we show button and rely on 403 */}
                              {!isPaid && (
                                <button
                                  onClick={() =>
                                    handleMarkPaidManual(p.id)
                                  }
                                  disabled={actionLoading === p.id}
                                  className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 transition"
                                >
                                  {actionLoading === p.id
                                    ? "Updating..."
                                    : "Mark paid (manual)"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        )}
      </div>
    </main>
  );
}
