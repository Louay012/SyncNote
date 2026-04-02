"use client";

import { useApolloClient, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { clearStoredToken } from "@/lib/authToken";
import { GET_ME } from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

export default function ProfilePage() {
  const router = useRouter();
  const apolloClient = useApolloClient();
  const { data, loading, error, refetch } = useQuery(GET_ME, {
    fetchPolicy: "cache-and-network"
  });

  function handleLogout() {
    clearStoredToken();
    apolloClient.clearStore();
    router.replace("/auth");
  }

  return (
    <AppShell title="Profile" subtitle="Your account information and session status." onLogout={handleLogout}>
      {error ? (
        <section className="panel notice-panel error-notice">
          <p>{toFriendlyError(error)}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </section>
      ) : null}

      <section className="panel profile-panel">
        <h2>Account</h2>
        {loading ? <p>Loading profile...</p> : null}
        {!loading && !error ? (
          <div className="profile-grid">
            <p>
              <strong>Name:</strong> {data?.me?.name || "Unknown"}
            </p>
            <p>
              <strong>Email:</strong> {data?.me?.email || "Unknown"}
            </p>
            <p>
              <strong>User ID:</strong> {data?.me?.id || "-"}
            </p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
