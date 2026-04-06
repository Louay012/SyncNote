"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "syncnote-theme";
const THEME_OPTIONS = [
  { value: "light", label: "Light", swatches: ["#f3f1ea", "#05668d", "#e46f3b"] },
  { value: "dark", label: "Dark", swatches: ["#1f2734", "#cbbca5", "#d98863"] },
  { value: "harbor", label: "Harbor", swatches: ["#d7dcde", "#b7c0c8", "#253747", "#f49a52"] },
  { value: "harbor-night", label: "Harbor Night", swatches: ["#17232e", "#223647", "#2f4658", "#f49a52"] },
  { value: "citrus-ink", label: "Citrus Ink", swatches: ["#dddada", "#efac5a", "#5f7cc6", "#2f2e31"] },
  { value: "citrus-ink-night", label: "Citrus Ink Night", swatches: ["#232227", "#2f2e31", "#415182", "#efac5a"] },
  { value: "rose-pop", label: "Rose Pop", swatches: ["#d8d4cf", "#e781ab", "#df3c8f", "#54405f"] },
  { value: "rose-pop-night", label: "Rose Pop Night", swatches: ["#2b2230", "#54405f", "#a63a70", "#df7fb2"] },
  { value: "mint-noir", label: "Mint Noir", swatches: ["#000000", "#b1e0c0", "#90beb0", "#dbdbdb"] },
  { value: "mint-noir-night", label: "Mint Noir Night", swatches: ["#0d1512", "#1f352f", "#2f6758", "#98ccb8"] },
  { value: "terracotta-tide", label: "Terracotta Tide", swatches: ["#ec946a", "#325267", "#c4c4c4", "#d1d1d1"] },
  { value: "terracotta-tide-night", label: "Terracotta Tide Night", swatches: ["#22282d", "#325267", "#a16b50", "#ec946a"] },
  { value: "indigo-sand", label: "Indigo Sand", swatches: ["#131842", "#e68369", "#d8bc9d", "#ece9d8"] },
  { value: "indigo-sand-night", label: "Indigo Sand Night", swatches: ["#131842", "#1e2559", "#8b6b5a", "#d8bc9d"] }
];

function isSupportedTheme(theme) {
  return THEME_OPTIONS.some((option) => option.value === theme);
}

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
}

function getPreferredTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem(THEME_KEY);
  if (isSupportedTheme(saved)) {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle({ showControl = true, inline = false }) {
  const [theme, setTheme] = useState("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const preferred = getPreferredTheme();
    setTheme(preferred);
    applyTheme(preferred);
    setReady(true);
  }, []);

  function setActiveTheme(nextTheme) {
    if (!isSupportedTheme(nextTheme)) {
      return;
    }

    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }

  if (!showControl) {
    return null;
  }

  return (
    <div className={inline ? "theme-toggle inline" : "theme-toggle"}>
      <label className="theme-toggle-label" htmlFor="syncnote-theme-select">
        Theme preset
      </label>
      <select
        id="syncnote-theme-select"
        className="theme-toggle-select"
        value={theme}
        onChange={(event) => setActiveTheme(event.target.value)}
        disabled={!ready}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="theme-preset-strip" role="group" aria-label="Theme presets">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={theme === option.value ? "theme-preset active" : "theme-preset"}
            onClick={() => setActiveTheme(option.value)}
            title={option.label}
            aria-label={`Use ${option.label} theme`}
            disabled={!ready}
          >
            {option.swatches.map((color) => (
              <span
                key={`${option.value}-${color}`}
                className="theme-preset-dot"
                style={{ backgroundColor: color }}
              />
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
