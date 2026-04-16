"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ApolloProvider, useQuery, useApolloClient, useMutation, gql } from "@apollo/client";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DocumentList from "@/components/DocumentList";
import { createApolloClient } from "@/lib/apollo";
import {
  GET_ME,
  GET_MY_DOCUMENTS,
  GET_SHARED_DOCUMENTS,
  GET_DOCUMENT,
  SEND_COLLABORATION_INVITE,
  UNSHARE_DOCUMENT,
  UPDATE_DOCUMENT,
  DELETE_DOCUMENT
} from "@/lib/graphql";
import { isEmail, toFriendlyError } from "@/lib/uiErrors";

const LIST_DIARY_ENTRIES = gql`
  query ListDiaryEntries($documentId: ID!) {
    listDiaryEntries(documentId: $documentId) {
      id
    }
  }
`;

function DiariesInternal() {
  const router = useRouter();
  const client = useApolloClient();

  const { data: meData } = useQuery(GET_ME, { fetchPolicy: "cache-and-network" });
  const { data: myDocsData, refetch: refetchMine } = useQuery(GET_MY_DOCUMENTS, { fetchPolicy: "cache-and-network" });
  const { data: sharedDocsData, refetch: refetchShared } = useQuery(GET_SHARED_DOCUMENTS, { fetchPolicy: "cache-and-network" });

  const [diaryMy, setDiaryMy] = useState([]);
  const [diaryShared, setDiaryShared] = useState([]);
  const [checking, setChecking] = useState(true);
  const [shareDocumentId, setShareDocumentId] = useState("");
  const [collabEmail, setCollabEmail] = useState("");
  const [collabPermission, setCollabPermission] = useState("EDIT");
  const [shareError, setShareError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function findDiaries() {
      setChecking(true);
      const myDocs = myDocsData?.myDocuments?.items || [];
      const sharedDocs = sharedDocsData?.sharedWithMeDocuments?.items || [];
      const docsToCheck = [...myDocs, ...sharedDocs];

      try {
        const checks = await Promise.all(
          docsToCheck.map(async (doc) => {
            try {
              const res = await client.query({
                query: LIST_DIARY_ENTRIES,
                variables: { documentId: doc.id },
                fetchPolicy: "network-only"
              });
              const entries = res?.data?.listDiaryEntries || [];
              return entries.length ? doc : null;
            } catch (e) {
              return null;
            }
          })
        );

        if (!mounted) return;
        const diaries = checks.filter(Boolean);
        setDiaryMy(diaries.filter((d) => String(d.owner.id) === String(meData?.me?.id)));
        setDiaryShared(diaries.filter((d) => String(d.owner.id) !== String(meData?.me?.id)));
      } catch (e) {
        setDiaryMy([]);
        setDiaryShared([]);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    findDiaries();
    return () => {
      mounted = false;
    };
  }, [myDocsData, sharedDocsData, meData, client]);

  const {
    data: shareDocData,
    loading: loadingShareDoc,
    refetch: refetchShareDoc
  } = useQuery(GET_DOCUMENT, {
    variables: { id: shareDocumentId },
    skip: !shareDocumentId,
    fetchPolicy: "cache-and-network"
  });

  const [sendInvite, { loading: sharingDocument }] = useMutation(SEND_COLLABORATION_INVITE);
  const [unshareDocument, { loading: unsharingDocument }] = useMutation(UNSHARE_DOCUMENT);
  const [updateDocument, { loading: updatingDocumentVisibility }] = useMutation(UPDATE_DOCUMENT);
  const [deleteDocument, { loading: deletingDocument }] = useMutation(DELETE_DOCUMENT);

  const selectedShareDoc = shareDocData?.document || null;
  const shareBusy = sharingDocument || unsharingDocument || loadingShareDoc || updatingDocumentVisibility;

  function openShareModal(documentId) {
    setShareDocumentId(String(documentId || ""));
    setCollabEmail("");
    setCollabPermission("EDIT");
    setShareError("");
  }

  function closeShareModal() {
    setShareDocumentId("");
    setShareError("");
    setConfirmDelete(false);
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

      await Promise.all([refetchShareDoc(), refetchMine(), refetchShared()]);
    } catch (error) {
      setShareError(toFriendlyError(error));
    }
  }

  function handleSelectDocument(documentId) {
    router.push(`/doc/${documentId}`);
  }

  return (
    <AppShell title="Diaries" subtitle={`Signed in as ${meData?.me?.name || "User"}`}>
      <section className="panel dashboard-toolbar">
        <p className="list-meta">Diaries are documents that contain dated entries.</p>
      </section>

      <DocumentList
        myDocs={diaryMy}
        sharedDocs={diaryShared}
        showingSearch={false}
        totalSearch={0}
        activeId={null}
        onSelect={handleSelectDocument}
        onOpenCollaborators={openShareModal}
        showShareActions
        showShareActionsOnShared={false}
        canShareDoc={(doc) => String(doc?.owner?.id || "") === String(meData?.me?.id || "")}
        showCreateButton={false}
        onCreate={() => {}}
      />

      {shareDocumentId ? (
        <section className="modal-backdrop" role="presentation">
          <article className="panel modal-card" role="dialog" aria-modal="true">
            <h3>Settings: {selectedShareDoc?.title || "Document"}</h3>
            {shareError ? <p className="field-error">{shareError}</p> : null}

            <div className="doc-visibility-control">
              <label htmlFor="diaries-visibility-select">Document visibility</label>
              <select
                id="diaries-visibility-select"
                value={selectedShareDoc?.isPublic ? "PUBLIC" : "PRIVATE"}
                onChange={(event) => handleUpdateVisibility(event.target.value === "PUBLIC")}
                disabled={shareBusy || String(selectedShareDoc?.owner?.id) !== String(meData?.me?.id)}
              >
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public</option>
              </select>
              <p className="list-meta">Discover search includes your own and shared private documents.</p>
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

            {confirmDelete ? (
              <>
                <p>
                  Delete <strong>{selectedShareDoc?.title}</strong>? This action cannot be undone.
                </p>
                <div className="modal-actions">
                  <button type="button" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={async () => {
                      if (!shareDocumentId) return;
                      setShareError("");
                      try {
                        await deleteDocument({ variables: { id: shareDocumentId } });
                        await Promise.all([refetchMine(), refetchShared()]);
                        setShareDocumentId("");
                        setConfirmDelete(false);
                      } catch (e) {
                        setShareError(toFriendlyError(e));
                      }
                    }}
                    disabled={deletingDocument}
                  >
                    {deletingDocument ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            ) : (
              <div className="modal-actions">
                {String(selectedShareDoc?.owner?.id) === String(meData?.me?.id) ? (
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => setConfirmDelete(true)}
                    disabled={deletingDocument}
                  >
                    {deletingDocument ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
                <button type="button" onClick={closeShareModal}>
                  Close
                </button>
              </div>
            )}
          </article>
        </section>
      ) : null}

      {checking ? (
        <p className="list-meta">Checking diaries...</p>
      ) : (!diaryMy.length && !diaryShared.length) ? (
        <section className="panel notice-panel">
          <p>No diaries found.</p>
        </section>
      ) : null}
    </AppShell>
  );
}

export default function DiariesPage() {
  const client = useMemo(() => createApolloClient(""), []);
  return (
    <ApolloProvider client={client}>
      <DiariesInternal />
    </ApolloProvider>
  );
}
