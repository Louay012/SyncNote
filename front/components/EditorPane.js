
"use client";

const FONT_OPTIONS = [
  { label: "Curved Script", value: "var(--font-curved-script)" },
  { label: "Uncial", value: "var(--font-uncial)" },
  { label: "Plume", value: "var(--font-plume)" },
  { label: "Cinzel Decorative", value: "var(--font-cinzel-decorative)" },
  { label: "Fraktur", value: "var(--font-fraktur)" },
  { label: "Serif", value: "serif" }
];

const FONT_SIZE_OPTIONS = [
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "22px", value: "22px" },
  { label: "24px", value: "24px" }
];

import { useEffect, useMemo, useState } from "react";
import RealtimeEditor from "@/components/RealtimeEditor";
import { useAuth } from "@/context/AuthContext";
import { getCursorColor } from "@/lib/cursorColors";

const EDITOR_STYLE_KEY = "syncnote-editor-style";
const STORY_PAPER_KEY = "syncnote-story-paper";
const DEFAULT_STORY_PAPER_ID = "classic-scroll";

const STORY_PAPER_OPTIONS = [
  {
    id: "classic-scroll",
    label: "Classic Scroll",
    topUrl: "/images/top_scroll.png",
    middleUrl: "/images/middle.png",
    bottomUrl: "/images/bottom_scroll.png"
  }
];

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

export default function EditorPane({
  document,
  section,
  sectionContent,
  onSectionChange,
  saveState,
  saving,
  onSaveTitle,
  activeUsers,
  currentUserId,
  cursorUsers,
  onCursorActivity,
  typingNotice,
  updatedByName,
  onOpenShareModal,
  collaboratorCount = 0,
  onRealtimeAutosaveStateChange
}) {
  const [title, setTitle] = useState("");
  const [editorStyle, setEditorStyle] = useState("classic");
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState("20px");
  const [storyPaperId, setStoryPaperId] = useState(DEFAULT_STORY_PAPER_ID);

  const { token, getWsToken, user: authUser } = useAuth();

  // derive an effective user object for the realtime editor (fallback to activeUsers)
  const effectiveEditorUser = useMemo(() => {
    const id = authUser?.id || currentUserId;
    let name = authUser?.name ?? null;
    if (!name && id && Array.isArray(activeUsers)) {
      const match = (activeUsers || []).find((e) => String(e.userId) === String(id));
      if (match?.user?.name) name = match.user.name;
    }
    return { id, name };
  }, [authUser?.id, authUser?.name, currentUserId, activeUsers]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(EDITOR_STYLE_KEY);
    if (saved === "classic" || saved === "story") {
      setEditorStyle(saved);
    }

    const savedPaper = window.localStorage.getItem(STORY_PAPER_KEY);
    if (savedPaper && STORY_PAPER_OPTIONS.some((option) => option.id === savedPaper)) {
      setStoryPaperId(savedPaper);
    }
  }, []);

  useEffect(() => {
    setTitle(document?.title || "");
  }, [document?.id, document?.title]);

  const saveLabel = useMemo(() => {
    if (saveState === "saving") {
      return "Autosave: Saving...";
    }
    if (saveState === "saved") {
      return "Autosave: Saved";
    }
    if (saveState === "error") {
      return "Autosave: Failed";
    }
    if (saveState === "pending") {
      return "Autosave: Pending";
    }
    return "Autosave: Ready";
  }, [saveState]);

  const liveUsers = useMemo(() => {
    return (activeUsers || []).filter((entry) => {
      return String(entry.userId) !== String(currentUserId || "");
    });
  }, [activeUsers, currentUserId]);

  const liveCursorUsers = useMemo(() => {
    return (cursorUsers || []).filter((entry) => {
      if (currentUserId) {
        return String(entry.userId || "") !== String(currentUserId);
      }

      return true;
    });
  }, [cursorUsers, currentUserId]);

  const sectionCursorUsers = useMemo(() => {
    if (!section?.id) {
      return [];
    }

    return liveCursorUsers.filter((entry) => {
      return String(entry.sectionId || "") === String(section.id);
    });
  }, [liveCursorUsers, section?.id]);

  function handleRichCursorOffset(cursorPosition) {
    if (!section || !onCursorActivity) {
      return;
    }

    // Forward precise ProseMirror selection positions (anchor/head) when available.
    const anchor = cursorPosition?.anchor;
    const head = cursorPosition?.head;
    if (anchor != null || head != null) {
      onCursorActivity({
        anchor: Number(anchor || 0),
        head: Number(head || 0),
        from: Math.max(Number(cursorPosition?.from) || 1, 1),
        to: Math.max(Number(cursorPosition?.to) || 1, 1)
      });
      return;
    }

    onCursorActivity({
      from: Math.max(Number(cursorPosition?.from) || 1, 1),
      to: Math.max(Number(cursorPosition?.to) || 1, 1)
    });
  }

  if (!document) {
    return (
      <section className="panel editor-panel empty-editor">
        <h2>Select a document</h2>
        <p>Choose a document from the left to begin collaborative section editing.</p>
      </section>
    );
  }

  const storyMode = editorStyle === "story";
  const activeStoryPaper = useMemo(() => {
    return STORY_PAPER_OPTIONS.find((option) => option.id === storyPaperId) || STORY_PAPER_OPTIONS[0];
  }, [storyPaperId]);
  const storyStyleVars = useMemo(() => {
    return {
      "--story-scroll-top": `url("${activeStoryPaper.topUrl}")`,
      "--story-scroll-middle": `url("${activeStoryPaper.middleUrl}")`,
    };
  }, [activeStoryPaper]);

  function setEditorStyleValue(nextStyle) {
    setEditorStyle(nextStyle);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(EDITOR_STYLE_KEY, nextStyle);
    }
  }

  function handleSetEditorStyle(nextStyle) {
    if (nextStyle === editorStyle) {
      setEditorStyleValue("classic");
      return;
    }

    setEditorStyleValue(nextStyle);
  }

  function handleStoryPaperChange(nextPaperId) {
    if (!STORY_PAPER_OPTIONS.some((option) => option.id === nextPaperId)) {
      return;
    }

    setStoryPaperId(nextPaperId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORY_PAPER_KEY, nextPaperId);
    }
  }

  const isOwner = document && currentUserId && String(document.owner?.id) === String(currentUserId);

  return (
    <section
      className={
        storyMode ? "panel editor-panel editor-story" : "panel editor-panel"
      }
      style={{ ...storyStyleVars, '--font-family': fontFamily }}
    >
      <div className="editor-toolbar">
        <p className="status-pill">{saveLabel}</p>
        {/* Only show the settings button if owner, relabel as 'Settings', and use share modal logic */}
        
      </div>

      <div className="editor-textarea-wrap">
        {storyMode ? <span className="editor-story-seal">SN</span> : null}
        {storyMode ? <span className="editor-story-template" aria-hidden="true" /> : null}
        {/* Use Yjs-based realtime editor when document is present to avoid GraphQL hot-path saves */}
        {document ? (
          <RealtimeEditor
              documentId={String(document.id)}
              wsUrl={(() => {
                if (typeof window === 'undefined') return '';
                const isSecure = window.location.protocol === 'https:';
                const proto = isSecure ? 'wss:' : 'ws:';
                const host = window.location.hostname || 'localhost';
                // default backend port for realtime y-websocket is 4000
                return `${proto}//${host}:4000/yjs`;
              })()}
              authToken={token}
              getWsToken={getWsToken}
              user={effectiveEditorUser}
              onAutosaveStateChange={onRealtimeAutosaveStateChange}
              onCursorActivity={handleRichCursorOffset}
            />
        ) : (
          <textarea
            className="rt-editor-content"
            value={sectionContent || ''}
            disabled={!section}
            onChange={(e) => onSectionChange?.(e.target.value)}
            aria-label="Section editor"
          />
        )}
      </div>

      <section className="presence-panel">
        <h3>Live activity</h3>
        <div className="presence-avatars">
          {liveUsers.length === 0 ? <p className="empty">No active collaborators right now.</p> : null}
            {liveUsers.map((entry) => {
              const palette = entry.user?.color ? { bg: entry.user.color, fg: entry.user.colorFg || '#ffffff', border: entry.user.colorBorder || entry.user.color } : getCursorColor(entry.userId);
              return (
                <span
                  key={entry.userId}
                  className="presence-avatar"
                  title={`${entry.user?.name || "User"} in ${entry.sectionTitle || "a section"}`}
                  style={{ background: palette.bg, color: palette.fg, borderColor: palette.border }}
                >
                  {(entry.user?.name || "U").slice(0, 1).toUpperCase()}
                </span>
              );
            })}
        </div>
        <div className="presence-list">
            {liveUsers.map((entry) => {
              const palette = entry.user?.color ? { bg: entry.user.color, fg: entry.user.colorFg || '#ffffff', border: entry.user.colorBorder || entry.user.color } : getCursorColor(entry.userId);
              return (
                <span key={`detail-${entry.userId}`} className="presence-chip" style={{ borderColor: palette.border }}>
                  <span className="presence-chip__dot" style={{ background: palette.bg, borderColor: palette.border }} />
                  <span className="presence-chip__text" style={{ color: palette.fg, marginLeft: 8 }}>{entry.user?.name || "User"}</span>
                  <span style={{ marginLeft: 8, opacity: 0.85 }}>in {entry.sectionTitle || "a section"}</span>
                </span>
              );
            })}
        </div>
        {typingNotice ? <p className="typing-indicator">{typingNotice}</p> : null}
      </section>
    </section>
  );
}
