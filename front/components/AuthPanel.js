"use client";

import { useState } from "react";
import { isEmail } from "@/lib/uiErrors";

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
  const [errors, setErrors] = useState({});

  function setField(field, value, setter) {
    setter(value);
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (mode === "register" && !name.trim()) {
      nextErrors.name = "Name is required.";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!isEmail(email)) {
      nextErrors.email = "Please enter a valid email format.";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    if (mode === "register") {
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
          <>
            <input
              value={name}
              onChange={(event) => setField("name", event.target.value, setName)}
              placeholder="Full name"
              disabled={loading}
            />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}
          </>
        ) : null}

        <>
          <input
            type="email"
            value={email}
            onChange={(event) => setField("email", event.target.value, setEmail)}
            placeholder="Email"
            disabled={loading}
          />
          {errors.email ? <p className="field-error">{errors.email}</p> : null}
        </>

        <>
          <input
            type="password"
            value={password}
            onChange={(event) => setField("password", event.target.value, setPassword)}
            placeholder="Password"
            minLength={8}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            disabled={loading}
          />
          {errors.password ? <p className="field-error">{errors.password}</p> : null}
        </>

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
