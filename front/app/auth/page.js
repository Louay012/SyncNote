"use client";

import { ApolloProvider, useMutation } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthPanel from "@/components/AuthPanel";
import { createApolloClient } from "@/lib/apollo";
import { LOGIN, REGISTER } from "@/lib/graphql";

function AuthScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("syncnote-token") || "";
    if (saved) {
      router.replace("/");
      return;
    }

    setHydrated(true);
  }, [router]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const [login, { loading: loggingIn }] = useMutation(LOGIN);
  const [register, { loading: registering }] = useMutation(REGISTER);

  async function handleLogin(credentials) {
    try {
      const result = await login({ variables: credentials });
      const nextToken = result.data?.login?.token;
      if (nextToken) {
        window.localStorage.setItem("syncnote-token", nextToken);
        router.replace("/");
      }
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleRegister(credentials) {
    try {
      const result = await register({ variables: credentials });
      const nextToken = result.data?.register?.token;
      if (nextToken) {
        window.localStorage.setItem("syncnote-token", nextToken);
        router.replace("/");
      }
    } catch (error) {
      setNotice(error.message);
    }
  }

  if (!hydrated) {
    return (
      <main className="auth-shell">
        <section className="panel notice-panel">
          <p>Preparing auth page...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <article className="panel auth-hero-card">
          <p className="auth-badge">SYNCNOTE / AUTH</p>
          <h1>Your documents, your team, one real-time workspace.</h1>
          <p>
            Sign in to jump into your collaborative notes, comments, and live updates.
            This project now starts with a dedicated authentication page.
          </p>
          <ul className="auth-points">
            <li>Live GraphQL subscriptions for document and comment updates</li>
            <li>Search, sort, and paginate document collections</li>
            <li>Share and revoke collaborator access with permission levels</li>
          </ul>
        </article>

        <section className="auth-form-card">
          <AuthPanel
            onLogin={handleLogin}
            onRegister={handleRegister}
            loading={loggingIn || registering}
          />

          {notice ? (
            <section className="panel notice-panel">
              <p>{notice}</p>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export default function AuthPage() {
  const client = useMemo(() => createApolloClient(""), []);

  return (
    <ApolloProvider client={client}>
      <AuthScreen />
    </ApolloProvider>
  );
}
