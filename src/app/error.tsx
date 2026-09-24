"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="py-12 text-center">
      <h1 className="page-title">The page could not be loaded</h1>
      <p className="text-muted mt-3">Try again in a moment.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}
