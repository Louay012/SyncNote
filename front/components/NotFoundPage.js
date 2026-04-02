import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="auth-shell">
      <section className="panel notice-panel">
        <h2>Page not found</h2>
        <p>The page you are looking for does not exist or may have been moved.</p>
        <p>
          <Link href="/">Go to dashboard</Link>
        </p>
      </section>
    </main>
  );
}
