"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken
} from "@/lib/authToken";

export default function useAuthSession({ redirectTo = "/auth" } = {}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = getStoredToken();
    setToken(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!token) {
      router.replace(redirectTo);
      return;
    }

    setStoredToken(token);
  }, [hydrated, token, redirectTo, router]);

  function logout() {
    setToken("");
    clearStoredToken();
    router.replace(redirectTo);
  }

  return useMemo(
    () => ({
      token,
      setToken,
      hydrated,
      isAuthenticated: Boolean(token),
      logout
    }),
    [token, hydrated]
  );
}
