"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type ConnectStatus = {
  connected: boolean;
  accountId: string | null;
  status: string | null;
  payoutsEnabled: boolean;
  chargesEnabled?: boolean;
  onboardedAt: string | null;
};

export default function ConnectOnboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load Connect status
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/connect/status", {
        cache: "no-store",
      });

      if (!res.ok) {
        setError(`Failed to load status (${res.status})`);
        return;
      }

      const data = (await res.json()) as ConnectStatus;
      setStatus(data);
    } catch (err) {
      console.error("Error loading Connect status:", err);
      setError("Something went wrong loading status");
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/connect/onboard", {
        method: "POST",
      });

      if (!res.ok) {
        let msg = `Failed to start onboarding (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            msg = body.message;
          }
        } catch {
          // ignore
        }
        setError(msg);
        setActionLoading(false);
        return;
      }

      const data = await res.json();
      if (data.onboardingUrl) {
        // Redirect to Stripe-hosted onboarding
        window.location.href = data.onboardingUrl;
      } else {
        setError("Onboarding URL not returned");
        setActionLoading(false);
      }
    } catch (err) {
      console.error("Error starting onboarding:", err);
      setError("Something went wrong starting onboarding");
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/connect/refresh", {
        method: "POST",
      });

      if (!res.ok) {
        let msg = `Failed to refresh onboarding (${res.status})`;
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") {
            msg = body.message;
          }
        } catch {
          // ignore
        }
        setError(msg);
        setActionLoading(false);
        return;
      }

      const data = await res.json();
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        setError("Onboarding URL not returned");
        setActionLoading(false);
      }
    } catch (err) {
      console.error("Error refreshing onboarding:", err);
      setError("Something went wrong refreshing onboarding");
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("circlefundr_token");
    localStorage.removeItem("circlefundr_user");
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
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
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
            Connect Bank Account
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Receive payouts for your payment events
          </p>
        </div>

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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading status...
              </p>
            </div>
          </div>
        ) : status?.connected && status.status === "complete" ? (
          // Already connected
          <div className="rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="border-b border-green-200 dark:border-green-700 px-6 py-4 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-lg font-semibold text-green-900 dark:text-green-300">
                  Bank Account Connected
                </h2>
              </div>
            </div>

            <div className="px-6 py-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Account Status
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Payouts Enabled
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {status.payoutsEnabled ? "Yes" : "No"}
                  </span>
                </div>

                {status.onboardedAt && (
                  <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Connected On
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date(status.onboardedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  You're all set! You can now receive payouts from your payment events.
                </p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-medium text-white transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Not connected or incomplete onboarding
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="px-6 py-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                  <svg
                    className="w-8 h-8 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {status?.connected ? "Complete Your Onboarding" : "Connect Your Bank Account"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  {status?.connected
                    ? "You started the onboarding process. Click below to continue where you left off."
                    : "Securely connect your bank account via Stripe to receive payouts from your payment events."}
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3 mt-0.5">
                    <svg
                      className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Secure & Trusted
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Powered by Stripe, trusted by millions
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3 mt-0.5">
                    <svg
                      className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Fast Payouts
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Receive funds in 2-7 business days
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3 mt-0.5">
                    <svg
                      className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      One-Time Setup
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Connect once, receive payouts anytime
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={status?.connected ? handleRefresh : handleStartOnboarding}
                disabled={actionLoading}
                className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
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
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    {status?.connected ? "Continue Onboarding" : "Connect Bank Account"}
                  </>
                )}
              </button>

              <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
                You'll be redirected to Stripe's secure onboarding flow
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
