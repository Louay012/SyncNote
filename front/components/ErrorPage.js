"use client";

export default function ErrorPage({ error, reset }) {
  return (
    <main className="auth-shell">
      <section className="panel notice-panel">
        <h2>Something went wrong</h2>
        <p>{error?.message || "An unexpected error occurred."}</p>
        <button type="button" onClick={reset}>
          Reload
        </button>
      </section>
    </main>
  );
}
