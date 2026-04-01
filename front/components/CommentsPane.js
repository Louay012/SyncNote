"use client";

import { useState } from "react";

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function getFirstNameInitial(name) {
  const firstName = String(name || "").trim().split(/\s+/)[0] || "U";
  return firstName.slice(0, 1).toUpperCase();
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
            <div className="comment-row">
              <span className="comment-avatar">
                {getFirstNameInitial(comment.author?.name)}
              </span>
              <div className="comment-content">
                <div className="comment-meta-line">
                  <strong>{comment.author?.name || "User"}</strong>
                  <span>{formatDate(comment.createdAt)}</span>
                </div>
                <p className="comment-body">{comment.content || comment.text}</p>
              </div>
            </div>
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
