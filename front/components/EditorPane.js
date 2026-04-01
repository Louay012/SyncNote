"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function getCursorPosition(value, offset) {
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const textBefore = String(value || "").slice(0, safeOffset);
  const lines = textBefore.split("\n");

  return {
    line: lines.length,
    column: (lines[lines.length - 1] || "").length + 1,
    offset: safeOffset
  };
}

export default function EditorPane({
  document,
  section,
  sectionContent,
  onSectionChange,
  saveState,
  saving,
  savingSection,
  onSaveTitle,
  onSaveSectionTitle,
  activeUsers,
  currentUserId,
  currentCursorId,
  cursorUsers,
  onCursorActivity,
  typingNotice,
  updatedByName
}) {
  const [title, setTitle] = useState("");
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");
  const [scrollOffset, setScrollOffset] = useState({ top: 0, left: 0 });
  const textareaRef = useRef(null);

  useEffect(() => {
    setTitle(document?.title || "");
  }, [document?.id, document?.title]);

  useEffect(() => {
    setSectionTitleDraft(section?.title || "");
  }, [section?.id, section?.title]);

  const saveLabel = useMemo(() => {
    if (saveState === "saving") {
      return "Saving...";
    }
    if (saveState === "saved") {
      return "Saved";
    }
    if (saveState === "error") {
      return "Save failed";
    }
    if (saveState === "pending") {
      return "Waiting to save...";
    }
    return "Idle";
  }, [saveState]);

  const liveUsers = useMemo(() => {
    return (activeUsers || []).filter((entry) => {
      return String(entry.userId) !== String(currentUserId || "");
    });
  }, [activeUsers, currentUserId]);

  const liveCursorUsers = useMemo(() => {
    return (cursorUsers || []).filter((entry) => {
      if (currentCursorId) {
        return String(entry.cursorId || "") !== String(currentCursorId);
      }

      return true;
    });
  }, [cursorUsers, currentCursorId]);

  const liveCursorsInSection = useMemo(() => {
    const currentSectionId = String(section?.id || "");
    if (!currentSectionId) {
      return [];
    }

    return liveCursorUsers.filter((entry) => {
      return String(entry.sectionId || "") === currentSectionId;
    });
  }, [liveCursorUsers, section?.id]);

  function syncScrollOffset(event) {
    const target = event?.currentTarget;
    if (!target) {
      return;
    }

    setScrollOffset({
      top: target.scrollTop || 0,
      left: target.scrollLeft || 0
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

  const sectionLabel = section?.parentId ? "Subsection" : "Section";

  return (
    <section className="panel editor-panel">
      <div className="editor-header">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Document title"
        />
        <button type="button" disabled={saving} onClick={() => onSaveTitle(title)}>
          {saving ? "Saving..." : "Save title"}
        </button>
      </div>

      <div className="editor-toolbar">
        <p className="status-pill">{saveLabel}</p>
        <div className="editor-stats">
          <p className="editor-meta">Owner: {document.owner?.name || "Unknown"}</p>
          <p className="editor-meta">Last update: {formatDate(document.updatedAt)}</p>
          <p className="editor-meta">
            Updated by: {updatedByName || document.owner?.name || "Unknown"}
          </p>
        </div>
      </div>

      <div className="section-title-row">
        <input
          value={sectionTitleDraft}
          onChange={(event) => setSectionTitleDraft(event.target.value)}
          placeholder="Section title"
          disabled={!section}
        />
        <button
          type="button"
          disabled={!section || savingSection}
          onClick={() => onSaveSectionTitle(sectionTitleDraft)}
        >
          {savingSection ? "Saving..." : `Save ${sectionLabel.toLowerCase()} title`}
        </button>
      </div>

      <p className="editor-meta">
        {section
          ? `Editing ${sectionLabel.toLowerCase()}: ${section.title}`
          : "Select a section to start writing"}
      </p>

      <div className="editor-textarea-wrap">
        <textarea
          ref={textareaRef}
          value={sectionContent}
          onChange={(event) => onSectionChange(event.target.value)}
          onScroll={syncScrollOffset}
          onKeyUp={(event) => {
            syncScrollOffset(event);
            if (!section || !onCursorActivity) {
              return;
            }
            onCursorActivity(
              getCursorPosition(event.currentTarget.value, event.currentTarget.selectionStart)
            );
          }}
          onClick={(event) => {
            syncScrollOffset(event);
            if (!section || !onCursorActivity) {
              return;
            }
            onCursorActivity(
              getCursorPosition(event.currentTarget.value, event.currentTarget.selectionStart)
            );
          }}
          onSelect={(event) => {
            syncScrollOffset(event);
            if (!section || !onCursorActivity) {
              return;
            }
            onCursorActivity(
              getCursorPosition(event.currentTarget.value, event.currentTarget.selectionStart)
            );
          }}
          placeholder={
            section
              ? `Write content for ${section.title.toLowerCase()}...`
              : "Pick a section from the left sidebar"
          }
          disabled={!section}
        />

        {liveCursorsInSection.map((entry) => {
          const color = entry.cursorColor;
          const top = 12 + (Number(entry.line || 1) - 1) * 22 - scrollOffset.top;
          const left = 12 + (Number(entry.column || 1) - 1) * 9 - scrollOffset.left;

          return (
            <div
              key={`ghost-${entry.cursorId || entry.userId}`}
              className="ghost-cursor"
              style={{
                top: `${Math.max(top, 8)}px`,
                left: `${Math.max(left, 8)}px`,
                borderLeftColor: color?.border || "#1f6aa8"
              }}
            >
              <span
                className="ghost-cursor-label"
                style={{
                  backgroundColor: color?.bg || "#4dabf7",
                  color: color?.fg || "#ffffff"
                }}
              >
                {entry.user?.name || "User"}
              </span>
            </div>
          );
        })}
      </div>

      <section className="presence-panel">
        <h3>Live activity</h3>
        <div className="presence-avatars">
          {liveUsers.length === 0 ? <p className="empty">No active collaborators right now.</p> : null}
          {liveUsers.map((entry) => (
            <span
              key={entry.userId}
              className="presence-avatar"
              title={`${entry.user?.name || "User"} in ${entry.sectionTitle || "a section"}`}
            >
              {(entry.user?.name || "U").slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <div className="presence-list">
          {liveUsers.map((entry) => (
            <span key={`detail-${entry.userId}`} className="presence-chip">
              {entry.user?.name || "User"} in {entry.sectionTitle || "a section"}
            </span>
          ))}
        </div>
        <div className="presence-list">
          {liveCursorUsers.map((entry) => {
            const color = entry.cursorColor;

            return (
              <span
                key={`cursor-${entry.cursorId || entry.userId}`}
                className="presence-chip cursor-chip"
                style={{
                  backgroundColor: color ? `${color.bg}22` : undefined,
                  color: color?.border,
                  borderColor: color?.border
                }}
              >
                {entry.user?.name || "User"} at L{entry.line}:C{entry.column}
              </span>
            );
          })}
        </div>
        {typingNotice ? <p className="typing-indicator">{typingNotice}</p> : null}
      </section>
    </section>
  );
}
