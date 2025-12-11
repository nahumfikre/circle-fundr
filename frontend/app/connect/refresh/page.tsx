"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConnectRefreshPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect back to onboarding page
    router.push("/connect/onboard");
  }, [router]);

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Redirecting back to onboarding...
        </p>
      </div>
    </main>
  );
}
