"use client";

import {
  ApolloProvider,
  useApolloClient,
  useMutation,
  useQuery
} from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createApolloClient } from "@/lib/apollo";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/authToken";
import {
  GET_ME,
  GET_MY_INVITATIONS,
  RESPOND_TO_INVITATION
} from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

function InvitationsContent({ token, onLogout }) {
  const router = useRouter();
  const apolloClient = useApolloClient();
  const [pendingId, setPendingId] = useState("");

  const { data: meData } = useQuery(GET_ME, {
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const { data, loading, error, refetch } = useQuery(GET_MY_INVITATIONS, {
    variables: {
      status: "PENDING"
    },
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const [respondToInvitation] = useMutation(RESPOND_TO_INVITATION);

  async function handleRespond(invitationId, approve) {
    setPendingId(String(invitationId));

    try {
      const result = await respondToInvitation({
        variables: {
          invitationId,
          approve
        }
      });

      if (approve) {
        const documentId = result?.data?.respondToInvitation?.document?.id;
        if (documentId) {
          router.push(`/doc/${documentId}`);
          return;
        }
      }

      await refetch();
    } finally {
      setPendingId("");
    }
  }

  function handleLogout() {
    clearStoredToken();
    apolloClient.clearStore();
    onLogout();
    router.replace("/auth");
  }

  const invitations = data?.myInvitations || [];

  return (
    <AppShell
      title="Invitations"
      subtitle={`Signed in as ${meData?.me?.name || "User"}`}
      onLogout={handleLogout}
    >
      {error ? (
        <section className="panel notice-panel error-notice">
          <p>{toFriendlyError(error)}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </section>
      ) : null}

      <section className="invitations-grid">
        {invitations.map((invitation) => {
          const isBusy = pendingId === String(invitation.id);

          return (
            <article className="panel invitation-card" key={invitation.id}>
              <h3>{invitation.document?.title || "Document"}</h3>
              <p className="list-meta">From: {invitation.inviter?.name || "Unknown"}</p>
              <p className="list-meta">Permission: {invitation.permission}</p>
              <p className="list-meta">Sent: {new Date(invitation.createdAt).toLocaleString()}</p>

              <div className="invitation-actions">
                <button
                  type="button"
                  onClick={() => handleRespond(invitation.id, true)}
                  disabled={isBusy}
                >
                  {isBusy ? "Saving..." : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRespond(invitation.id, false)}
                  disabled={isBusy}
                >
                  {isBusy ? "Saving..." : "Decline"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {!loading && invitations.length === 0 ? (
        <section className="panel notice-panel">
          <p>No pending invitations.</p>
        </section>
      ) : null}

      {loading ? <p className="list-meta">Loading invitations...</p> : null}
    </AppShell>
  );
}

export default function InvitationsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const client = useMemo(() => createApolloClient(token), [token]);

  useEffect(() => {
    const saved = getStoredToken();
    setToken(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!token) {
      router.replace("/auth");
      return;
    }

    setStoredToken(token);
  }, [hydrated, token, router]);

  if (!hydrated) {
    return (
      <main className="auth-shell">
        <section className="panel notice-panel">
          <p>Preparing invitations...</p>
        </section>
      </main>
    );
  }

  return (
    <ApolloProvider client={client}>
      <InvitationsContent token={token} onLogout={() => setToken("")} />
    </ApolloProvider>
  );
}
