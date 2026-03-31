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
      <h3>
        {title}
        <span className="group-count">{docs.length}</span>
      </h3>
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
  totalMine,
  totalShared,
  showingSearch,
  totalSearch,
  activeId,
  onSelect,
  onCreate,
  onPrevPage,
  onNextPage,
  canPrev,
  canNext
}) {
  return (
    <aside className="panel list-panel">
      <div className="list-header">
        <h2>Documents</h2>
        <button type="button" onClick={onCreate}>
          New
        </button>
      </div>
      {showingSearch ? (
        <p className="list-meta">Search results: {totalSearch}</p>
      ) : (
        <p className="list-meta">Mine: {totalMine} | Shared: {totalShared}</p>
      )}
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
      <div className="list-pagination">
        <button type="button" onClick={onPrevPage} disabled={!canPrev}>
          Prev
        </button>
        <button type="button" onClick={onNextPage} disabled={!canNext}>
          Next
        </button>
      </div>
    </aside>
  );
}
