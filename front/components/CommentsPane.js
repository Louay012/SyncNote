"use client";

import { useState } from "react";

function fmt(dateString) {
  return new Date(dateString).toLocaleString();
}

export default function CommentsPane({
  comments,
  onAdd,
  loading,
  disabled,
  sectionLabel
}) {
  const [text, setText] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!text.trim() || disabled) {
      return;
    }
    await onAdd(text.trim());
    setText("");
  }

  return (
    <section className="panel comments-panel">
      <h2>{sectionLabel ? `${sectionLabel} comments` : "Comments"}</h2>
      <div className="comment-list">
        {comments.length === 0 ? <p className="empty">No comments yet.</p> : null}
        {comments.map((comment) => (
          <article key={comment.id} className="comment-item">
            <div>
              <strong>{comment.author.name}</strong>
              <span>{fmt(comment.createdAt)}</span>
            </div>
            <p>{comment.content || comment.text}</p>
          </article>
        ))}
      </div>
      <form onSubmit={submit}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={disabled ? "Select a section first" : "Add a comment to this section"}
          disabled={disabled || loading}
        />
        <button type="submit" disabled={disabled || loading}>
          {loading ? "Posting..." : "Post"}
        </button>
      </form>
    </section>
  );
}
