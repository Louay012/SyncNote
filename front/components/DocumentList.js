"use client";

function formatTime(dateString) {
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function Group({ title, docs, activeId, onSelect }) {
  return (
    <div className="doc-group">
      <h3>{title}</h3>
      {docs.length === 0 ? <p className="empty">No documents</p> : null}
      {docs.map((doc) => (
        <button
          key={doc.id}
          type="button"
          className={activeId === doc.id ? "doc-item active" : "doc-item"}
          onClick={() => onSelect(doc.id)}
        >
          <strong>{doc.title}</strong>
          <span>{formatTime(doc.updatedAt)}</span>
          <small>Owner: {doc.owner.name}</small>
        </button>
      ))}
    </div>
  );
}

export default function DocumentList({
  myDocs,
  sharedDocs,
  activeId,
  onSelect,
  onCreate
}) {
  return (
    <aside className="panel list-panel">
      <div className="list-header">
        <h2>Documents</h2>
        <button type="button" onClick={onCreate}>
          New
        </button>
      </div>
      <Group
        title="My Documents"
        docs={myDocs}
        activeId={activeId}
        onSelect={onSelect}
      />
      <Group
        title="Shared With Me"
        docs={sharedDocs}
        activeId={activeId}
        onSelect={onSelect}
      />
    </aside>
  );
}
