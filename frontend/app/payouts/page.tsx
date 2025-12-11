"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Payout = {
  id: string;
  amount: number;
  status: string;
  requestedAt: string;
  expectedAt: string | null;
  arrivedAt: string | null;
  failureReason: string | null;
  event: {
    id: string;
    title: string;
  };
  circle: {
    id: string;
    name: string;
  };
};

type PayoutsResponse = {
  payouts: Payout[];
  summary: {
    totalPaidOut: number;
    totalPending: number;
    totalPayouts: number;
  };
};

export default function PayoutsPage() {
  const router = useRouter();
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/payouts", {
        cache: "no-store",
      });

      if (!res.ok) {
        let msg = `Failed to load payouts (${res.status})`;
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

      const body = (await res.json()) as PayoutsResponse;
      setData(body);
    } catch (err) {
      console.error("Error loading payouts:", err);
      setError("Something went wrong loading payouts");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("circlefundr_token");
    localStorage.removeItem("circlefundr_user");
    router.push("/login");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "in_transit":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "pending":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      case "failed":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      default:
        return "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300";
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Title */}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
            Payout History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View all payouts from your payment events
          </p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 flex items-start">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading payouts...
              </p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Total Paid Out
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${data.summary.totalPaidOut.toFixed(2)}
                </p>
              </div>

              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                  Pending
                </p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  ${data.summary.totalPending.toFixed(2)}
                </p>
              </div>

              <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Total Requests
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.summary.totalPayouts}
                </p>
              </div>
            </div>

            {/* Payouts Table */}
            {data.payouts.length === 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-12 text-center">
                <svg
                  className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-2">
                  No payouts yet
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  Payout requests from your payment events will appear here
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Event
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Requested
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Arrival
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((payout, idx) => (
                        <tr
                          key={payout.id}
                          className={
                            idx % 2 === 0
                              ? "bg-white dark:bg-gray-800/50"
                              : "bg-white dark:bg-gray-900/50"
                          }
                        >
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {payout.event.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {payout.circle.name}
                              </p>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              ${payout.amount.toFixed(2)}
                            </p>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                                getStatusColor(payout.status),
                              ].join(" ")}
                            >
                              {payout.status}
                            </span>
                            {payout.failureReason && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {payout.failureReason}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(payout.requestedAt).toLocaleDateString()}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {payout.arrivedAt
                              ? new Date(payout.arrivedAt).toLocaleDateString()
                              : payout.expectedAt
                              ? `Expected: ${new Date(payout.expectedAt).toLocaleDateString()}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
