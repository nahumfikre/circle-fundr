import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-xl w-full space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            circles • dues • payments
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            CircleFundr
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-md">
            A simple way to track dues and buy-ins across your clubs, fantasy
            leagues, and group trips. No more chasing screenshots in the chat.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition"
          >
            Sign in
          </Link>
          <button className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium border border-slate-700 text-slate-200 hover:bg-slate-900 transition">
            View demo
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Backend is already live on <span className="font-medium">localhost:4000</span>.
          This UI will hook into workspaces, circles, and payment events.
        </p>
      </div>
    </main>
  );
}
