"use client";

import { useState } from "react";

export default function AuthPanel({
  onLogin,
  onRegister,
  loading,
  initialMode = "login",
  lockMode = false
}) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        return;
      }
      await onRegister({
        name: name.trim(),
        email: email.trim(),
        password
      });
      return;
    }

    await onLogin({
      email: email.trim(),
      password
    });
  }

  return (
    <section className="panel auth-panel">
      <p className="list-meta">Use your account to access collaborative documents in real time.</p>
      {lockMode ? null : (
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={mode === "login" ? "active" : ""}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={mode === "register" ? "active" : ""}
          >
            Register
          </button>
        </div>
      )}

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            disabled={loading}
          />
        ) : null}

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          disabled={loading}
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          minLength={8}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          disabled={loading}
        />

        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "register"
            ? "Create account"
            : "Sign in"}
        </button>
      </form>
    </section>
  );
}
