"use client";

import { useState } from "react";

function formatDate(dateString) {
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
    <section className="comments-tab-panel">
      <h3>{sectionLabel ? `${sectionLabel} discussion` : "Discussion"}</h3>

      <div className="comment-list">
        {comments.length === 0 ? <p className="empty">No comments yet.</p> : null}
        {comments.map((comment) => (
          <article key={comment.id} className="comment-item">
            <div className="comment-head">
              <span className="comment-avatar">
                {(comment.author?.name || "U").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{comment.author?.name || "User"}</strong>
                <span>{formatDate(comment.createdAt)}</span>
              </div>
            </div>
            <p>{comment.content || comment.text}</p>
          </article>
        ))}
      </div>

      <form className="comments-form" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={disabled ? "Select a section first" : "Add a comment to this section"}
          disabled={disabled || loading}
          rows={3}
        />
        <button type="submit" disabled={disabled || loading}>
          {loading ? "Posting..." : "Post"}
        </button>
      </form>
    </section>
  );
}
