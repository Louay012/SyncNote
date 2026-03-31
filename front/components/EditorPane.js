"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

export default function EditorPane({
  document,
  sectionType,
  sectionLabel,
  sectionContent,
  onSectionChange,
  saveState,
  saving,
  onSaveTitle,
  onShare,
  onUnshare,
  sharing,
  versions,
  onSaveVersion,
  onRestoreVersion,
  versionLoading,
  activeUsers,
  currentUserId,
  typingNotice
}) {
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("EDIT");
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    setTitle(document?.title || "");
  }, [document?.id, document?.title]);

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

  if (!document) {
    return (
      <section className="panel editor-panel empty-editor">
        <h2>Select a document</h2>
        <p>Choose a document from the left to begin collaborative section editing.</p>
      </section>
    );
  }

  return (
    <section className="panel editor-panel">
      <div className="editor-header">
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
        <button type="button" disabled={saving} onClick={() => onSaveTitle(title)}>
          {saving ? "Saving..." : "Save title"}
        </button>
      </div>

      <div className="editor-toolbar">
        <p className="status-pill">{saveLabel}</p>
        <div className="toolbar-actions">
          <button type="button" onClick={onSaveVersion} disabled={versionLoading}>
            {versionLoading ? "Saving version..." : "Save version"}
          </button>
          <button
            type="button"
            onClick={() => setShowVersions((current) => !current)}
            className={showVersions ? "active" : ""}
          >
            Version history ({versions.length})
          </button>
        </div>
      </div>

      <div className="section-heading">
        <h3>{sectionLabel}</h3>
        <p className="editor-meta">Editing section type: {sectionType}</p>
      </div>

      <textarea
        value={sectionContent}
        onChange={(event) => onSectionChange(event.target.value)}
        placeholder={`Write ${sectionLabel.toLowerCase()} here...`}
      />

      <p className="editor-meta">Last update: {formatDate(document.updatedAt)}</p>
      <p className="editor-meta">Owner: {document.owner?.name || "Unknown"}</p>

      <section className="presence-panel">
        <h3>Active collaborators</h3>
        <div className="presence-list">
          {liveUsers.length === 0 ? <p className="empty">No active collaborators right now.</p> : null}
          {liveUsers.map((entry) => (
            <span key={entry.userId} className="presence-chip">
              {entry.user?.name || "User"} in {entry.sectionType}
            </span>
          ))}
        </div>
        {typingNotice ? <p className="typing-indicator">{typingNotice}</p> : null}
      </section>

      {showVersions ? (
        <section className="version-panel">
          <h3>Version history</h3>
          <div className="version-list">
            {versions.length === 0 ? <p className="empty">No versions yet.</p> : null}
            {versions.map((version) => (
              <article key={version.id} className="version-item">
                <div>
                  <strong>{formatDate(version.createdAt)}</strong>
                  <small>By {version.createdBy?.name || "Unknown"}</small>
                </div>
                <button
                  type="button"
                  onClick={() => onRestoreVersion(version.id)}
                  disabled={versionLoading}
                >
                  Restore
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="share-panel">
        <h3>Collaborators</h3>
        <form
          className="share-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!email.trim()) {
              return;
            }
            await onShare(email.trim(), permission);
            setEmail("");
          }}
        >
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Collaborator email"
            disabled={sharing}
          />
          <select
            value={permission}
            onChange={(event) => setPermission(event.target.value)}
            disabled={sharing}
          >
            <option value="EDIT">EDIT</option>
            <option value="VIEW">VIEW</option>
          </select>
          <button type="submit" disabled={sharing}>
            {sharing ? "Sharing..." : "Share"}
          </button>
        </form>
        <div className="collab-list">
          {(document.collaborators || []).map((collaborator) => (
            <div key={collaborator.id} className="collab-item">
              <span>{collaborator.name}</span>
              <small>{collaborator.email}</small>
              <button
                type="button"
                onClick={() => onUnshare(collaborator.email)}
                disabled={sharing}
              >
                Remove
              </button>
            </div>
          ))}
          {(document.collaborators || []).length === 0 ? (
            <p className="empty">No collaborators yet.</p>
          ) : null}
        </div>
      </section>
    </section>
  );
}
