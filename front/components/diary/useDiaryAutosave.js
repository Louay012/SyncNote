"use client";

import { useEffect, useRef, useState } from "react";

export default function useDiaryAutosave(saveFn, delay = 1200) {
  const timerRef = useRef(null);
  const fadeRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | typing | saved

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(fadeRef.current);
    };
  }, []);

  function scheduleSave(payload) {
    setStatus("typing");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await saveFn(payload);
        setStatus("saved");
        if (fadeRef.current) clearTimeout(fadeRef.current);
        fadeRef.current = setTimeout(() => setStatus("idle"), 2500);
      } catch (e) {
        console.warn("autosave failed", e);
        setStatus("idle");
      }
    }, delay);
  }

  return { status, scheduleSave };
}
