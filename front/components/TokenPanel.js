"use client";

export default function TokenPanel({ token, onChange }) {
  return (
    <section className="panel token-panel">
      <div>
        <h2>Access Token</h2>
        <p>Sign in below or paste a JWT manually to override the current session token.</p>
      </div>
      <input
        value={token}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Bearer token (without Bearer prefix)"
      />
    </section>
  );
}
