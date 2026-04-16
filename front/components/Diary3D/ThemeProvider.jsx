"use client"

import React, { createContext, useContext, useMemo, useState } from "react"
import styles from "./diary.module.css"

const ThemeContext = createContext(null)

const themePresets = {
  classic: {
    "--diary-bg": "linear-gradient(180deg, #f8f5ef 0%, #efe6d6 100%)",
    "--page-bg": "#fffdf6",
    "--page-back-bg": "#f7efe3",
    "--text-color": "#2b2b20",
    "--shadow-color": "rgba(0,0,0,0.18)",
    "--accent": "#b9733a",
  },
  dark: {
    "--diary-bg": "linear-gradient(180deg, #0b0c0f 0%, #141518 100%)",
    "--page-bg": "#121217",
    "--page-back-bg": "#0f1012",
    "--text-color": "#e6eef8",
    "--shadow-color": "rgba(0,0,0,0.6)",
    "--accent": "#60a5fa",
  },
  vintage: {
    "--diary-bg": "linear-gradient(180deg, #efe3d4 0%, #e6d8c2 100%)",
    "--page-bg": "linear-gradient(180deg, #fbf5eb 0%, #f3e7cf 100%)",
    "--page-back-bg": "#f1e2c9",
    "--text-color": "#3b2f24",
    "--shadow-color": "rgba(40,20,10,0.25)",
    "--accent": "#a66f2a",
  },
  pastel: {
    "--diary-bg": "linear-gradient(135deg, #fff7fb 0%, #f0fbff 100%)",
    "--page-bg": "linear-gradient(180deg, #ffffffcc 0%, #fff4ffcc 100%)",
    "--page-back-bg": "#fff9fe",
    "--text-color": "#2b2b3a",
    "--shadow-color": "rgba(27,24,38,0.08)",
    "--accent": "#ffb7c5",
  },
}

export function useDiaryTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children, initial = "classic" }) {
  const [theme, setTheme] = useState(initial)
  const value = useMemo(() => ({ theme, setTheme, themes: Object.keys(themePresets) }), [theme])
  const cssVars = themePresets[theme] || themePresets.classic

  return (
    <ThemeContext.Provider value={value}>
      <div id="diary-root" className={styles.diaryRoot} style={cssVars}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
