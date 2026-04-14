"use client";
import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { getStoredToken, setStoredToken, clearStoredToken, AUTH_TOKEN_KEY } from "@/lib/authToken";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(undefined); // undefined => loading, null => not authed (or cookie auth), string => token
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    const saved = getStoredToken();
    if (saved) {
      if (mounted) setTokenState(String(saved));
    } else {
      // No token in localStorage — probe server `me` endpoint to detect httpOnly cookie auth
      (async () => {
        try {
          const res = await fetch(`/graphql`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ query: "query { me { id name email } }" })
          });
          const json = await res.json();
          if (mounted && json?.data?.me) {
            setUser(json.data.me || null);
            // mark as loaded; token remains `null` but we consider user authenticated via cookie
            setTokenState(null);
            return;
          }
        } catch (e) {
          // ignore
        }

        if (mounted) setTokenState(null);
      })();
    }

    function onStorage(e) {
      if (e.key !== AUTH_TOKEN_KEY && e.key !== AUTH_TOKEN_KEY.replace("-", "_")) return;
      const next = e.newValue ? String(e.newValue) : null;
      setTokenState(next);
      if (!next) setUser(null);
    }

    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function setToken(next) {
    const safe = next ? String(next) : null;
    setTokenState(safe);
    if (safe) setStoredToken(safe);
    else clearStoredToken();
  }

  function logout() {
    setTokenState(null);
    setUser(null);
    clearStoredToken();
    // Optionally inform server to clear cookie — caller may call API
  }

  const wsTokenCacheRef = useRef({ token: null, expiresAt: 0 });

  async function getWsToken({ force = false } = {}) {
    if (!force) {
      const cached = wsTokenCacheRef.current;
      if (cached.token && cached.expiresAt > Date.now() + 5000) return cached.token;
    }

    try {
      const res = await fetch("/ws-token", { credentials: "include" });
      if (!res.ok) return null;
      const json = await res.json();
      const token = json?.token || null;
      if (token) {
        const ttl = 4.5 * 60 * 1000; // cache slightly less than 5 minutes
        wsTokenCacheRef.current = { token, expiresAt: Date.now() + ttl };
      }
      return token;
    } catch (e) {
      return null;
    }
  }

  const isAuthenticated = Boolean(user) || (token && token !== null && token !== undefined && String(token).trim() !== "");

  const value = useMemo(
    () => ({ token, setToken, logout, loading: token === undefined, isAuthenticated, user, getWsToken }),
    [token, isAuthenticated, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export default AuthContext;
