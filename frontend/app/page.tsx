import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-xl w-full space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-500">
            circles • dues • payments
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            CircleFundr
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-md">
            A simple way to track dues and buy-ins across your clubs, fantasy
            leagues, and group trips. No more chasing screenshots in the chat.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          >
            Sign up
          </Link>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-500">
          Track payments, manage circles, and keep everyone accountable.
        </p>
      </div>
    </main>
  );
}
