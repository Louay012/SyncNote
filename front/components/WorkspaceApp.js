"use client";

import {
  ApolloProvider,
  useApolloClient,
  useMutation,
  useQuery,
  useSubscription
} from "@apollo/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommentsPane from "@/components/CommentsPane";
import DocumentList from "@/components/DocumentList";
import EditorPane from "@/components/EditorPane";
import SectionsTree from "@/components/SectionsTree";
import TabsPanel from "@/components/TabsPanel";
import VersionPanel from "@/components/VersionPanel";
import { createApolloClient } from "@/lib/apollo";
import {
  ADD_COMMENT,
  COMMENT_ADDED,
  CREATE_DOCUMENT,
  CREATE_SECTION,
  DELETE_SECTION,
  GET_DOCUMENT,
  GET_DOCUMENT_PRESENCE,
  GET_ME,
  GET_MY_DOCUMENTS,
  GET_SECTION_COMMENTS,
  GET_SECTIONS,
  GET_SHARED_DOCUMENTS,
  GET_VERSIONS,
  LEAVE_DOCUMENT,
  REORDER_SECTION,
  RESTORE_VERSION,
  SAVE_VERSION,
  SEARCH_DOCUMENTS,
  SECTION_UPDATED,
  SHARE_DOCUMENT,
  UNSHARE_DOCUMENT,
  UPDATE_DOCUMENT,
  UPDATE_PRESENCE,
  UPDATE_SECTION,
  UPDATE_TYPING_STATUS,
  USER_PRESENCE_CHANGED,
  USER_TYPING
} from "@/lib/graphql";

const PAGE_SIZE = 8;

function sortByOrder(a, b) {
  return Number(a.order || 0) - Number(b.order || 0);
}

function sortSections(items = []) {
  return [...items].sort((a, b) => {
    const aIsRoot = a.parentId === null;
    const bIsRoot = b.parentId === null;

    if (aIsRoot && !bIsRoot) {
      return -1;
    }

    if (!aIsRoot && bIsRoot) {
      return 1;
    }

    if (String(a.parentId || "") !== String(b.parentId || "")) {
      return String(a.parentId || "").localeCompare(String(b.parentId || ""));
    }

    return sortByOrder(a, b);
  });
}

function firstPreferredSection(sections) {
  const roots = sections.filter((section) => section.parentId === null).sort(sortByOrder);
  return roots[0] || sections[0] || null;
}

function boundedIndex(nextIndex, maxIndex) {
  return Math.min(Math.max(Number(nextIndex) || 0, 0), Math.max(maxIndex, 0));
}

function Workspace() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const client = useMemo(() => createApolloClient(token), [token]);

  useEffect(() => {
    const saved = window.localStorage.getItem("syncnote-token") || "";
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

    window.localStorage.setItem("syncnote-token", token);
  }, [hydrated, token, router]);

  if (!hydrated) {
    return (
      <main className="shell">
        <section className="panel notice-panel">
          <p>Preparing workspace...</p>
        </section>
      </main>
    );
  }

  return (
    <ApolloProvider client={client}>
      <WorkspaceContent
        token={token}
        onLogout={() => setToken("")}
        activeId={activeId}
        setActiveId={setActiveId}
      />
    </ApolloProvider>
  );
}

function WorkspaceContent({ token, onLogout, activeId, setActiveId }) {
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [notice, setNotice] = useState("");
  const [listOffset, setListOffset] = useState(0);
  const [sortBy, setSortBy] = useState("UPDATED_AT");
  const [sortDirection, setSortDirection] = useState("DESC");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionDraft, setSectionDraft] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [lastSectionActor, setLastSectionActor] = useState("");
  const [collabEmail, setCollabEmail] = useState("");
  const [collabPermission, setCollabPermission] = useState("EDIT");

  const saveTimerRef = useRef(null);
  const selectedSectionIdRef = useRef(selectedSectionId);
  const activeSectionIdRef = useRef(null);
  const localEditRef = useRef(false);

  useEffect(() => {
    selectedSectionIdRef.current = selectedSectionId;
  }, [selectedSectionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextKeyword = searchInput.trim();
      setSearchKeyword(nextKeyword);
      setListOffset(0);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const pruneTimer = window.setInterval(() => {
      setTypingUsers((current) => {
        const now = Date.now();
        const next = Object.fromEntries(
          Object.entries(current).filter(([, value]) => {
            return now - new Date(value.at).getTime() < 5000;
          })
        );

        if (Object.keys(next).length === Object.keys(current).length) {
          return current;
        }

        return next;
      });
    }, 1500);

    return () => window.clearInterval(pruneTimer);
  }, []);

  const listingVariables = {
    limit: PAGE_SIZE,
    offset: listOffset,
    sortBy,
    sortDirection
  };

  const searching = searchKeyword.length >= 2;

  const { data: meData } = useQuery(GET_ME, {
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const { data: myDocsData, refetch: refetchMine } = useQuery(GET_MY_DOCUMENTS, {
    variables: listingVariables,
    skip: !token || searching,
    fetchPolicy: "cache-and-network"
  });

  const { data: sharedDocsData, refetch: refetchShared } = useQuery(
    GET_SHARED_DOCUMENTS,
    {
      variables: listingVariables,
      skip: !token || searching,
      fetchPolicy: "cache-and-network"
    }
  );

  const { data: searchDocsData, refetch: refetchSearch } = useQuery(SEARCH_DOCUMENTS, {
    variables: {
      keyword: searchKeyword,
      ...listingVariables
    },
    skip: !token || !searching,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: docData,
    loading: loadingDoc,
    refetch: refetchDoc
  } = useQuery(GET_DOCUMENT, {
    variables: { id: activeId },
    skip: !token || !activeId,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: sectionsData,
    loading: loadingSections,
    refetch: refetchSections
  } = useQuery(GET_SECTIONS, {
    variables: { documentId: activeId },
    skip: !token || !activeId,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: versionsData,
    loading: loadingVersions,
    refetch: refetchVersions
  } = useQuery(GET_VERSIONS, {
    variables: { documentId: activeId },
    skip: !token || !activeId,
    fetchPolicy: "cache-and-network"
  });

  const { data: presenceQueryData } = useQuery(GET_DOCUMENT_PRESENCE, {
    variables: { documentId: activeId },
    skip: !token || !activeId,
    fetchPolicy: "cache-and-network"
  });

  const sections = useMemo(() => {
    return sortSections(sectionsData?.getSections || []);
  }, [sectionsData]);

  const activeSection = useMemo(() => {
    if (!selectedSectionId) {
      return null;
    }

    return sections.find((section) => String(section.id) === String(selectedSectionId)) || null;
  }, [sections, selectedSectionId]);

  const {
    data: commentsData,
    loading: loadingComments,
    refetch: refetchComments
  } = useQuery(GET_SECTION_COMMENTS, {
    variables: { sectionId: activeSection?.id },
    skip: !token || !activeSection?.id,
    fetchPolicy: "cache-and-network"
  });

  const [createDocument] = useMutation(CREATE_DOCUMENT);
  const [updateDocument, { loading: savingTitle }] = useMutation(UPDATE_DOCUMENT);
  const [createSection, { loading: creatingSection }] = useMutation(CREATE_SECTION);
  const [updateSection, { loading: savingSection }] = useMutation(UPDATE_SECTION);
  const [deleteSection, { loading: deletingSection }] = useMutation(DELETE_SECTION);
  const [reorderSection, { loading: reorderingSection }] = useMutation(REORDER_SECTION);
  const [saveVersion, { loading: savingVersion }] = useMutation(SAVE_VERSION);
  const [restoreVersion, { loading: restoringVersion }] = useMutation(RESTORE_VERSION);
  const [addComment, { loading: postingComment }] = useMutation(ADD_COMMENT);
  const [shareDocument, { loading: sharingDocument }] = useMutation(SHARE_DOCUMENT);
  const [unshareDocument, { loading: unsharingDocument }] =
    useMutation(UNSHARE_DOCUMENT);
  const [updateTypingStatus] = useMutation(UPDATE_TYPING_STATUS);
  const [updatePresence] = useMutation(UPDATE_PRESENCE);
  const [leaveDocument] = useMutation(LEAVE_DOCUMENT);

  const myDocs = searching
    ? searchDocsData?.searchDocuments?.items || []
    : myDocsData?.myDocuments?.items || [];
  const sharedDocs = searching ? [] : sharedDocsData?.sharedWithMeDocuments?.items || [];
  const activeDoc = docData?.document || null;
  const totalMine = myDocsData?.myDocuments?.total || 0;
  const totalShared = sharedDocsData?.sharedWithMeDocuments?.total || 0;
  const totalSearch = searchDocsData?.searchDocuments?.total || 0;
  const activeTotal = searching ? totalSearch : totalMine + totalShared;
  const comments = commentsData?.commentsBySection || [];
  const versions = versionsData?.getVersions || [];

  useEffect(() => {
    if (!activeId && myDocs.length > 0) {
      setActiveId(myDocs[0].id);
      return;
    }

    if (!activeId && sharedDocs.length > 0) {
      setActiveId(sharedDocs[0].id);
    }
  }, [myDocs, sharedDocs, activeId, setActiveId]);

  useEffect(() => {
    if (!activeId) {
      setSelectedSectionId(null);
      return;
    }

    if (!sections.length) {
      setSelectedSectionId(null);
      return;
    }

    const currentIsValid = sections.some(
      (section) => String(section.id) === String(selectedSectionId || "")
    );

    if (!currentIsValid) {
      const preferred = firstPreferredSection(sections);
      setSelectedSectionId(preferred?.id || null);
    }
  }, [activeId, sections, selectedSectionId]);

  useEffect(() => {
    if (presenceQueryData?.documentPresence) {
      setPresenceUsers(presenceQueryData.documentPresence);
    }
  }, [presenceQueryData]);

  useEffect(() => {
    if (!activeSection) {
      setSectionDraft("");
      activeSectionIdRef.current = null;
      localEditRef.current = false;
      return;
    }

    if (!localEditRef.current || activeSectionIdRef.current !== activeSection.id) {
      setSectionDraft(activeSection.content || "");
      setSaveState("idle");
      activeSectionIdRef.current = activeSection.id;
      localEditRef.current = false;
    }
  }, [activeSection]);

  useEffect(() => {
    if (!token || !activeId) {
      return undefined;
    }

    let mounted = true;
    const documentId = activeId;

    async function sendPresencePulse() {
      try {
        const result = await updatePresence({
          variables: {
            documentId,
            sectionId: selectedSectionIdRef.current
          }
        });

        if (mounted && result.data?.updatePresence) {
          setPresenceUsers(result.data.updatePresence);
        }
      } catch {
        // Heartbeat is best-effort and subscription updates still flow.
      }
    }

    sendPresencePulse();
    const interval = window.setInterval(sendPresencePulse, 15000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      leaveDocument({ variables: { documentId } }).catch(() => {});
    };
  }, [token, activeId, updatePresence, leaveDocument]);

  useEffect(() => {
    if (!token || !activeId) {
      return;
    }

    updatePresence({
      variables: {
        documentId: activeId,
        sectionId: selectedSectionId
      }
    })
      .then((result) => {
        if (result.data?.updatePresence) {
          setPresenceUsers(result.data.updatePresence);
        }
      })
      .catch(() => {});
  }, [token, activeId, selectedSectionId, updatePresence]);

  useSubscription(SECTION_UPDATED, {
    skip: !token || !activeId,
    variables: { documentId: activeId },
    onData: ({ data }) => {
      const updatedSection = data.data?.sectionUpdated;
      if (!updatedSection) {
        return;
      }

      if (updatedSection.updatedBy?.name) {
        setLastSectionActor(updatedSection.updatedBy.name);

        if (String(updatedSection.updatedBy.id) !== String(meData?.me?.id || "")) {
          setNotice(`Updated by ${updatedSection.updatedBy.name} in ${updatedSection.title}`);
        }
      }

      if (updatedSection.id === activeSectionIdRef.current && !localEditRef.current) {
        setSectionDraft(updatedSection.content || "");
        setSaveState("saved");
      }

      refetchSections();
      refetchDoc();
      refetchVersions();

      if (searching) {
        refetchSearch();
      } else {
        refetchMine();
        refetchShared();
      }
    }
  });

  useSubscription(COMMENT_ADDED, {
    skip: !token || !activeSection?.id,
    variables: { sectionId: activeSection?.id },
    onData: () => {
      refetchComments();
    }
  });

  useSubscription(USER_TYPING, {
    skip: !token || !activeId,
    variables: { documentId: activeId },
    onData: ({ data }) => {
      const payload = data.data?.userTyping;
      if (!payload) {
        return;
      }

      if (String(payload.userId) === String(meData?.me?.id || "")) {
        return;
      }

      setTypingUsers((current) => {
        const next = { ...current };
        if (payload.isTyping) {
          next[payload.userId] = payload;
        } else {
          delete next[payload.userId];
        }
        return next;
      });
    }
  });

  useSubscription(USER_PRESENCE_CHANGED, {
    skip: !token || !activeId,
    variables: { documentId: activeId },
    onData: ({ data }) => {
      setPresenceUsers(data.data?.userPresenceChanged || []);
    }
  });

  const typingNotice = useMemo(() => {
    const others = Object.values(typingUsers);
    if (!others.length) {
      return "";
    }

    if (others.length === 1) {
      const one = others[0];
      return `${one.user?.name || "Someone"} is typing in ${
        one.sectionTitle || "a section"
      }...`;
    }

    return `${others[0].user?.name || "Someone"} and ${others.length - 1} more are typing...`;
  }, [typingUsers]);

  function clearPendingSave() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }

  function handleLogout() {
    onLogout();
    setActiveId(null);
    setSearchInput("");
    setSearchKeyword("");
    setListOffset(0);
    setSelectedSectionId(null);
    setSectionDraft("");
    setSaveState("idle");
    setPresenceUsers([]);
    setTypingUsers({});
    setLastSectionActor("");
    setCollabEmail("");
    clearPendingSave();
    window.localStorage.removeItem("syncnote-token");
    apolloClient.clearStore();
    router.replace("/auth");
  }

  function refreshDocumentCollections() {
    if (searching) {
      return refetchSearch();
    }

    return Promise.all([refetchMine(), refetchShared()]);
  }

  async function handleCreate() {
    const title = window.prompt("Document title");
    if (!title || !title.trim()) {
      return;
    }

    try {
      const result = await createDocument({
        variables: { title: title.trim(), content: "" }
      });

      const id = result.data?.createDocument?.id;
      await refreshDocumentCollections();

      if (id) {
        setActiveId(id);
        setSelectedSectionId(null);
        setSectionDraft("");
        setLastSectionActor("");
      }

      setNotice("Document created");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleSaveTitle(nextTitle) {
    if (!activeId) {
      return;
    }

    try {
      await updateDocument({
        variables: {
          id: activeId,
          title: nextTitle
        }
      });

      await Promise.all([refetchDoc(), refreshDocumentCollections()]);
      setNotice("Document title saved");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleSaveSectionTitle(nextTitle) {
    if (!activeSection) {
      return;
    }

    const normalized = String(nextTitle || "").trim();
    if (!normalized) {
      setNotice("Section title is required");
      return;
    }

    try {
      const result = await updateSection({
        variables: {
          sectionId: activeSection.id,
          title: normalized
        }
      });

      setLastSectionActor(
        result.data?.updateSection?.updatedBy?.name || meData?.me?.name || ""
      );
      await Promise.all([refetchSections(), refetchDoc(), refreshDocumentCollections()]);
      setNotice("Section title saved");
    } catch (error) {
      setNotice(error.message);
    }
  }

  function handleSectionInput(nextValue) {
    setSectionDraft(nextValue);

    if (!activeSection || !activeId) {
      return;
    }

    localEditRef.current = true;
    setSaveState("pending");

    updateTypingStatus({
      variables: {
        documentId: activeId,
        sectionId: activeSection.id,
        isTyping: true
      }
    }).catch(() => {});

    clearPendingSave();

    const sectionId = activeSection.id;
    const documentId = activeId;

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        setSaveState("saving");

        const result = await updateSection({
          variables: {
            sectionId,
            content: nextValue
          }
        });

        setLastSectionActor(
          result.data?.updateSection?.updatedBy?.name || meData?.me?.name || ""
        );
        localEditRef.current = false;
        setSaveState("saved");

        await Promise.all([refetchSections(), refetchDoc()]);
        await refreshDocumentCollections();
      } catch (error) {
        setSaveState("error");
        setNotice(error.message);
      } finally {
        updateTypingStatus({
          variables: {
            documentId,
            sectionId,
            isTyping: false
          }
        }).catch(() => {});
      }
    }, 1200);
  }

  async function handleCreateSection(parentId = null) {
    if (!activeId) {
      return;
    }

    const title = window.prompt(parentId ? "Subsection title" : "Section title");
    if (!title || !title.trim()) {
      return;
    }

    try {
      const result = await createSection({
        variables: {
          documentId: activeId,
          title: title.trim(),
          parentId
        }
      });

      const created = result.data?.createSection;
      await Promise.all([refetchSections(), refetchDoc(), refreshDocumentCollections()]);

      if (created?.id) {
        setSelectedSectionId(created.id);
      }

      setNotice(parentId ? "Subsection created" : "Section created");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleDeleteSection(sectionId) {
    const target = sections.find((section) => String(section.id) === String(sectionId));
    if (!target) {
      return;
    }

    const confirmed = window.confirm(
      target.parentId
        ? `Delete subsection "${target.title}"?`
        : `Delete section "${target.title}" and its subsections?`
    );

    if (!confirmed) {
      return;
    }

    try {
      clearPendingSave();
      await deleteSection({ variables: { sectionId: target.id } });

      if (String(selectedSectionId || "") === String(target.id)) {
        setSelectedSectionId(null);
        setSectionDraft("");
      }

      localEditRef.current = false;
      await Promise.all([
        refetchSections(),
        refetchDoc(),
        refetchVersions(),
        refreshDocumentCollections()
      ]);
      if (activeSection?.id === target.id) {
        refetchComments().catch(() => {});
      }
      setNotice("Section removed");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleMoveSection(sectionId, targetOrder) {
    const section = sections.find((item) => String(item.id) === String(sectionId));
    if (!section) {
      return;
    }

    const siblings = sections
      .filter((item) => String(item.parentId || "") === String(section.parentId || ""))
      .sort(sortByOrder);
    const currentIndex = siblings.findIndex((item) => String(item.id) === String(sectionId));

    if (currentIndex === -1) {
      return;
    }

    const boundedTarget = boundedIndex(targetOrder, siblings.length - 1);
    if (boundedTarget === currentIndex) {
      return;
    }

    try {
      await reorderSection({
        variables: {
          sectionId,
          order: boundedTarget
        }
      });

      await refetchSections();
      setNotice("Section order updated");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleAddComment(text) {
    if (!activeSection) {
      return;
    }

    try {
      await addComment({
        variables: {
          sectionId: activeSection.id,
          content: text
        }
      });

      await refetchComments();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleSaveVersion() {
    if (!activeId) {
      return;
    }

    try {
      await saveVersion({ variables: { documentId: activeId } });
      await refetchVersions();
      setNotice("Version snapshot saved");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleRestoreVersion(versionId) {
    if (!activeId) {
      return;
    }

    try {
      clearPendingSave();
      await restoreVersion({ variables: { versionId } });
      localEditRef.current = false;

      await Promise.all([
        refetchDoc(),
        refetchSections(),
        refetchComments(),
        refetchVersions(),
        refreshDocumentCollections()
      ]);

      setNotice("Version restored");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleShare(event) {
    event.preventDefault();

    if (!activeId || !collabEmail.trim()) {
      return;
    }

    try {
      await shareDocument({
        variables: {
          documentId: activeId,
          userEmail: collabEmail.trim(),
          permission: collabPermission
        }
      });

      await Promise.all([refetchDoc(), refetchShared(), refetchMine()]);
      setNotice(`Shared with ${collabEmail.trim()} as ${collabPermission}`);
      setCollabEmail("");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleUnshare(userEmail) {
    if (!activeId) {
      return;
    }

    try {
      await unshareDocument({
        variables: {
          documentId: activeId,
          userEmail
        }
      });

      await Promise.all([refetchDoc(), refetchShared(), refetchMine()]);
      setNotice(`Removed access for ${userEmail}`);
    } catch (error) {
      setNotice(error.message);
    }
  }

  function handlePrevPage() {
    setListOffset((current) => Math.max(current - PAGE_SIZE, 0));
  }

  function handleNextPage() {
    setListOffset((current) => current + PAGE_SIZE);
  }

  function handleSelectDocument(documentId) {
    clearPendingSave();
    setActiveId(documentId);
    setSelectedSectionId(null);
    setSectionDraft("");
    setSaveState("idle");
    setPresenceUsers([]);
    setTypingUsers({});
    setLastSectionActor("");
    localEditRef.current = false;
  }

  function handleSelectSection(sectionId) {
    clearPendingSave();
    setSelectedSectionId(sectionId);
    setSaveState("idle");
    localEditRef.current = false;
  }

  const tabs = [
    {
      id: "comments",
      label: "Comments",
      badge: comments.length,
      content: (
        <CommentsPane
          comments={comments}
          onAdd={handleAddComment}
          loading={postingComment || loadingComments}
          disabled={!activeSection?.id}
          sectionLabel={activeSection?.title || "Section"}
        />
      )
    },
    {
      id: "versions",
      label: "Versions",
      badge: versions.length,
      content: (
        <VersionPanel
          versions={versions}
          onSaveVersion={handleSaveVersion}
          onRestoreVersion={handleRestoreVersion}
          loading={savingVersion || restoringVersion || loadingVersions}
          disabled={!activeDoc}
        />
      )
    },
    {
      id: "collaborators",
      label: "Collaborators",
      badge: activeDoc?.collaborators?.length || 0,
      content: (
        <section className="collaborators-tab">
          <h3>Collaborators</h3>
          <form className="share-form" onSubmit={handleShare}>
            <input
              value={collabEmail}
              onChange={(event) => setCollabEmail(event.target.value)}
              placeholder="Collaborator email"
              disabled={!activeDoc || sharingDocument || unsharingDocument}
            />
            <select
              value={collabPermission}
              onChange={(event) => setCollabPermission(event.target.value)}
              disabled={!activeDoc || sharingDocument || unsharingDocument}
            >
              <option value="EDIT">EDIT</option>
              <option value="VIEW">VIEW</option>
            </select>
            <button
              type="submit"
              disabled={!activeDoc || sharingDocument || unsharingDocument}
            >
              {sharingDocument ? "Sharing..." : "Share"}
            </button>
          </form>

          <div className="collab-list">
            {(activeDoc?.collaborators || []).map((collaborator) => (
              <div key={collaborator.id} className="collab-item">
                <div>
                  <strong>{collaborator.name}</strong>
                  <small>{collaborator.email}</small>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnshare(collaborator.email)}
                  disabled={sharingDocument || unsharingDocument}
                >
                  Remove
                </button>
              </div>
            ))}
            {(activeDoc?.collaborators || []).length === 0 ? (
              <p className="empty">No collaborators yet.</p>
            ) : null}
          </div>
        </section>
      )
    }
  ];

  const treeDisabled =
    !activeDoc || loadingSections || creatingSection || deletingSection || reorderingSection;

  return (
    <main className="shell">
      <header className="workspace-topbar">
        <div className="workspace-brand">
          <p className="badge">SYNCNOTE</p>
          <h1>Workspace</h1>
        </div>
        <div className="hero-meta">
          <p>
            Signed in as <strong>{meData?.me?.name || "User"}</strong> ({meData?.me?.email || "..."})
          </p>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="workspace-frame">
        <aside className="workspace-side">
          <section className="panel filters-panel">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search title/sections (min 2 chars)"
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
          </section>

          <DocumentList
            myDocs={myDocs}
            sharedDocs={sharedDocs}
            totalMine={totalMine}
            totalShared={totalShared}
            showingSearch={searching}
            totalSearch={totalSearch}
            activeId={activeId}
            onSelect={handleSelectDocument}
            onCreate={handleCreate}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            canPrev={listOffset > 0}
            canNext={listOffset + PAGE_SIZE < activeTotal}
          />

          <section className="panel sections-panel">
            <SectionsTree
              sections={sections}
              selectedSectionId={selectedSectionId}
              onSelect={handleSelectSection}
              onAddRoot={() => handleCreateSection(null)}
              onAddChild={(parentId) => handleCreateSection(parentId)}
              onDelete={handleDeleteSection}
              onMove={handleMoveSection}
              disabled={treeDisabled}
              loading={Boolean(activeDoc) && loadingSections}
            />
          </section>
        </aside>

        <section className="workspace-main">
          {notice ? (
            <section className="panel notice-panel">
              <p>{notice}</p>
            </section>
          ) : null}

          <EditorPane
            document={activeDoc}
            section={activeSection}
            sectionContent={sectionDraft}
            onSectionChange={handleSectionInput}
            saveState={saveState}
            saving={savingTitle || loadingDoc || loadingSections}
            savingSection={savingSection}
            onSaveTitle={handleSaveTitle}
            onSaveSectionTitle={handleSaveSectionTitle}
            activeUsers={presenceUsers}
            currentUserId={meData?.me?.id || null}
            typingNotice={typingNotice}
            updatedByName={activeSection?.updatedBy?.name || lastSectionActor}
          />
        </section>

        <aside className="workspace-right">
          <TabsPanel tabs={tabs} defaultTabId="comments" />
        </aside>
      </section>
    </main>
  );
}

export default Workspace;
