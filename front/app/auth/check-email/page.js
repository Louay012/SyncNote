"use client";

import { ApolloProvider, useMutation } from "@apollo/client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createApolloClient } from "@/lib/apollo";
import { RESEND_VERIFICATION_EMAIL } from "@/lib/graphql";
import { toFriendlyAuthError } from "@/lib/uiErrors";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = String(searchParams.get("email") || "").trim();
  const mode = String(searchParams.get("mode") || "verify");
  const isResetMode = mode === "reset";

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [resendVerificationEmail, { loading }] = useMutation(
    RESEND_VERIFICATION_EMAIL
  );

  async function handleResend() {
    if (!email) {
      setError("Missing email address. Go back to signup and try again.");
      return;
    }

    setError("");
    setNotice("");

    try {
      await resendVerificationEmail({ variables: { email } });
      setNotice("Verification email sent. Please check your inbox.");
    } catch (mutationError) {
      setError(toFriendlyAuthError(mutationError, "register"));
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <article className="panel auth-hero-card">
          <p className="auth-badge">SYNCNOTE / EMAIL</p>
          <h1>{isResetMode ? "Check your inbox" : "Verify your account"}</h1>
          <p>
            {isResetMode
              ? "If an account exists for this email, we sent a password reset link."
              : "We sent a verification email. Open it to activate your account before login."}
          </p>
          <ul className="auth-points">
            <li>Check spam and promotions folders</li>
            <li>Links can expire for security reasons</li>
            <li>Return to login once complete</li>
          </ul>
        </article>

        <section className="auth-form-card">
          <section className="panel auth-panel">
            <h2>{isResetMode ? "Password reset email sent" : "Verification pending"}</h2>
            <p className="list-meta">
              {email ? `Email: ${email}` : "Email not available"}
            </p>

            {!isResetMode ? (
              <button type="button" onClick={handleResend} disabled={loading || !email}>
                {loading ? "Sending..." : "Resend verification email"}
              </button>
            ) : null}

            {notice ? <p className="field-success">{notice}</p> : null}
            {error ? <p className="field-error">{error}</p> : null}

            <p className="list-meta">
              <Link href="/auth">Back to login</Link>
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}

export default function CheckEmailPage() {
  const client = useMemo(() => createApolloClient(""), []);

  return (
    <ApolloProvider client={client}>
      <CheckEmailContent />
    </ApolloProvider>
  );
}
