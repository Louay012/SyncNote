"use client";

import { useEffect, useMemo, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";

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
  savingSection,
  onSaveTitle,
  onSaveSectionTitle,
  activeUsers,
  currentUserId,
  cursorUsers,
  onCursorActivity,
  typingNotice,
  updatedByName,
  onOpenShareModal,
  collaboratorCount = 0
}) {
  const [title, setTitle] = useState("");
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");

  useEffect(() => {
    setTitle(document?.title || "");
  }, [document?.id, document?.title]);

  useEffect(() => {
    setSectionTitleDraft(section?.title || "");
  }, [section?.id, section?.title]);

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

  const sectionLabel = section?.parentId ? "Subsection" : "Section";

  return (
    <section className="panel editor-panel">
      <div className="editor-header">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Document title"
        />
        <div className="editor-title-actions">
          <button type="button" disabled={saving} onClick={() => onSaveTitle(title)}>
            {saving ? "Saving..." : "Save title"}
          </button>
          <button
            type="button"
            className="share-trigger"
            onClick={onOpenShareModal}
            disabled={!document}
          >
            Share ({collaboratorCount})
          </button>
        </div>
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

      <p className="editor-meta editing-section-meta">
        {section
          ? `Editing ${sectionLabel.toLowerCase()}: ${section.title}`
          : "Select a section to start writing"}
      </p>

      <div className="editor-textarea-wrap">
        <RichTextEditor
          value={sectionContent}
          disabled={!section}
          onChange={onSectionChange}
          onCursorOffsetChange={handleRichCursorOffset}
          remoteCursors={sectionCursorUsers}
        />
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
                {entry.user?.name || "User"} at P{entry.from || 1}
              </span>
            );
          })}
        </div>
        {typingNotice ? <p className="typing-indicator">{typingNotice}</p> : null}
      </section>
    </section>
  );
}
