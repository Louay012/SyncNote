"use client";

export default function TokenPanel({ token, onChange }) {
  return (
    <section className="panel token-panel">
      <div>
        <h2>Access Token</h2>
        <p>Paste JWT from backend register/login mutation. Auth screens can be added later.</p>
      </div>
      <input
        value={token}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Bearer token (without Bearer prefix)"
      />
    </section>
  );
}
