"use client";

import {
  ApolloProvider,
  useApolloClient,
  useQuery
} from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createApolloClient } from "@/lib/apollo";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/authToken";
import {
  GET_ME,
  GET_MY_DOCUMENTS,
  GET_SHARED_DOCUMENTS
} from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

const PAGE_SIZE = 100;

function normalizeScope(value) {
  if (value === "my" || value === "shared") {
    return value;
  }

  return "all";
}

function DashboardContent({ token, onLogout }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apolloClient = useApolloClient();
  const activeScope = normalizeScope(searchParams.get("scope"));

  const [sortBy, setSortBy] = useState("UPDATED_AT");
  const [sortDirection, setSortDirection] = useState("DESC");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");

  const listingVariables = {
    limit: PAGE_SIZE,
    offset: 0,
    sortBy,
    sortDirection
  };

  const searching = searchKeyword.length >= 2;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextKeyword = searchInput.trim();
      setSearchKeyword(nextKeyword);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

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

  const {
    data: searchDocsData,
    loading: loadingSearch,
    error: searchError,
    refetch: refetchSearch
  } = useQuery(SEARCH_DOCUMENTS, {
    variables: {
      keyword: searchKeyword,
      ...listingVariables
    },
    skip: !token || !searching,
    fetchPolicy: "cache-and-network"
  });

  const userId = String(meData?.me?.id || "");
  const canSeparateSearchByOwner = Boolean(userId);

  const searchItems = searchDocsData?.searchDocuments?.items || [];
  const searchMine = canSeparateSearchByOwner
    ? searchItems.filter((item) => String(item.owner?.id || "") === userId)
    : searchItems;
  const searchShared = canSeparateSearchByOwner
    ? searchItems.filter((item) => String(item.owner?.id || "") !== userId)
    : [];

  const mineSource = searching
    ? searchMine
    : myDocsData?.myDocuments?.items || [];
  const sharedSource = searching
    ? searchShared
    : sharedDocsData?.sharedWithMeDocuments?.items || [];

  const myDocs = activeScope === "shared" ? [] : mineSource;
  const sharedDocs = activeScope === "my" ? [] : sharedSource;

  const totalMineRaw = myDocsData?.myDocuments?.total || 0;
  const totalSharedRaw = sharedDocsData?.sharedWithMeDocuments?.total || 0;
  const totalSearchRaw = searchDocsData?.searchDocuments?.total || 0;

  const totalMine = activeScope === "shared" ? 0 : searching ? searchMine.length : totalMineRaw;
  const totalShared =
    activeScope === "my" ? 0 : searching ? searchShared.length : totalSharedRaw;
  const totalSearch =
    activeScope === "all"
      ? totalSearchRaw
      : activeScope === "my"
      ? searchMine.length
      : searchShared.length;

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
      <section className="panel dashboard-toolbar">
        <div className="dashboard-filters">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search documents"
          />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="UPDATED_AT">Sort by updated</option>
            <option value="CREATED_AT">Sort by created</option>
            <option value="TITLE">Sort by title</option>
          </select>
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value)}
          >
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
          </select>
        </div>
      </section>

      {listingError ? (
        <section className="panel notice-panel error-notice">
          <p>{toFriendlyError(listingError)}</p>
          <button type="button" onClick={refreshCollections}>
            Retry
          </button>
        </section>
      ) : null}

      <DocumentList
        myDocs={myDocs}
        sharedDocs={sharedDocs}
        showingSearch={searching}
        totalSearch={totalSearch}
        scope={activeScope}
        activeId={null}
        onSelect={handleSelectDocument}
        onOpenCollaborators={() => {}}
        showShareActions={false}
        showCreateButton={false}
        onCreate={() => {}}
      />

      {!loadingMine && !loadingShared && !loadingSearch && !myDocs.length && !sharedDocs.length ? (
        <section className="panel notice-panel">
          <p>No documents yet. Use Create Document in the sidebar to get started.</p>
        </section>
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
