export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Not Found</h1>
      <p className="text-sm text-slate-300">
        The requested page could not be found.
      </p>
    </main>
  );
}
