"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
  poolInfo: {
    balance: number;
    totalPaidIn: number;
    totalPaidOut: number;
    organizerId: string;
    organizerName: string;
    organizerOnboarded: boolean;
  };
  currentUserId: string;
  isAdmin: boolean;
  isOrganizer: boolean;
};

export default function PaymentEventPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = params.eventId;

  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // holds what each member typed as the amount they want to pay right now
  // key = paymentId, value = raw string from the input
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});

  // Force reload trigger
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Read query string flags from Stripe redirect
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      setSuccessMessage("Payment successful!");
      // Trigger an immediate reload
      setReloadTrigger((prev) => prev + 1);

      // Poll for updates a few times to catch webhook processing
      const intervals = [1000, 2000, 3000]; // Check after 1s, 2s, 3s
      intervals.forEach((delay) => {
        setTimeout(() => {
          setReloadTrigger((prev) => prev + 1);
        }, delay);
      });
    } else if (canceled === "true") {
      setError("Payment canceled. You can try again any time.");
    }
  }, [searchParams]);

  // Load event + payments from backend
  useEffect(() => {
    if (!eventId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch(
          `/payments/by-event/${encodeURIComponent(
            eventId
          )}`,
          {
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
            // ignore JSON errors
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
  }, [eventId, reloadTrigger]);

  // Starts a Stripe checkout session for this payment.
  // If the user typed an amount, we send it to the backend so they can pay a partial share.
  const handleStripePay = async (paymentId: string) => {
    if (false) return;

    setActionLoading(paymentId);
    setError(null);
    setSuccessMessage(null);

    // grab whatever the user typed for this payment row
    const raw = payAmounts[paymentId];
    const amount = raw ? Number(raw) : undefined;

    // simple guard so nobody accidentally sends a weird or zero value
    if (amount !== undefined && (Number.isNaN(amount) || amount <= 0)) {
      setActionLoading(null);
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      const res = await apiFetch(
        `/payments/${encodeURIComponent(
          paymentId
        )}/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // backend will fall back to full per person amount if amount is undefined
          body: JSON.stringify({ amount }),
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
          // ignore JSON errors
        }
        setError(msg);
        return;
      }

      const body = await res.json();
      if (body.url) {
        // redirect to Stripe hosted checkout
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

  // Mark a payment as manually paid (for admins).
  const handleMarkPaidManual = async (paymentId: string) => {
    if (false) return;

    // Prompt for amount
    const amountStr = window.prompt("Enter the amount paid:");
    if (!amountStr) return; // User cancelled

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than zero");
      return;
    }

    setActionLoading(paymentId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch(
        `/payments/${encodeURIComponent(
          paymentId
        )}/mark-paid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount }),
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
          // ignore JSON errors
        }
        setError(msg);
        return;
      }

      setSuccessMessage("Payment marked as paid.");

      // reload the event so UI stays in sync
      if (eventId) {
        const res2 = await apiFetch(
          `/payments/by-event/${encodeURIComponent(
            eventId
          )}`,
          {
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

  // Undo a manual payment (for admins).
  const handleUndoManual = async (paymentId: string) => {
    if (false) return;

    const ok = window.confirm("Undo this manual payment?");
    if (!ok) return;

    setActionLoading(paymentId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch(
        `/payments/${encodeURIComponent(
          paymentId
        )}/undo-manual`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        let msg = `Failed to undo payment (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            msg = body.message;
          }
        } catch {
          // ignore JSON errors
        }
        setError(msg);
        return;
      }

      setSuccessMessage("Manual payment undone.");

      // reload the event so UI stays in sync
      if (eventId) {
        const res2 = await apiFetch(
          `/payments/by-event/${encodeURIComponent(
            eventId
          )}`,
          {
            cache: "no-store",
          }
        );
        if (res2.ok) {
          const body = (await res2.json()) as PaymentsResponse;
          setData(body);
        }
      }
    } catch (err) {
      console.error("Error undoing manual payment:", err);
      setError("Something went wrong undoing payment");
    } finally {
      setActionLoading(null);
    }
  };

  // Request payout (for organizers)
  const handleRequestPayout = async () => {
    if (!data) return;

    const amountStr = window.prompt(
      `Enter payout amount (leave blank for full balance: $${data.poolInfo.balance.toFixed(2)}):`
    );

    // User cancelled
    if (amountStr === null) return;

    // Parse amount (empty string means full balance)
    const amount = amountStr.trim() === "" ? undefined : parseFloat(amountStr);

    if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
      setError("Please enter a valid amount greater than zero");
      return;
    }

    if (amount !== undefined && amount > data.poolInfo.balance) {
      setError(`Amount exceeds available balance ($${data.poolInfo.balance.toFixed(2)})`);
      return;
    }

    setActionLoading("payout");
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch(
        `/payouts/${encodeURIComponent(eventId)}/request-payout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount }),
        }
      );

      if (!res.ok) {
        let msg = `Failed to request payout (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            msg = body.message;
          }
        } catch {
          // ignore JSON errors
        }
        setError(msg);
        return;
      }

      const body = await res.json();
      setSuccessMessage(
        body.message || "Payout requested! Funds will arrive in 2-7 business days."
      );

      // Reload data to show updated balance
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error requesting payout:", err);
      setError("Something went wrong requesting payout");
    } finally {
      setActionLoading(null);
    }
  };

  const isLoading = loading || !data;

  const handleLogout = () => {
    localStorage.removeItem("circlefundr_token");
    localStorage.removeItem("circlefundr_user");
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-end gap-2 mb-4">
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
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {data ? data.event.title : "Loading event..."}
            </h1>
            {data && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {data.circle.name}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {data.circle.workspaceName}
                </span>
              </div>
            )}
          </div>

          {data && (
            <div className="flex flex-col sm:items-end gap-1">
              <div className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Goal</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${data.event.amount.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Due: {new Date(data.event.dueDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </header>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 flex items-start">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
        {successMessage && (
          <div className="mb-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-4 py-3 flex items-start">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}

        {/* Payment Progress */}
        {!isLoading && data && (() => {
          const totalGoal = data.event.amount; // Total amount to collect
          const totalPaid = data.payments.reduce((sum, p) => sum + p.amountPaid, 0);
          const remaining = totalGoal - totalPaid;
          const progressPercent = totalGoal > 0 ? (totalPaid / totalGoal) * 100 : 0;

          return (
            <section className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                  Payment Progress
                </h2>
              </div>

              <div className="px-6 py-6">
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {progressPercent.toFixed(1)}% Complete
                    </span>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      ${totalPaid.toFixed(2)} / ${totalGoal.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 px-5 py-4">
                    <p className="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Total Goal
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${totalGoal.toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-5 py-4">
                    <p className="text-xs uppercase tracking-wide font-medium text-green-700 dark:text-green-400 mb-2">
                      Total Paid
                    </p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      ${totalPaid.toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-5 py-4">
                    <p className="text-xs uppercase tracking-wide font-medium text-amber-700 dark:text-amber-400 mb-2">
                      Remaining
                    </p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      ${remaining.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* Pool Balance (Organizer Only) */}
        {!isLoading && data && data.isOrganizer && (
          <section className="mb-6 rounded-xl border border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 shadow-sm overflow-hidden">
            <div className="border-b border-purple-200 dark:border-purple-700 px-6 py-4 bg-white/50 dark:bg-gray-900/50">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                  Event Pool Balance
                </h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300">
                  Organizer
                </span>
              </div>
            </div>

            <div className="px-6 py-6">
              {/* Balance Display */}
              <div className="text-center mb-6">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Available to Withdraw
                </p>
                <p className="text-5xl font-bold text-purple-900 dark:text-purple-300">
                  ${data.poolInfo.balance.toFixed(2)}
                </p>
              </div>

              {/* Pool Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 px-5 py-4">
                  <p className="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Total Collected
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${data.poolInfo.totalPaidIn.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-lg bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 px-5 py-4">
                  <p className="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Total Withdrawn
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${data.poolInfo.totalPaidOut.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Payout Actions */}
              {data.poolInfo.organizerOnboarded ? (
                <button
                  onClick={handleRequestPayout}
                  disabled={data.poolInfo.balance === 0 || actionLoading === "payout"}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-700 px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === "payout" ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : data.poolInfo.balance === 0 ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      No Balance to Withdraw
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Request Payout
                    </>
                  )}
                </button>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Connect your bank account to withdraw funds
                  </p>
                  <button
                    onClick={() => router.push("/connect/onboard")}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-medium text-white transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Connect Bank Account
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading payments…</p>
            </div>
          </div>
        ) : (
          data && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                    {data.isAdmin ? "Member Payments" : "Your Payment"}
                  </h2>
                  {data.isAdmin && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {data.payments.length} {data.payments.length === 1 ? "member" : "members"}
                    </p>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      {data.isAdmin && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Member
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Email
                          </th>
                        </>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Paid
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments
                      .filter((p) => data.isAdmin || p.user.id === data.currentUserId)
                      .map((p, idx) => {
                      const isYou = p.user.id === data.currentUserId;
                      const isPaid = p.status === "PAID";
                      const isFailed = p.status === "FAILED";
                      const isManualPayment = p.method === "MANUAL";

                      return (
                        <tr
                          key={p.id}
                          className={
                            idx % 2 === 0
                              ? "bg-white dark:bg-gray-800/50"
                              : "bg-white dark:bg-gray-900/50"
                          }
                        >
                          {data.isAdmin && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-xs mr-3">
                                    {(p.user.name || p.user.email).charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {p.user.name || p.user.email.split("@")[0]}
                                    </span>
                                    {isYou && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                        You
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {p.user.email}
                              </td>
                            </>
                          )}

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                                isPaid
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                  : isFailed
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
                              ].join(" ")}
                            >
                              {p.status}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            ${p.amountPaid.toFixed(2)}
                          </td>

                          {/* how much this member wants to contribute */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isYou && !isPaid ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Enter amount"
                                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 w-28 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={payAmounts[p.id] ?? ""}
                                onChange={(e) =>
                                  setPayAmounts((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                              />
                            ) : isPaid ? (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                —
                              </span>
                            ) : null}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Pay with Stripe (only for yourself, when not already PAID) */}
                              {isYou && !isPaid && (
                                <button
                                  onClick={() => handleStripePay(p.id)}
                                  disabled={actionLoading === p.id}
                                  className="inline-flex items-center rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50"
                                >
                                  {actionLoading === p.id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                      Redirecting...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                      </svg>
                                      Contribute
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Manual mark-paid / undo (for admins only) */}
                              {data.isAdmin && (
                                <>
                                  {!isPaid && (
                                    <button
                                      onClick={() => handleMarkPaidManual(p.id)}
                                      disabled={actionLoading === p.id}
                                      className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                      {actionLoading === p.id
                                        ? "Updating..."
                                        : "Mark paid"}
                                    </button>
                                  )}
                                  {isPaid && isManualPayment && (
                                    <button
                                      onClick={() => handleUndoManual(p.id)}
                                      disabled={actionLoading === p.id}
                                      className="inline-flex items-center rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
                                    >
                                      {actionLoading === p.id
                                        ? "Undoing..."
                                        : "Undo"}
                                    </button>
                                  )}
                                </>
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
