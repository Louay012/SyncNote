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
import AppShell from "@/components/AppShell";
import CommentsPane from "@/components/CommentsPane";
import EditorPane from "@/components/EditorPane";
import SectionsTree from "@/components/SectionsTree";
import TabsPanel from "@/components/TabsPanel";
import VersionPanel from "@/components/VersionPanel";
import { createApolloClient } from "@/lib/apollo";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken
} from "@/lib/authToken";
// legacy cursor socket removed; using Yjs awareness + CollaborationCursor
import { normalizeStoredRichDocString } from "@/lib/richTextDoc";
import {
  ADD_COMMENT,
  APPLY_SECTION_OPERATION,
  COMMENT_ADDED,
  CREATE_SECTION,
  DELETE_SECTION,
  GET_DOCUMENT,
  GET_DOCUMENT_PRESENCE,
  GET_ME,
  GET_SECTION_COMMENTS,
  GET_SECTIONS,
  GET_VERSIONS,
  LEAVE_DOCUMENT,
  REORDER_SECTION,
  RESTORE_VERSION,
  SAVE_VERSION,
  UPDATE_SECTION_CONTENT,
  SECTION_UPDATED,
  SEND_COLLABORATION_INVITE,
  UNSHARE_DOCUMENT,
  UPDATE_DOCUMENT,
  UPDATE_PRESENCE,
  UPDATE_SECTION,
  UPDATE_TYPING_STATUS,
  USER_PRESENCE_CHANGED,
  USER_TYPING
} from "@/lib/graphql";
import { isEmail, toFriendlyError } from "@/lib/uiErrors";

const DOCUMENT_CURSOR_COLORS = [
  { bg: "#ff6b6b", fg: "#ffffff", border: "#b82525" },
  { bg: "#4dabf7", fg: "#ffffff", border: "#1f6aa8" },
  { bg: "#51cf66", fg: "#0f3d1d", border: "#2b8a3e" },
  { bg: "#fcc419", fg: "#4a3700", border: "#c99700" },
  { bg: "#9775fa", fg: "#ffffff", border: "#5f3dc4" },
  { bg: "#ff922b", fg: "#4a2700", border: "#d97706" },
  { bg: "#22b8cf", fg: "#07353c", border: "#0c8599" },
  { bg: "#f06595", fg: "#57132a", border: "#c2255c" }
];

const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 768;

function getEditorViewportMode() {
  if (typeof window === "undefined") {
    return "desktop";
  }

  if (window.innerWidth < MOBILE_BREAKPOINT) {
    return "mobile";
  }

  if (window.innerWidth <= TABLET_BREAKPOINT) {
    return "tablet";
  }

  return "desktop";
}

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

function withDocumentCursorColors(cursorsByUserId) {
  const entries = Object.entries(cursorsByUserId || {});
  const sortedUserIds = entries
    .map(([userId]) => String(userId))
    .sort((a, b) => a.localeCompare(b));

  const colorByUserId = new Map();
  sortedUserIds.forEach((userId, index) => {
    colorByUserId.set(
      userId,
      DOCUMENT_CURSOR_COLORS[index % DOCUMENT_CURSOR_COLORS.length]
    );
  });

  return Object.fromEntries(
    entries.map(([userId, cursor]) => [
      userId,
      {
        ...cursor,
        cursorColor: colorByUserId.get(String(userId))
      }
    ])
  );
}

function computeStringOperation(baseContent, nextContent) {
  const base = String(baseContent ?? "");
  const next = String(nextContent ?? "");

  if (base === next) {
    return null;
  }

  let start = 0;
  while (
    start < base.length &&
    start < next.length &&
    base[start] === next[start]
  ) {
    start += 1;
  }

  let endBase = base.length - 1;
  let endNext = next.length - 1;
  while (
    endBase >= start &&
    endNext >= start &&
    base[endBase] === next[endNext]
  ) {
    endBase -= 1;
    endNext -= 1;
  }

  const removed = endBase >= start ? base.slice(start, endBase + 1) : "";
  const inserted = endNext >= start ? next.slice(start, endNext + 1) : "";

  if (removed.length > 0 && inserted.length > 0) {
    return {
      type: "REPLACE",
      position: start,
      deleteCount: removed.length,
      text: inserted
    };
  }

  if (inserted.length > 0) {
    return {
      type: "INSERT",
      position: start,
      deleteCount: 0,
      text: inserted
    };
  }

  return {
    type: "DELETE",
    position: start,
    deleteCount: removed.length,
    text: ""
  };
}

function EditorContent({ token, activeId, onSessionLogout, shellVariant }) {
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null);
  const [modalError, setModalError] = useState("");
  const [pageError, setPageError] = useState("");

  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionDraft, setSectionDraft] = useState("");
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");
  const [docTitleDraft, setDocTitleDraft] = useState("");
  const [saveState, setSaveState] = useState("idle");

  const [presenceUsers, setPresenceUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [remoteCursors, setRemoteCursors] = useState({});
  const [lastSectionActor, setLastSectionActor] = useState("");

  const [collabEmail, setCollabEmail] = useState("");
  const [collabPermission, setCollabPermission] = useState("EDIT");

  const [viewportMode, setViewportMode] = useState(() => getEditorViewportMode());
  const [isSectionsPanelOpen, setIsSectionsPanelOpen] = useState(() => {
    const mode = getEditorViewportMode();
    return mode === "desktop";
  });
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(() => {
    const mode = getEditorViewportMode();
    return mode === "desktop";
  });

  const isCompactViewport = viewportMode !== "desktop";
  const isMobileViewport = viewportMode === "mobile";

  const saveTimerRef = useRef(null);
  const lastSyncedSectionContentRef = useRef("");
  const selectedSectionIdRef = useRef(selectedSectionId);
  const activeSectionIdRef = useRef(null);
  const localEditRef = useRef(false);

  useEffect(() => {
    selectedSectionIdRef.current = selectedSectionId;
  }, [selectedSectionId]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function updateViewportMode() {
      setViewportMode(getEditorViewportMode());
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (viewportMode === "desktop") {
      setIsSectionsPanelOpen(true);
      setIsRightPanelOpen(true);
      return;
    }

    setIsSectionsPanelOpen(false);
    setIsRightPanelOpen(false);
  }, [viewportMode]);

  useEffect(() => {
    if (!isCompactViewport || (!isSectionsPanelOpen && !isRightPanelOpen)) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsSectionsPanelOpen(false);
        setIsRightPanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCompactViewport, isSectionsPanelOpen, isRightPanelOpen]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      // legacy cursor socket removed; only clear save timer
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

  const { data: meData } = useQuery(GET_ME, {
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: docData,
    loading: loadingDoc,
    error: docError,
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

  useEffect(() => {
    setSectionTitleDraft(activeSection?.title || "");
  }, [activeSection?.id, activeSection?.title]);

  const activeDoc = docData?.document || null;

  useEffect(() => {
    setDocTitleDraft(activeDoc?.title || "");
  }, [activeDoc?.id, activeDoc?.title]);

  const {
    data: commentsData,
    loading: loadingComments,
    refetch: refetchComments
  } = useQuery(GET_SECTION_COMMENTS, {
    variables: { sectionId: activeSection?.id },
    skip: !token || !activeSection?.id,
    fetchPolicy: "cache-and-network"
  });

  const [updateDocument, { loading: savingTitle }] = useMutation(UPDATE_DOCUMENT);
  const [createSection, { loading: creatingSection }] = useMutation(CREATE_SECTION);
  const [updateSection, { loading: savingSection }] = useMutation(UPDATE_SECTION);
  const [applySectionOperation] = useMutation(APPLY_SECTION_OPERATION);
  const [updateSectionContent] = useMutation(UPDATE_SECTION_CONTENT);
  const [deleteSection, { loading: deletingSection }] = useMutation(DELETE_SECTION);
  const [reorderSection, { loading: reorderingSection }] = useMutation(REORDER_SECTION);
  const [saveVersion, { loading: savingVersion }] = useMutation(SAVE_VERSION);
  const [restoreVersion, { loading: restoringVersion }] = useMutation(RESTORE_VERSION);
  const [addComment, { loading: postingComment }] = useMutation(ADD_COMMENT);
  const [sendInvite, { loading: sharingDocument }] = useMutation(SEND_COLLABORATION_INVITE);
  const [unshareDocument, { loading: unsharingDocument }] =
    useMutation(UNSHARE_DOCUMENT);
  const [updateTypingStatus] = useMutation(UPDATE_TYPING_STATUS);
  const [updatePresence] = useMutation(UPDATE_PRESENCE);
  const [leaveDocument] = useMutation(LEAVE_DOCUMENT);

  const comments = commentsData?.commentsBySection || [];
  const versions = versionsData?.getVersions || [];
  const coloredRemoteCursors = useMemo(() => {
    return withDocumentCursorColors(remoteCursors);
  }, [remoteCursors]);

  useEffect(() => {
    if (docError) {
      setPageError(toFriendlyError(docError));
    } else {
      setPageError("");
    }
  }, [docError]);

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
      const serverRaw = String(activeSection.content || "");
      const normalizedContent = normalizeStoredRichDocString(serverRaw);

      // Log server load vs cached draft to help debug accidental blanking
      try {
        // loading section content (debug removed)
      } catch (e) {}

      // If the server returned an empty content but we have a last-synced draft,
      // prefer keeping the last-synced draft to avoid accidental blanking on refresh.
      if (!serverRaw.trim() && lastSyncedSectionContentRef.current) {
        setSectionDraft(String(lastSyncedSectionContentRef.current));
      } else {
        setSectionDraft(normalizedContent);
        lastSyncedSectionContentRef.current = normalizedContent;
      }

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

    async function sendPresencePulse() {
      try {
        const result = await updatePresence({
          variables: {
            documentId: activeId,
            sectionId: selectedSectionIdRef.current
          }
        });

        if (mounted && result.data?.updatePresence) {
          setPresenceUsers(result.data.updatePresence);
        }
      } catch {
        // Presence heartbeat is best effort.
      }
    }

    sendPresencePulse();
    const interval = window.setInterval(sendPresencePulse, 15000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      leaveDocument({ variables: { documentId: activeId } }).catch(() => {});
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

      const isOwnUpdate =
        String(updatedSection.updatedBy?.id || "") === String(meData?.me?.id || "");

      if (updatedSection.updatedBy?.name) {
        setLastSectionActor(updatedSection.updatedBy.name);

        if (!isOwnUpdate) {
          setNotice(`Updated by ${updatedSection.updatedBy.name} in ${updatedSection.title}`);
        }
      }

      if (updatedSection.id === activeSectionIdRef.current && !localEditRef.current) {
        setSectionDraft(normalizeStoredRichDocString(updatedSection.content || ""));
        setSaveState("saved");
      }

      if (!isOwnUpdate) {
        refetchSections();
        refetchDoc();
        refetchVersions();
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

  // legacy cursor socket effect removed; rely on Yjs awareness + CollaborationCursor

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

  const cursorUsersBySection = useMemo(() => {
    const grouped = {};
    Object.values(coloredRemoteCursors).forEach((entry) => {
      if (!entry.sectionId) {
        return;
      }

      const key = String(entry.sectionId);
      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(entry);
    });

    return grouped;
  }, [coloredRemoteCursors]);

  function clearPendingSave() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }


  function closeModal() {
    setModal(null);
    setModalError("");
  }

  function handleLogout() {
    onSessionLogout();
    setSelectedSectionId(null);
    setSectionDraft("");
    setSaveState("idle");
    setPresenceUsers([]);
    setTypingUsers({});
    setRemoteCursors({});
    setLastSectionActor("");
    setCollabEmail("");
    closeModal();
    clearPendingSave();
    // legacy cursor socket removed
    clearStoredToken();
    apolloClient.clearStore();
    router.replace("/auth");
  }

  async function refreshEditorData() {
    await Promise.all([refetchDoc(), refetchSections(), refetchVersions()]);
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

      await refreshEditorData();
      setNotice("Changes saved");
    } catch (error) {
      setNotice(toFriendlyError(error));
    }
  }

  async function handleUpdateVisibility(isPublic) {
    if (!activeId) {
      return;
    }

    setModalError("");
    try {
      await updateDocument({
        variables: {
          id: activeId,
          isPublic: Boolean(isPublic)
        }
      });

      await refetchDoc();
      setNotice(isPublic ? "Document is now public" : "Document is now private");
    } catch (error) {
      setModalError(toFriendlyError(error));
    }
  }

  async function handleSaveSectionTitle(nextTitle) {
    if (!activeSection) {
      return;
    }

    const normalized = String((nextTitle ?? sectionTitleDraft) || "").trim();
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
      await refreshEditorData();
      setNotice("Changes saved");
    } catch (error) {
      setNotice(toFriendlyError(error));
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
        const baseContent = String(lastSyncedSectionContentRef.current || "");
                // Send full-document JSON save via updateSectionContent (preferred)
                let result;
                try {
                  const contentDoc = JSON.parse(nextValue || "{}");
                  result = await updateSectionContent({ variables: { sectionId, contentDoc } });
                } catch (err) {
                  // updateSectionContent failed (debug removed)
                  // Fallback: attempt applySectionOperation then updateSection as before
                  const baseContent = String(lastSyncedSectionContentRef.current || "");
                  const operation = computeStringOperation(baseContent, nextValue);
                  if (operation) {
                    try {
                      result = await applySectionOperation({ variables: { sectionId, baseContent, operation } });
                    } catch (err2) {
                      // applySectionOperation failed (debug removed)
                      result = await updateSection({ variables: { sectionId, content: nextValue } });
                    }
                  } else {
                    localEditRef.current = false;
                    setSaveState("saved");
                    return;
                  }
                }

                lastSyncedSectionContentRef.current = String(
                  (result?.data?.updateSectionContent?.content) || (result?.data?.applySectionOperation?.content) || (result?.data?.updateSection?.content) || nextValue
                );
                setLastSectionActor(
                  result?.data?.updateSectionContent?.updatedBy?.name ||
                    result?.data?.applySectionOperation?.updatedBy?.name ||
                    result?.data?.updateSection?.updatedBy?.name ||
                    meData?.me?.name ||
                    ""
                );
                localEditRef.current = false;
                setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        setNotice(toFriendlyError(error));
      } finally {
        updateTypingStatus({
          variables: {
            documentId,
            sectionId,
            isTyping: false
          }
        }).catch(() => {});
      }
    }, 300);
  }

  // Legacy cursor socket handlers removed. Use Yjs awareness + CollaborationCursor instead.

  async function handleCreateSection(parentId = null) {
    if (!activeId) {
      return;
    }

    setModalError("");
    setModal({
      type: "create-section",
      parentId,
      title: "",
      heading: parentId ? "Create Subsection" : "Create Section"
    });
  }

  async function submitCreateSection() {
    if (!activeId) {
      return;
    }

    const title = String(modal?.title || "").trim();
    if (!title) {
      setModalError("Section title is required");
      return;
    }

    setModalError("");
    try {
      const result = await createSection({
        variables: {
          documentId: activeId,
          title,
          parentId: modal?.parentId ?? null
        }
      });

      const created = result.data?.createSection;
      await refreshEditorData();

      if (created?.id) {
        setSelectedSectionId(created.id);
      }

      closeModal();
      setNotice((modal?.parentId ?? null) ? "Subsection created" : "Section created");
    } catch (error) {
      setModalError(toFriendlyError(error));
    }
  }

  async function handleDeleteSection(sectionId) {
    const target = sections.find((section) => String(section.id) === String(sectionId));
    if (!target) {
      return;
    }

    setModalError("");
    setModal({ type: "delete-section", sectionId: target.id, sectionTitle: target.title });
  }

  async function submitDeleteSection() {
    const targetId = modal?.sectionId;
    const target = sections.find((section) => String(section.id) === String(targetId));
    if (!target) {
      closeModal();
      return;
    }

    setModalError("");
    try {
      clearPendingSave();
      await deleteSection({ variables: { sectionId: target.id } });

      if (String(selectedSectionId || "") === String(target.id)) {
        setSelectedSectionId(null);
        setSectionDraft("");
      }

      localEditRef.current = false;
      await Promise.all([refetchSections(), refetchDoc(), refetchVersions(), refetchComments()]);
      closeModal();
      setNotice("Section removed");
    } catch (error) {
      setModalError(toFriendlyError(error));
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
      setNotice("Changes saved");
    } catch (error) {
      setNotice(toFriendlyError(error));
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
      setNotice(toFriendlyError(error));
    }
  }

  async function handleSaveVersion() {
    if (!activeId) {
      return;
    }

    try {
      await saveVersion({ variables: { documentId: activeId } });
      await refetchVersions();
      setNotice("Changes saved");
    } catch (error) {
      setNotice(toFriendlyError(error));
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

      await Promise.all([refetchDoc(), refetchSections(), refetchComments(), refetchVersions()]);
      setNotice("Version restored");
    } catch (error) {
      setNotice(toFriendlyError(error));
    }
  }

  async function handleShare(event) {
    event.preventDefault();

    if (!activeId || !collabEmail.trim()) {
      setModalError("Collaborator email is required");
      return;
    }

    if (!isEmail(collabEmail)) {
      setModalError("Please enter a valid invite email.");
      return;
    }

    setModalError("");
    try {
      await sendInvite({
        variables: {
          documentId: activeId,
          userEmail: collabEmail.trim(),
          permission: collabPermission
        }
      });

      await refetchDoc();
      setNotice(`Invitation sent to ${collabEmail.trim()} as ${collabPermission}`);
      setCollabEmail("");
    } catch (error) {
      setModalError(toFriendlyError(error));
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

      await refetchDoc();
      setNotice(`Removed access for ${userEmail}`);
    } catch (error) {
      setNotice(toFriendlyError(error));
    }
  }

  function openShareModal() {
    setModalError("");
    setCollabEmail("");
    setModal({ type: "share-document" });
  }

  function handleSelectSection(sectionId) {
    clearPendingSave();
    setSelectedSectionId(sectionId);
    setSaveState("idle");
    localEditRef.current = false;

    if (viewportMode !== "desktop") {
      setIsSectionsPanelOpen(false);
    }
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
    }
  ];

  const treeDisabled =
    !activeDoc || loadingSections || creatingSection || deletingSection || reorderingSection;

  const workspaceClassName = [
    "workspace-frame",
    "editor-only-frame",
    isCompactViewport ? "workspace-compact" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const sectionsDrawerClassName = [
    "workspace-side",
    isCompactViewport ? "workspace-drawer sections-drawer" : "",
    isCompactViewport && isSectionsPanelOpen ? "open" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const rightDrawerClassName = [
    "workspace-right",
    isCompactViewport ? "workspace-drawer right-drawer" : "",
    isCompactViewport && isRightPanelOpen ? "open" : ""
  ]
    .filter(Boolean)
    .join(" ");

  function toggleSectionsPanel() {
    setIsSectionsPanelOpen((current) => {
      const next = !current;
      if (next) {
        setIsRightPanelOpen(false);
      }
      return next;
    });
  }

  function toggleRightPanel() {
    setIsRightPanelOpen((current) => {
      const next = !current;
      if (next) {
        setIsSectionsPanelOpen(false);
      }
      return next;
    });
  }

  function closeWorkspacePanels() {
    setIsSectionsPanelOpen(false);
    setIsRightPanelOpen(false);
  }

  return (
    <AppShell
      title="Editor"
      subtitle={`Signed in as ${meData?.me?.name || "User"}${
        meData?.me?.email ? ` (${meData.me.email})` : ""
      }`}
      variant={shellVariant}
      onLogout={handleLogout}
    >
      {({ toggleSidebar }) => (
        <>
          {pageError ? (
            <section className="panel notice-panel error-notice">
              <p>{pageError}</p>
              <button type="button" onClick={() => refetchDoc()}>
                Retry
              </button>
            </section>
          ) : null}

          {notice ? (
            <section className="panel notice-panel">
              <p>{notice}</p>
            </section>
          ) : null}

          {!loadingDoc && !activeDoc ? (
            <section className="panel notice-panel error-notice">
              <p>Document not found or inaccessible.</p>
              <button type="button" onClick={() => router.push("/")}>
                Back to dashboard
              </button>
            </section>
          ) : null}

          {activeDoc ? (
            <section className={workspaceClassName}>
              {isCompactViewport ? (
                <>
                  <section className="workspace-mobile-toolbar">
                    <button type="button" onClick={toggleSidebar}>
                      Menu
                    </button>
                    <button type="button" onClick={toggleSectionsPanel}>
                      {isSectionsPanelOpen ? "Close Sections" : "Sections"}
                    </button>
                    <button type="button" onClick={toggleRightPanel}>
                      {isRightPanelOpen
                        ? "Close Panel"
                        : isMobileViewport
                        ? "Comments"
                        : "Comments / Versions"}
                    </button>
                  </section>

                  {isSectionsPanelOpen || isRightPanelOpen ? (
                    <button
                      type="button"
                      className="workspace-panel-backdrop"
                      aria-label="Close panels"
                      onClick={closeWorkspacePanels}
                    />
                  ) : null}
                </>
              ) : null}

              <aside className={sectionsDrawerClassName}>
                <section className="panel sections-panel">
                  {isCompactViewport ? (
                    <div className="workspace-drawer-header">
                      <h3>Sections</h3>
                      <button type="button" onClick={closeWorkspacePanels}>
                        Close
                      </button>
                    </div>
                  ) : null}

                  <SectionsTree
                    sections={sections}
                    selectedSectionId={selectedSectionId}
                    cursorUsersBySection={cursorUsersBySection}
                    activeSection={activeSection}
                    sectionTitleDraft={sectionTitleDraft}
                    onSectionTitleDraftChange={setSectionTitleDraft}
                    onSaveSectionTitle={handleSaveSectionTitle}
                    savingSection={savingSection}
                    docTitleDraft={docTitleDraft}
                    onDocTitleDraftChange={setDocTitleDraft}
                    onSaveDocTitle={handleSaveTitle}
                    savingDoc={savingTitle}
                    activeDoc={activeDoc}
                    onSelect={handleSelectSection}
                    onAddRoot={() => handleCreateSection(null)}
                    onAddChild={(parentId) => handleCreateSection(parentId)}
                    onDelete={handleDeleteSection}
                    onMove={handleMoveSection}
                    disabled={treeDisabled}
                    loading={Boolean(activeDoc) && loadingSections}
                    onOpenShareModal={openShareModal}
                  />
                </section>
              </aside>

              <section className="workspace-main">
                <EditorPane
                  document={activeDoc}
                  section={activeSection}
                  sectionContent={sectionDraft}
                  onSectionChange={handleSectionInput}
                  saveState={saveState}
                  saving={savingTitle || loadingDoc || loadingSections}
                  onSaveTitle={handleSaveTitle}
                  activeUsers={presenceUsers}
                  currentUserId={meData?.me?.id || null}
                  cursorUsers={Object.values(coloredRemoteCursors)}
                  typingNotice={typingNotice}
                  updatedByName={activeSection?.updatedBy?.name || lastSectionActor}
                  onOpenShareModal={openShareModal}
                  collaboratorCount={(activeDoc?.collaborators || []).length}
                    onRealtimeAutosaveStateChange={setSaveState}
                />
              </section>

              <aside className={rightDrawerClassName}>
                <TabsPanel
                  tabs={tabs}
                  defaultTabId="comments"
                  onRequestClose={isCompactViewport ? closeWorkspacePanels : null}
                />
              </aside>
            </section>
          ) : null}

          {modal ? (
            <section className="modal-backdrop" role="presentation">
              <article className="panel modal-card" role="dialog" aria-modal="true">
                {modalError ? <p className="modal-error">{modalError}</p> : null}


                {modal.type === "share-document" || modal.type === "settings" ? (
                  <>
                    <h3>Settings</h3>
                    <div className="doc-visibility-control">
                      <label htmlFor="doc-visibility-select">Document visibility</label>
                      <select
                        id="doc-visibility-select"
                        value={activeDoc?.isPublic ? "PUBLIC" : "PRIVATE"}
                        onChange={(event) => handleUpdateVisibility(event.target.value === "PUBLIC")}
                        disabled={!activeDoc || savingTitle || sharingDocument || unsharingDocument || String(activeDoc?.owner?.id) !== String(meData?.me?.id)}
                      >
                        <option value="PRIVATE">Private</option>
                        <option value="PUBLIC">Public</option>
                      </select>
                      <p className="list-meta">
                        Private documents are hidden from Discover search.
                      </p>
                    </div>
                    <form className="share-form" onSubmit={handleShare} style={{ marginTop: 24 }}>
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
                        {sharingDocument ? "Saving..." : "Save"}
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
                    <div className="modal-actions">
                      <button type="button" onClick={closeModal}>
                        Close
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.type === "create-section" ? (
                  <>
                    <h3>{modal.heading}</h3>
                    <p className="list-meta">Create a new section in this document tree.</p>
                    <input
                      autoFocus
                      value={modal.title}
                      onChange={(event) =>
                        setModal((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Section title"
                    />
                    <div className="modal-actions">
                      <button type="button" onClick={closeModal}>
                        Cancel
                      </button>
                      <button type="button" onClick={submitCreateSection}>
                        Create
                      </button>
                    </div>
                  </>
                ) : null}

                {/* Remove duplicate share modal, only show settings modal */}

                {modal.type === "delete-section" ? (
                  <>
                    <h3>Delete Section</h3>
                    <p>
                      Delete <strong>{modal.sectionTitle}</strong>? This action cannot be undone.
                    </p>
                    <div className="modal-actions">
                      <button type="button" onClick={closeModal}>
                        Cancel
                      </button>
                      <button type="button" className="danger-btn" onClick={submitDeleteSection}>
                        Delete
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

export default function WorkspaceApp({
  initialDocumentId = null,
  shellVariant = "default"
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState(
    initialDocumentId !== null && initialDocumentId !== undefined
      ? String(initialDocumentId)
      : null
  );

  const client = useMemo(() => createApolloClient(token), [token]);

  useEffect(() => {
    const saved = getStoredToken();
    setToken(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (initialDocumentId !== null && initialDocumentId !== undefined) {
      setActiveId(String(initialDocumentId));
    }
  }, [initialDocumentId]);

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
          <p>Preparing editor...</p>
        </section>
      </main>
    );
  }

  if (!activeId) {
    return (
      <main className="auth-shell">
        <section className="panel notice-panel error-notice">
          <p>Missing document id.</p>
          <button type="button" onClick={() => router.push("/")}>
            Back to dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <ApolloProvider client={client}>
      <EditorContent
        token={token}
        activeId={activeId}
        onSessionLogout={() => setToken("")}
        shellVariant={shellVariant}
      />
    </ApolloProvider>
  );
}
