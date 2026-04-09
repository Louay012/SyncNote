"use client";

import {
  ApolloProvider,
  useMutation,
  useApolloClient,
  useQuery
} from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DocumentList from "@/components/DocumentList";
import { createApolloClient } from "@/lib/apollo";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/authToken";
import {
  GET_ME,
  GET_DOCUMENT,
  GET_MY_DOCUMENTS,
  GET_SHARED_DOCUMENTS,
  SEND_COLLABORATION_INVITE,
  UPDATE_DOCUMENT,
  UNSHARE_DOCUMENT,
  SEARCH_DOCUMENTS
} from "@/lib/graphql";
import { isEmail, toFriendlyError } from "@/lib/uiErrors";

const PAGE_SIZE = 8;

function DocumentsContent({ token, onLogout }) {
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [listOffset, setListOffset] = useState(0);
  const [sortBy, setSortBy] = useState("UPDATED_AT");
  const [sortDirection, setSortDirection] = useState("DESC");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [shareDocumentId, setShareDocumentId] = useState("");
  const [collabEmail, setCollabEmail] = useState("");
  const [collabPermission, setCollabPermission] = useState("EDIT");
  const [shareError, setShareError] = useState("");

  const listingVariables = {
    limit: PAGE_SIZE,
    offset: listOffset,
    sortBy,
    sortDirection
  };

  const searching = searchKeyword.length >= 2;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextKeyword = searchInput.trim();
      setSearchKeyword(nextKeyword);
      setListOffset(0);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setListOffset(0);
  }, [sortBy, sortDirection]);

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
    skip: !token || searching,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: sharedDocsData,
    loading: loadingShared,
    error: sharedDocsError,
    refetch: refetchShared
  } = useQuery(GET_SHARED_DOCUMENTS, {
    variables: listingVariables,
    skip: !token || searching,
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

  const {
    data: shareDocData,
    loading: loadingShareDoc,
    refetch: refetchShareDoc
  } = useQuery(GET_DOCUMENT, {
    variables: { id: shareDocumentId },
    skip: !token || !shareDocumentId,
    fetchPolicy: "cache-and-network"
  });

  const [sendInvite, { loading: sharingDocument }] = useMutation(SEND_COLLABORATION_INVITE);
  const [unshareDocument, { loading: unsharingDocument }] = useMutation(UNSHARE_DOCUMENT);
  const [updateDocument, { loading: updatingDocumentVisibility }] = useMutation(UPDATE_DOCUMENT);

  const myDocs = searching
    ? searchDocsData?.searchDocuments?.items || []
    : myDocsData?.myDocuments?.items || [];
  const sharedDocs = searching ? [] : sharedDocsData?.sharedWithMeDocuments?.items || [];
  const totalMine = myDocsData?.myDocuments?.total || 0;
  const totalShared = sharedDocsData?.sharedWithMeDocuments?.total || 0;
  const totalSearch = searchDocsData?.searchDocuments?.total || 0;
  const activeTotal = searching ? totalSearch : totalMine + totalShared;

  const listingError = myDocsError || sharedDocsError || searchError;
  const selectedShareDoc = shareDocData?.document || null;
  const shareBusy =
    sharingDocument || unsharingDocument || loadingShareDoc || updatingDocumentVisibility;

  async function refreshCollections() {
    if (searching) {
      await refetchSearch();
      return;
    }

    await Promise.all([refetchMine(), refetchShared()]);
  }

  function handleSelectDocument(documentId) {
    router.push(`/doc/${documentId}`);
  }

  function openShareModal(documentId) {
    setShareDocumentId(String(documentId || ""));
    setCollabEmail("");
    setCollabPermission("EDIT");
    setShareError("");
  }

  function closeShareModal() {
    setShareDocumentId("");
    setShareError("");
  }

  async function handleShare(event) {
    event.preventDefault();

    if (!shareDocumentId || !collabEmail.trim()) {
      setShareError("Collaborator email is required");
      return;
    }

    if (!isEmail(collabEmail)) {
      setShareError("Please enter a valid invite email.");
      return;
    }

    setShareError("");
    try {
      await sendInvite({
        variables: {
          documentId: shareDocumentId,
          userEmail: collabEmail.trim(),
          permission: collabPermission
        }
      });

      setCollabEmail("");
      await Promise.all([refetchShareDoc(), refetchMine(), refetchShared()]);
    } catch (error) {
      setShareError(toFriendlyError(error));
    }
  }

  async function handleUnshare(userEmail) {
    if (!shareDocumentId) {
      return;
    }

    setShareError("");
    try {
      await unshareDocument({
        variables: {
          documentId: shareDocumentId,
          userEmail
        }
      });

      await Promise.all([refetchShareDoc(), refetchMine(), refetchShared()]);
    } catch (error) {
      setShareError(toFriendlyError(error));
    }
  }

  async function handleUpdateVisibility(isPublic) {
    if (!shareDocumentId) {
      return;
    }

    setShareError("");
    try {
      await updateDocument({
        variables: {
          id: shareDocumentId,
          isPublic: Boolean(isPublic)
        }
      });

      await Promise.all([refetchShareDoc(), refreshCollections()]);
    } catch (error) {
      setShareError(toFriendlyError(error));
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
      title="All Documents"
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
        <p className="list-meta">Create new documents from the sidebar.</p>
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
        totalMine={totalMine}
        totalShared={totalShared}
        showingSearch={searching}
        totalSearch={totalSearch}
        activeId={null}
        onSelect={handleSelectDocument}
        onOpenCollaborators={openShareModal}
        showShareActions
        showShareActionsOnShared={false}
        canShareDoc={(doc) => String(doc?.owner?.id || "") === String(meData?.me?.id || "")}
        showCreateButton={false}
        onCreate={() => {}}
        onPrevPage={() => setListOffset((current) => Math.max(current - PAGE_SIZE, 0))}
        onNextPage={() => setListOffset((current) => current + PAGE_SIZE)}
        canPrev={listOffset > 0}
        canNext={listOffset + PAGE_SIZE < activeTotal}
      />

      {!loadingMine && !loadingShared && !loadingSearch && !myDocs.length && !sharedDocs.length ? (
        <section className="panel notice-panel">
          <p>No documents yet. Use Create Document in the sidebar to get started.</p>
        </section>
      ) : null}

      {loadingMine || loadingShared || loadingSearch ? (
        <p className="list-meta">Loading documents...</p>
      ) : null}

      {shareDocumentId ? (
        <section className="modal-backdrop" role="presentation">
          <article className="panel modal-card" role="dialog" aria-modal="true">
            <h3>Share: {selectedShareDoc?.title || "Document"}</h3>
            {shareError ? <p className="field-error">{shareError}</p> : null}

            <div className="doc-visibility-control">
              <label htmlFor="documents-visibility-select">Document visibility</label>
              <select
                id="documents-visibility-select"
                value={selectedShareDoc?.isPublic ? "PUBLIC" : "PRIVATE"}
                onChange={(event) => handleUpdateVisibility(event.target.value === "PUBLIC")}
                disabled={shareBusy}
              >
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public</option>
              </select>
              <p className="list-meta">Private documents are excluded from Discover search.</p>
            </div>

            <form className="share-form" onSubmit={handleShare}>
              <input
                value={collabEmail}
                onChange={(event) => setCollabEmail(event.target.value)}
                placeholder="Collaborator email"
                disabled={shareBusy}
              />
              <select
                value={collabPermission}
                onChange={(event) => setCollabPermission(event.target.value)}
                disabled={shareBusy}
              >
                <option value="EDIT">EDIT</option>
                <option value="VIEW">VIEW</option>
              </select>
              <button type="submit" disabled={shareBusy}>
                {sharingDocument ? "Sending..." : "Send Invite"}
              </button>
            </form>

            <div className="collab-list">
              {(selectedShareDoc?.collaborators || []).map((collaborator) => (
                <div key={collaborator.id} className="collab-item">
                  <div>
                    <strong>{collaborator.name}</strong>
                    <small>{collaborator.email}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnshare(collaborator.email)}
                    disabled={shareBusy}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {(selectedShareDoc?.collaborators || []).length === 0 && !loadingShareDoc ? (
                <p className="empty">No collaborators yet.</p>
              ) : null}
            </div>

            <div className="modal-actions">
              <button type="button" onClick={closeShareModal}>
                Close
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}

export default function DocumentsPage() {
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
          <p>Preparing documents...</p>
        </section>
      </main>
    );
  }

  return (
    <ApolloProvider client={client}>
      <DocumentsContent token={token} onLogout={() => setToken("")} />
    </ApolloProvider>
  );
}
