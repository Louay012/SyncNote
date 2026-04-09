"use client";

function formatTime(dateString) {
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function Group({
  title,
  docs,
  activeId,
  onSelect,
  onOpenCollaborators,
  showShareActions,
  canShareDoc
}) {
  return (
    <div className="doc-group">
      <h3>
        {title}
        <span className="group-count">{docs.length}</span>
      </h3>
      {docs.length === 0 ? <p className="empty">No documents</p> : null}
      {docs.map((doc) => (
        <div
          key={doc.id}
          className={activeId === doc.id ? "doc-item active" : "doc-item"}
        >
          <button
            type="button"
            className="doc-main-btn"
            onClick={() => onSelect(doc.id)}
          >
            <strong>{doc.title}</strong>
            <span>{formatTime(doc.updatedAt)}</span>
            <small>Owner: {doc.owner.name}</small>
            <small>{doc.isPublic ? "Visibility: Public" : "Visibility: Private"}</small>
          </button>
          {showShareActions && (canShareDoc ? canShareDoc(doc) : true) ? (
            <button
              type="button"
              className="doc-collab-btn"
              onClick={() => onOpenCollaborators(doc.id)}
              aria-label={`Manage collaborators for ${doc.title}`}
              title="Manage collaborators"
            >
              Share
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function DocumentList({
  myDocs,
  sharedDocs,
  showingSearch,
  totalSearch,
  scope = "all",
  activeId,
  onSelect,
  onOpenCollaborators,
  showShareActions = true,
  showShareActionsOnShared = false,
  canShareDoc,
  showCreateButton = true,
  onCreate
}) {
  return (
    <aside className="panel list-panel">
      <div className="list-header">
        <h2>Documents</h2>
        {showCreateButton ? (
          <button type="button" onClick={onCreate}>
            New
          </button>
        ) : null}
      </div>
      {showingSearch ? (
        <p className="list-meta">Search results: {totalSearch}</p>
      ) : null}
      {scope !== "shared" ? (
        <Group
          title="My Documents"
          docs={myDocs}
          activeId={activeId}
          onSelect={onSelect}
          onOpenCollaborators={onOpenCollaborators}
          showShareActions={showShareActions}
          canShareDoc={canShareDoc}
        />
      ) : null}
      {scope !== "my" ? (
        <Group
          title="Shared With Me"
          docs={sharedDocs}
          activeId={activeId}
          onSelect={onSelect}
          onOpenCollaborators={onOpenCollaborators}
          showShareActions={showShareActionsOnShared}
          canShareDoc={canShareDoc}
        />
      ) : null}
    </aside>
  );
}
