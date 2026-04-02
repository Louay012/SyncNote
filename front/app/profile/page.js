"use client";

import { ApolloProvider } from "@apollo/client";
import { useMemo } from "react";
import ProfilePage from "@/components/ProfilePage";
import useAuthSession from "@/lib/useAuthSession";
import { createApolloClient } from "@/lib/apollo";

export default function ProfileRoute() {
  const { token, hydrated } = useAuthSession({ redirectTo: "/auth" });
  const client = useMemo(() => createApolloClient(token), [token]);

  if (!hydrated) {
    return (
      <main className="auth-shell">
        <section className="panel notice-panel">
          <p>Loading profile...</p>
        </section>
      </main>
    );
  }

  return (
    <ApolloProvider client={client}>
      <ProfilePage />
    </ApolloProvider>
  );
}
