"use client";

import {
  ApolloProvider,
  useApolloClient,
  useQuery
} from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createApolloClient } from "@/lib/apollo";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/authToken";
import {
  GET_ME,
  GET_MY_DOCUMENTS,
  GET_SHARED_DOCUMENTS
} from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

const RECENT_LIMIT = 6;

function DashboardContent({ token, onLogout }) {
  const router = useRouter();
  const apolloClient = useApolloClient();
  const listingVariables = useMemo(
    () => ({
      limit: RECENT_LIMIT,
      offset: 0,
      sortBy: "UPDATED_AT",
      sortDirection: "DESC"
    }),
    []
  );

  const { data: meData } = useQuery(GET_ME, {
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: myDocsData,
    loading: loadingMine,
    error: myDocsError,
    refetch: refetchMine
  } = useQuery(GET_MY_DOCUMENTS, {
    variables: listingVariables,
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: sharedDocsData,
    loading: loadingShared,
    error: sharedDocsError,
    refetch: refetchShared
  } = useQuery(GET_SHARED_DOCUMENTS, {
    variables: listingVariables,
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const myDocs = myDocsData?.myDocuments?.items || [];
  const sharedDocs = sharedDocsData?.sharedWithMeDocuments?.items || [];
  const totalMine = myDocsData?.myDocuments?.total || 0;
  const totalShared = sharedDocsData?.sharedWithMeDocuments?.total || 0;
  const totalDocuments = totalMine + totalShared;

  const recentItems = [...myDocs, ...sharedDocs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const listingError = myDocsError || sharedDocsError;

  async function refreshCollections() {
    await Promise.all([refetchMine(), refetchShared()]);
  }

  function handleSelectDocument(documentId) {
    router.push(`/doc/${documentId}`);
  }

  function handleLogout() {
    clearStoredToken();
    apolloClient.clearStore();
    onLogout();
    router.replace("/auth");
  }

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Signed in as ${meData?.me?.name || "User"}`}
      onLogout={handleLogout}
    >
      <section className="panel dashboard-overview">
        <div>
          <p className="list-meta">Workspace snapshot</p>
          <h2>Focus on what needs attention</h2>
          <p>
            Keep moving with quick actions, recent updates, and document health at a glance.
          </p>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={() => router.push("/documents")}>View All Documents</button>
          <button
            type="button"
            onClick={() => {
              if (!recentItems.length) {
                return;
              }
              handleSelectDocument(recentItems[0].id);
            }}
            disabled={!recentItems.length}
          >
            Resume Last Edited
          </button>
        </div>
      </section>

      <section className="dashboard-stats-grid">
        <article className="panel dashboard-stat-card">
          <h3>Total Documents</h3>
          <strong>{totalDocuments}</strong>
          <p className="list-meta">Owned + shared documents in your workspace.</p>
        </article>

        <article className="panel dashboard-stat-card">
          <h3>My Documents</h3>
          <strong>{totalMine}</strong>
          <p className="list-meta">Documents you created and manage.</p>
        </article>

        <article className="panel dashboard-stat-card">
          <h3>Shared With Me</h3>
          <strong>{totalShared}</strong>
          <p className="list-meta">Collaborative documents from your team.</p>
        </article>
      </section>

      {listingError ? (
        <section className="panel notice-panel error-notice">
          <p>{toFriendlyError(listingError)}</p>
          <button type="button" onClick={refreshCollections}>
            Retry
          </button>
        </section>
      ) : null}

      <section className="panel dashboard-recent-panel">
        <div className="dashboard-panel-header">
          <h3>Recent Activity</h3>
          <button type="button" onClick={() => router.push("/documents")}>Open Documents</button>
        </div>

        {recentItems.length === 0 && !loadingMine && !loadingShared ? (
          <p className="list-meta">No documents yet. Create your first one from the sidebar.</p>
        ) : null}

        <div className="dashboard-recent-list">
          {recentItems.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="dashboard-recent-item"
              onClick={() => handleSelectDocument(doc.id)}
            >
              <strong>{doc.title}</strong>
              <span>{new Date(doc.updatedAt).toLocaleString()}</span>
              <small>Owner: {doc.owner?.name || "Unknown"}</small>
            </button>
          ))}
        </div>
      </section>

      {loadingMine || loadingShared ? (
        <p className="list-meta">Loading documents...</p>
      ) : null}
    </AppShell>
  );
}

export default function DashboardPage() {
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
          <p>Preparing dashboard...</p>
        </section>
      </main>
    );
  }

  return (
    <ApolloProvider client={client}>
      <DashboardContent token={token} onLogout={() => setToken("")} />
    </ApolloProvider>
  );
}
