import type { NextPageContext } from "next";

type ErrorPageProps = {
  statusCode: number;
};

function getStatusCode(context: NextPageContext): number {
  if (typeof context.res?.statusCode === "number" && context.res.statusCode > 0) {
    return context.res.statusCode;
  }
  if (typeof context.err?.statusCode === "number" && context.err.statusCode > 0) {
    return context.err.statusCode;
  }
  return 500;
}

export default function ErrorPage({ statusCode }: ErrorPageProps) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Application Error</h1>
      <p className="text-sm text-slate-300">
        A server error occurred while rendering this page.
      </p>
      <p className="text-xs text-slate-400">Status: {statusCode}</p>
    </main>
  );
}

ErrorPage.getInitialProps = (context: NextPageContext): ErrorPageProps => ({
  statusCode: getStatusCode(context),
});
