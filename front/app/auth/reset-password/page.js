"use client";

import { ApolloProvider, useMutation } from "@apollo/client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createApolloClient } from "@/lib/apollo";
import { RESET_PASSWORD } from "@/lib/graphql";
import { toFriendlyAuthError } from "@/lib/uiErrors";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!token) {
      setError("Missing reset token. Please request a new reset email.");
      return;
    }

    if (!newPassword.trim()) {
      setError("New password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (!confirmPassword.trim()) {
      setError("Please confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");

    try {
      await resetPassword({
        variables: {
          token,
          newPassword
        }
      });

      setNotice("Password reset successful. You can now sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (mutationError) {
      setError(toFriendlyAuthError(mutationError, "reset"));
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <article className="panel auth-hero-card">
          <p className="auth-badge">SYNCNOTE / RESET</p>
          <h1>Create a new password</h1>
          <p>Use a strong password with at least 8 characters.</p>
        </article>

        <section className="auth-form-card">
          <section className="panel auth-panel">
            <h2>Reset password</h2>
            <form className="auth-form" onSubmit={handleSubmit}>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError("");
                }}
                placeholder="New password"
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError("");
                }}
                placeholder="Confirm password"
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />

              {error ? <p className="field-error">{error}</p> : null}
              {notice ? <p className="field-success">{notice}</p> : null}

              <button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update password"}
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

export default function ResetPasswordPage() {
  const client = useMemo(() => createApolloClient(""), []);

  return (
    <ApolloProvider client={client}>
      <ResetPasswordContent />
    </ApolloProvider>
  );
}
