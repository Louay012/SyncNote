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
  LIKE_DOCUMENT,
  SEARCH_OTHER_USERS_DOCUMENTS_BY_TITLE,
  UPDATE_DOCUMENT,
  UNLIKE_DOCUMENT
} from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

const PAGE_SIZE = 12;

function LoveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="discover-love-svg">
      <path d="M12 21s-7-4.4-9.4-8.2C.7 9.8 2.2 6 5.7 6c2.2 0 3.5 1.3 4.3 2.4.8-1.1 2.1-2.4 4.3-2.4 3.5 0 5 3.8 3.1 6.8C19 16.6 12 21 12 21Z" />
    </svg>
  );
}

function DiscoverContent({ token, onLogout }) {
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchMode, setSearchMode] = useState("TITLE");
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("UPDATED_AT");
  const [sortDirection, setSortDirection] = useState("DESC");
  const [pendingLikeId, setPendingLikeId] = useState("");
  const [pendingVisibilityId, setPendingVisibilityId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextKeyword = searchInput.trim();
      setSearchKeyword(nextKeyword);
      setOffset(0);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setOffset(0);
  }, [sortBy, sortDirection, searchMode]);

  const listingVariables = {
    keyword: searchKeyword,
    mode: searchMode,
    limit: PAGE_SIZE,
    offset,
    sortBy,
    sortDirection
  };

  const activeSearch = searchKeyword.length >= 2;

  const { data: meData } = useQuery(GET_ME, {
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const {
    data,
    loading,
    error,
    refetch
  } = useQuery(SEARCH_OTHER_USERS_DOCUMENTS_BY_TITLE, {
    variables: listingVariables,
    skip: !token || !activeSearch,
    fetchPolicy: "cache-and-network"
  });

  const [likeDocument] = useMutation(LIKE_DOCUMENT);
  const [unlikeDocument] = useMutation(UNLIKE_DOCUMENT);
  const [updateDocument] = useMutation(UPDATE_DOCUMENT);

  const listData = data?.searchOtherUsersDocumentsByTitle;
  const items = listData?.items || [];
  const total = listData?.total || 0;

  async function handleToggleLike(documentItem) {
    if (!documentItem?.id) {
      return;
    }

    if (String(documentItem.owner?.id || "") === String(meData?.me?.id || "")) {
      return;
    }

    const documentId = String(documentItem.id);
    setPendingLikeId(documentId);

    try {
      if (documentItem.likedByMe) {
        await unlikeDocument({
          variables: { documentId }
        });
      } else {
        await likeDocument({
          variables: { documentId }
        });
      }

      await refetch();
    } finally {
      setPendingLikeId("");
    }
  }

  async function handleChangeVisibility(documentId, nextIsPublic) {
    const safeDocumentId = String(documentId || "");
    if (!safeDocumentId) {
      return;
    }

    setPendingVisibilityId(safeDocumentId);

    try {
      await updateDocument({
        variables: {
          id: safeDocumentId,
          isPublic: Boolean(nextIsPublic)
        }
      });

      await refetch();
    } finally {
      setPendingVisibilityId("");
    }
  }

  function handleLogout() {
    clearStoredToken();
    apolloClient.clearStore();
    onLogout();
    router.replace("/auth");
  }

  return (
    <AppShell
      title="Discover"
      subtitle={`Signed in as ${meData?.me?.name || "User"}`}
      onLogout={handleLogout}
    >
      <section className="panel dashboard-toolbar">
        <div className="dashboard-filters">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search words or full sentence in documents"
          />
          <select value={searchMode} onChange={(event) => setSearchMode(event.target.value)}>
            <option value="TITLE">Search by title</option>
            <option value="CONTENT">Search by content</option>
          </select>
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
        <p className="list-meta">Type at least 2 characters and choose search mode: title or content.</p>
      </section>

      {!activeSearch ? (
        <section className="panel notice-panel">
          <p>Start typing words or a sentence to search your documents, shared documents, and public documents.</p>
        </section>
      ) : null}

      {error ? (
        <section className="panel notice-panel error-notice">
          <p>{toFriendlyError(error)}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </section>
      ) : null}

      {activeSearch ? (
        <section className="discover-grid">
          {items.map((item) => {
            const isBusy = pendingLikeId === String(item.id);
            const isOwner = String(item.owner?.id || "") === String(meData?.me?.id || "");
            const visibilityBusy = pendingVisibilityId === String(item.id);

            function openDocument() {
              const id = String(item.id || "");
              if (id) {
                router.push(`/doc/${id}`);
              }
            }

            return (
              <article
                className="panel discover-card"
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={openDocument}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDocument();
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="discover-card-content">
                  <div className="discover-doc-meta">
                    <h3>{item.title}</h3>
                    <p className="list-meta">Owner: {item.owner?.name || "Unknown"}</p>
                    <p className="list-meta">Visibility: {item.isPublic ? "Public" : "Private"}</p>
                    <p className="list-meta">Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                    {isOwner ? (
                      <div className="doc-visibility-control">
                        <label htmlFor={`discover-visibility-${item.id}`}>Document visibility</label>
                        <select
                          id={`discover-visibility-${item.id}`}
                          value={item.isPublic ? "PUBLIC" : "PRIVATE"}
                          onChange={(event) =>
                            handleChangeVisibility(item.id, event.target.value === "PUBLIC")
                          }
                          disabled={visibilityBusy}
                        >
                          <option value="PRIVATE">Private</option>
                          <option value="PUBLIC">Public</option>
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <div className="discover-love-wrap">
                    <button
                      type="button"
                      className={item.likedByMe ? "discover-love-btn is-loved" : "discover-love-btn"}
                      onClick={() => handleToggleLike(item)}
                      disabled={isBusy || isOwner}
                      aria-label={item.likedByMe ? "Remove love" : "Love document"}
                    >
                      <LoveIcon />
                      <span className="discover-love-count">{item.likesCount}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {activeSearch && !loading && items.length === 0 ? (
        <section className="panel notice-panel">
          <p>No documents found for this search text yet.</p>
        </section>
      ) : null}

      {activeSearch ? (
        <section className="panel discover-pagination">
          <p className="list-meta">
            Showing {items.length} of {total} matching documents.
          </p>
          <div className="discover-pagination-actions">
            <button
              type="button"
              onClick={() => setOffset((current) => Math.max(current - PAGE_SIZE, 0))}
              disabled={offset === 0 || loading}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || loading}
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      {loading ? <p className="list-meta">Loading discovery results...</p> : null}
    </AppShell>
  );
}

export default function DiscoverPage() {
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
          <p>Preparing discover...</p>
        </section>
      </main>
    );
  }

  return (
    <ApolloProvider client={client}>
      <DiscoverContent token={token} onLogout={() => setToken("")} />
    </ApolloProvider>
  );
}
