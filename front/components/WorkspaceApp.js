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
import { createApolloClient } from "@/lib/apollo";
import {
  ADD_COMMENT,
  COMMENT_ADDED,
  CREATE_DOCUMENT,
  GET_DOCUMENT,
  GET_DOCUMENT_PRESENCE,
  GET_ME,
  GET_MY_DOCUMENTS,
  GET_SECTION_COMMENTS,
  GET_SECTIONS,
  GET_SHARED_DOCUMENTS,
  GET_VERSIONS,
  LEAVE_DOCUMENT,
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
const SECTION_TYPES = ["summary", "notes", "questions"];
const SECTION_LABELS = {
  summary: "Summary",
  notes: "Notes",
  questions: "Questions"
};

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
  const [activeSectionType, setActiveSectionType] = useState("summary");
  const [sectionDraft, setSectionDraft] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  const saveTimerRef = useRef(null);
  const activeSectionTypeRef = useRef(activeSectionType);
  const activeSectionIdRef = useRef(null);
  const localEditRef = useRef(false);

  useEffect(() => {
    activeSectionTypeRef.current = activeSectionType;
  }, [activeSectionType]);

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

  const { data: searchDocsData, refetch: refetchSearch } = useQuery(
    SEARCH_DOCUMENTS,
    {
      variables: {
        keyword: searchKeyword,
        ...listingVariables
      },
      skip: !token || !searching,
      fetchPolicy: "cache-and-network"
    }
  );

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

  const sections = sectionsData?.getSections || [];

  useEffect(() => {
    if (!activeId || sections.length === 0) {
      return;
    }

    if (!sections.some((section) => section.type === activeSectionType)) {
      setActiveSectionType(sections[0].type);
    }
  }, [activeId, sections, activeSectionType]);

  const activeSection =
    sections.find((section) => section.type === activeSectionType) || sections[0] || null;

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
  const [updateSection] = useMutation(UPDATE_SECTION);
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

    if (
      !localEditRef.current ||
      activeSectionIdRef.current !== activeSection.id
    ) {
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
            sectionType: activeSectionTypeRef.current
          }
        });

        if (mounted && result.data?.updatePresence) {
          setPresenceUsers(result.data.updatePresence);
        }
      } catch {
        // Best-effort heartbeat; UI still updates via subscriptions.
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
        sectionType: activeSectionType
      }
    })
      .then((result) => {
        if (result.data?.updatePresence) {
          setPresenceUsers(result.data.updatePresence);
        }
      })
      .catch(() => {});
  }, [token, activeId, activeSectionType, updatePresence]);

  useSubscription(SECTION_UPDATED, {
    skip: !token || !activeId,
    variables: { documentId: activeId },
    onData: ({ data }) => {
      const updatedSection = data.data?.sectionUpdated;
      if (!updatedSection) {
        return;
      }

      if (
        updatedSection.id === activeSectionIdRef.current &&
        !localEditRef.current
      ) {
        setSectionDraft(updatedSection.content || "");
        setSaveState("saved");
        setNotice(
          `Updated by collaborator in ${SECTION_LABELS[updatedSection.type] || updatedSection.type}`
        );
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
      const sectionLabel = SECTION_LABELS[one.sectionType] || one.sectionType;
      return `${one.user?.name || "Someone"} is typing in ${sectionLabel}...`;
    }

    return `${others[0].user?.name || "Someone"} and ${others.length - 1} more are typing...`;
  }, [typingUsers]);

  function handleLogout() {
    onLogout();
    setActiveId(null);
    setSearchInput("");
    setSearchKeyword("");
    setListOffset(0);
    setActiveSectionType("summary");
    setSectionDraft("");
    setPresenceUsers([]);
    setTypingUsers({});
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

    const result = await createDocument({
      variables: { title: title.trim(), content: "" }
    });

    const id = result.data?.createDocument?.id;
    await refreshDocumentCollections();

    if (id) {
      setActiveId(id);
      setActiveSectionType("summary");
      setNotice("Document created with Summary, Notes, and Questions sections");
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
        sectionType: activeSection.type,
        isTyping: true
      }
    }).catch(() => {});

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    const sectionId = activeSection.id;
    const documentId = activeId;
    const sectionType = activeSection.type;

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        setSaveState("saving");

        await updateSection({
          variables: {
            sectionId,
            content: nextValue
          }
        });

        await saveVersion({ variables: { documentId } });

        localEditRef.current = false;
        setSaveState("saved");

        await Promise.all([refetchSections(), refetchDoc(), refetchVersions()]);
        await refreshDocumentCollections();
      } catch (error) {
        setSaveState("error");
        setNotice(error.message);
      } finally {
        updateTypingStatus({
          variables: {
            documentId,
            sectionType,
            isTyping: false
          }
        }).catch(() => {});
      }
    }, 1200);
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

  async function handleShare(userEmail, permission) {
    if (!activeId) {
      return;
    }

    try {
      await shareDocument({
        variables: {
          documentId: activeId,
          userEmail,
          permission
        }
      });

      await Promise.all([refetchDoc(), refetchShared(), refetchMine()]);
      setNotice(`Shared with ${userEmail} as ${permission}`);
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
    setActiveId(documentId);
    setActiveSectionType("summary");
    setPresenceUsers([]);
    setTypingUsers({});
    localEditRef.current = false;
  }

  const liveUsers = presenceUsers.filter((entry) => {
    return String(entry.userId) !== String(meData?.me?.id || "");
  });

  return (
    <main className="shell">
      <header className="hero workspace-hero">
        <div>
          <p className="badge">SYNCNOTE / WORKSPACE</p>
          <h1>Compose, sync, and collaborate without friction.</h1>
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
          <section className="panel side-card">
            <h2>Workspace Overview</h2>
            <p className="list-meta">Manage structured collaboration in real time.</p>
            <div className="side-stats">
              <span>My docs: {totalMine}</span>
              <span>Shared: {totalShared}</span>
              <span>{searching ? `Search: ${totalSearch}` : "Sections + history enabled"}</span>
              <span>Active users: {liveUsers.length}</span>
            </div>
          </section>

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

          <section className="panel section-panel">
            <h2>Sections</h2>
            <div className="section-switcher">
              {SECTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={
                    activeSectionType === type ? "section-chip active" : "section-chip"
                  }
                  disabled={!activeDoc}
                  onClick={() => setActiveSectionType(type)}
                >
                  {SECTION_LABELS[type]}
                </button>
              ))}
            </div>
            <p className="list-meta">
              {activeSection
                ? `Editing ${SECTION_LABELS[activeSection.type] || activeSection.type}`
                : "Pick a document to start editing sections."}
            </p>
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
        </aside>

        <section className="workspace-main">
          {notice ? (
            <section className="panel notice-panel">
              <p>{notice}</p>
            </section>
          ) : null}

          <EditorPane
            document={activeDoc}
            sectionType={activeSection?.type || activeSectionType}
            sectionContent={sectionDraft}
            onSectionChange={handleSectionInput}
            saveState={saveState}
            saving={savingTitle || loadingDoc || loadingSections}
            onSaveTitle={handleSaveTitle}
            onShare={handleShare}
            onUnshare={handleUnshare}
            sharing={sharingDocument || unsharingDocument}
            versions={versions}
            onSaveVersion={handleSaveVersion}
            onRestoreVersion={handleRestoreVersion}
            versionLoading={savingVersion || restoringVersion || loadingVersions}
            activeUsers={presenceUsers}
            currentUserId={meData?.me?.id || null}
            typingNotice={typingNotice}
            sectionLabel={SECTION_LABELS[activeSection?.type] || "Section"}
          />
        </section>

        <aside className="workspace-right">
          <CommentsPane
            comments={comments}
            onAdd={handleAddComment}
            loading={postingComment || loadingComments}
            disabled={!activeSection?.id}
            sectionLabel={SECTION_LABELS[activeSection?.type] || "Section"}
          />
        </aside>
      </section>
    </main>
  );
}

export default Workspace;
