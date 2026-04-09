"use client";

import { ApolloProvider, useMutation } from "@apollo/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createApolloClient } from "@/lib/apollo";
import { VERIFY_EMAIL } from "@/lib/graphql";
import { toFriendlyAuthError } from "@/lib/uiErrors";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");

  const [verifyEmail] = useMutation(VERIFY_EMAIL);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!token) {
        if (!active) {
          return;
        }
        setStatus("error");
        setMessage("Missing verification token.");
        return;
      }

      try {
        await verifyEmail({ variables: { token } });

        if (!active) {
          return;
        }

        setStatus("success");
        setMessage("Your email is verified. You can now sign in.");
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus("error");
        setMessage(toFriendlyAuthError(error, "verify"));
      }
    }

    verify();

    return () => {
      active = false;
    };
  }, [token, verifyEmail]);

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <article className="panel auth-hero-card">
          <p className="auth-badge">SYNCNOTE / VERIFY</p>
          <h1>Email confirmation</h1>
          <p>We are validating your verification link now.</p>
        </article>

        <section className="auth-form-card">
          <section className="panel auth-panel">
            <h2>{status === "loading" ? "Please wait" : "Verification status"}</h2>
            <p className={status === "error" ? "field-error" : "field-success"}>{message}</p>
            <p className="list-meta">
              <Link href="/auth">Back to login</Link>
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  const client = useMemo(() => createApolloClient(""), []);

  return (
    <ApolloProvider client={client}>
      <VerifyEmailContent />
    </ApolloProvider>
  );
}
