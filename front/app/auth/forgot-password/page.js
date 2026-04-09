"use client";

import { ApolloProvider, useMutation } from "@apollo/client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createApolloClient } from "@/lib/apollo";
import { REQUEST_PASSWORD_RESET } from "@/lib/graphql";
import { isEmail, toFriendlyAuthError } from "@/lib/uiErrors";

function ForgotPasswordContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const [requestPasswordReset, { loading }] = useMutation(REQUEST_PASSWORD_RESET);

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedEmail = String(email || "").trim();

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    if (!isEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");

    try {
      await requestPasswordReset({ variables: { email: normalizedEmail } });
      router.replace(`/auth/check-email?mode=reset&email=${encodeURIComponent(normalizedEmail)}`);
    } catch (mutationError) {
      setError(toFriendlyAuthError(mutationError, "reset"));
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <article className="panel auth-hero-card">
          <p className="auth-badge">SYNCNOTE / RESET</p>
          <h1>Forgot your password?</h1>
          <p>Enter your account email and we will send you a secure reset link.</p>
        </article>

        <section className="auth-form-card">
          <section className="panel auth-panel">
            <h2>Request reset link</h2>
            <form className="auth-form" onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="Email"
                disabled={loading}
              />
              {error ? <p className="field-error">{error}</p> : null}

              <button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send reset email"}
              </button>
            </form>

            <p className="list-meta">
              <Link href="/auth">Back to login</Link>
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}

export default function ForgotPasswordPage() {
  const client = useMemo(() => createApolloClient(""), []);

  return (
    <ApolloProvider client={client}>
      <ForgotPasswordContent />
    </ApolloProvider>
  );
}
