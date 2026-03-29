"use client";

import { useEffect, useState } from "react";

export default function EditorPane({ document, onSave, saving }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    setTitle(document?.title || "");
    setContent(document?.content || "");
  }, [document?.id, document?.title, document?.content]);

  if (!document) {
    return (
      <section className="panel editor-panel empty-editor">
        <h2>Select a document</h2>
        <p>Choose a document from the left to begin collaborative editing.</p>
      </section>
    );
  }

  return (
    <section className="panel editor-panel">
      <div className="editor-header">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" disabled={saving} onClick={() => onSave(title, content)}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your notes here..."
      />
      <p className="editor-meta">Last update: {new Date(document.updatedAt).toLocaleString()}</p>
    </section>
  );
}
