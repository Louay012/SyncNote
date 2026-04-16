"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, ApolloProvider } from "@apollo/client";
import RichTextEditor from "../RichTextEditor";
import useDiaryAutosave from "./useDiaryAutosave";
import { GET_SECTIONS, CREATE_SECTION, UPDATE_SECTION_CONTENT } from "@/lib/graphql";
import { createApolloClient } from "@/lib/apollo";

// ─── Inline animation / micro-interaction CSS ─────────────────────────────────
const ANIM_CSS = `
  @keyframes diaryFlipOut {
    0%   { transform: perspective(1100px) rotateX(0deg);   opacity: 1;   }
    100% { transform: perspective(1100px) rotateX(-94deg); opacity: 0.1; }
  }
  @keyframes diaryFlipIn {
    0%   { transform: perspective(1100px) rotateX(94deg);  opacity: 0.1; }
    100% { transform: perspective(1100px) rotateX(0deg);   opacity: 1;   }
  }
  @keyframes stampBounce {
    0%   { transform: scale(0.6) rotate(-8deg); opacity: 0; }
    60%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
    100% { transform: scale(1)    rotate(0deg); opacity: 1; }
  }
  @keyframes wiggle {
    0%, 100% { transform: rotate(-1deg); }
    50%       { transform: rotate(1deg);  }
  }
  @keyframes inkDrop {
    0%   { clip-path: inset(0 100% 0 0); opacity: 0; }
    100% { clip-path: inset(0 0%   0 0); opacity: 1; }
  }

  .diary-flip-out {
    animation: diaryFlipOut 0.38s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
    transform-origin: top center;
  }
  .diary-flip-in {
    animation: diaryFlipIn 0.38s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
    transform-origin: top center;
  }

  .diary-wrapper [contenteditable]:focus { outline: none; }
  .diary-wrapper [contenteditable]:hover { background: rgba(255,220,0,0.1); border-radius: 2px; }

  .diary-corner { transition: transform 0.2s ease; transform-origin: bottom right; }
  .diary-corner:hover { transform: scale(1.5) !important; }

  .diary-nav-btn {
    transition: transform 0.1s ease, box-shadow 0.1s ease !important;
  }
  .diary-nav-btn:hover:not(:disabled) {
    transform: translate(-1px, -1px) !important;
    box-shadow: 4px 4px 0px #1a1209 !important;
  }
  .diary-nav-btn:active:not(:disabled) {
    transform: translate(2px, 2px) !important;
    box-shadow: 1px 1px 0px #1a1209 !important;
  }

  .diary-add-btn { transition: all 0.13s ease !important; }
  .diary-add-btn:hover:not(:disabled) {
    transform: translate(-1px, -2px) !important;
    box-shadow: 4px 5px 0px #1a1209 !important;
  }
  .diary-add-btn:active:not(:disabled) {
    transform: translate(1px, 1px) !important;
    box-shadow: 1px 1px 0px #1a1209 !important;
  }

  .theme-pill { transition: transform 0.13s ease, box-shadow 0.13s ease; }
  .theme-pill:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0px #1a1209 !important; }
  .theme-pill.active { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px #1a1209 !important; }

  .diary-paper-inner { transition: background 0.4s ease, color 0.4s ease; }

  /* Stamp-in on page number */
  .page-num-stamp {
    animation: stampBounce 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  }

  /* Notebook frame wiggle on theme change */
  .notebook-wiggle {
    animation: wiggle 0.25s ease 2;
  }

  /* Ink-reveal on page load */
  .ink-reveal {
    animation: inkDrop 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  }
`;

const INITIAL_PAGES = [
  {
    date: "Monday, January 3rd",
    title: "Morning Fog",
    content:
      "Today I woke up early and watched the fog roll in over the hills. There's something deeply peaceful about those quiet morning hours before the world wakes up.\n\nThe coffee was perfect. I sat by the window for almost an hour without looking at my phone. The fog made everything look like a watercolor painting.",
  },
  {
    date: "Tuesday, January 4th",
    title: "New Beginnings",
    content:
      "Started working on a new project today. The blank page is always terrifying and exciting in equal measure. Where do you even begin?\n\nI made a list. Lists help. They give the illusion of control, which is sometimes all you need to get started on something real.",
  },
  {
    date: "Thursday, January 6th",
    title: "Rain Again",
    content:
      "It has been raining for three days straight now. I don't mind it. The sound on the roof is like a lullaby, and the grey light makes everything feel softer.\n\nMade soup from scratch. Read half a book. Went to bed at nine. A genuinely good day.",
  },
  {
    date: "Sunday, January 10th",
    title: "A Good Walk",
    content:
      "Walked to the market and back — it took an hour longer than planned because I kept stopping to look at things.\n\nThe vendor with the paperbacks. A cat asleep on a windowsill three floors up. A child who was very serious about her ice cream. A perfect Sunday.",
  },
  {
    date: "Monday, January 11th",
    title: "Late Night",
    content:
      "Can't sleep. The city sounds different at 3am — quieter but also more honest. Like it's finally saying what it really means.\n\nI should probably stop drinking coffee after noon. I won't, but I should.",
  },
];

// ─── Theme definitions ────────────────────────────────────────────────────────
// New retro/cartoon themes are at the top; legacy themes follow.
const THEMES = {
  // ── NEW RETRO / CARTOON THEMES ─────────────────────────────────────────────
  comic: {
    label: "Comic",
    icon: "💥",
    pageBg: "#fffef0",
    stack: ["#fff9d0", "#fff4b0", "#ffee90"],
    spiral: "linear-gradient(150deg, #e63946 0%, #c1121f 55%, #780000 100%)",
    binding: "linear-gradient(180deg, #e63946, #c1121f)",
    accent: "rgba(230,57,70,0.95)",
    accentSoft: "rgba(230,57,70,0.18)",
    linesColor: "rgba(70,130,200,0.14)",
    pageFont: "'Bangers', impact, sans-serif",
    bodyFont: "'Patrick Hand', cursive",
    coverBg: "linear-gradient(160deg, #e63946 0%, #ffd60a 60%, #fff200 100%)",
    coverTitleColor: "#1a1209",
    coverSubColor: "rgba(26,18,9,0.65)",
    background: "repeating-linear-gradient(45deg, #fff9d0 0px, #fff9d0 10px, #fffef0 10px, #fffef0 20px)",
    dateColor: "#e63946",
    titleColor: "#1a1209",
    pageNumColor: "rgba(230,57,70,0.55)",
    textColor: "#1a1209",
    marginLineColor: "rgba(230,57,70,0.3)",
    pillBg: "#e63946",
    pillActive: "rgba(230,57,70,0.15)",
    pillBorder: "#1a1209",
    pillText: "#fff",
    coverIcon: "💥",
    // Cartoon-specific extras
    borderColor: "#1a1209",
    shadowColor: "#1a1209",
    navBg: "#ffd60a",
    addBtnBg: "#e63946",
  },

  typewriter: {
    label: "Typewriter",
    icon: "⌨",
    pageBg: "#f5f0e8",
    stack: ["#ede6d6", "#e4dcca", "#dbd2be"],
    spiral: "linear-gradient(150deg, #3d3d3d 0%, #1a1a1a 55%, #000000 100%)",
    binding: "linear-gradient(180deg, #3d3d3d, #2a2a2a)",
    accent: "rgba(40,40,40,0.9)",
    accentSoft: "rgba(40,40,40,0.12)",
    linesColor: "rgba(40,40,40,0.1)",
    pageFont: "'Special Elite', 'Courier New', monospace",
    bodyFont: "'Special Elite', 'Courier New', monospace",
    coverBg: "linear-gradient(160deg, #1a1a1a 0%, #3d3d3d 50%, #6b6b6b 100%)",
    coverTitleColor: "#f5f0e8",
    coverSubColor: "rgba(245,240,232,0.65)",
    background: "repeating-linear-gradient(to bottom, #f5f0e8 0px, #f5f0e8 24px, #eee8d8 24px, #eee8d8 25px)",
    dateColor: "#5c4a2a",
    titleColor: "#1a1209",
    pageNumColor: "rgba(60,50,30,0.5)",
    textColor: "#1a1209",
    marginLineColor: "rgba(200,0,0,0.25)",
    pillBg: "#1a1a1a",
    pillActive: "rgba(40,40,40,0.12)",
    pillBorder: "#1a1209",
    pillText: "#f5f0e8",
    coverIcon: "⌨",
    borderColor: "#1a1209",
    shadowColor: "#1a1209",
    navBg: "#f5f0e8",
    addBtnBg: "#1a1a1a",
  },

  popart: {
    label: "Pop Art",
    icon: "★",
    pageBg: "#fff",
    stack: ["#ffe8f0", "#ffd0e4", "#ffb8d8"],
    spiral: "linear-gradient(150deg, #00b4d8 0%, #0077b6 55%, #03045e 100%)",
    binding: "linear-gradient(180deg, #00b4d8, #0077b6)",
    accent: "rgba(0,119,182,0.95)",
    accentSoft: "rgba(0,119,182,0.15)",
    linesColor: "rgba(255,20,100,0.12)",
    pageFont: "'Bangers', impact, sans-serif",
    bodyFont: "'Caveat', cursive",
    coverBg: "linear-gradient(135deg, #ff006e 0%, #fb5607 25%, #ffbe0b 50%, #8338ec 75%, #3a86ff 100%)",
    coverTitleColor: "#fff",
    coverSubColor: "rgba(255,255,255,0.75)",
    background: "radial-gradient(circle at 20% 50%, #fff0f8 0%, #fff 60%, #f0f8ff 100%)",
    dateColor: "#ff006e",
    titleColor: "#03045e",
    pageNumColor: "rgba(131,56,236,0.55)",
    textColor: "#1a1209",
    marginLineColor: "rgba(255,0,110,0.25)",
    pillBg: "linear-gradient(135deg, #ff006e, #8338ec)",
    pillActive: "rgba(255,0,110,0.12)",
    pillBorder: "#1a1209",
    pillText: "#fff",
    coverIcon: "★",
    borderColor: "#1a1209",
    shadowColor: "#1a1209",
    navBg: "#ffbe0b",
    addBtnBg: "#ff006e",
  },

  neon: {
    label: "Neon",
    icon: "◈",
    pageBg: "#0a0a12",
    stack: ["#080810", "#060609", "#040407"],
    spiral: "linear-gradient(150deg, #0ff 0%, #0af 55%, #00f 100%)",
    binding: "linear-gradient(180deg, #0ff, #0af)",
    accent: "rgba(0,255,200,0.95)",
    accentSoft: "rgba(0,255,200,0.12)",
    linesColor: "rgba(0,255,200,0.06)",
    pageFont: "'Special Elite', monospace",
    bodyFont: "'Courier New', monospace",
    coverBg: "linear-gradient(160deg, #000 0%, #0a0a20 50%, #100a20 100%)",
    coverTitleColor: "#0ff",
    coverSubColor: "rgba(0,255,255,0.5)",
    background: "radial-gradient(ellipse at 40% 30%, #0a0a25 0%, #050508 70%, #020204 100%)",
    dateColor: "#0ff",
    titleColor: "#f0f0ff",
    pageNumColor: "rgba(0,255,200,0.45)",
    textColor: "#c8fffe",
    marginLineColor: "rgba(0,255,200,0.2)",
    pillBg: "linear-gradient(135deg, #0ff, #00f)",
    pillActive: "rgba(0,255,200,0.12)",
    pillBorder: "#0ff",
    pillText: "#000",
    coverIcon: "◈",
    borderColor: "#0ff",
    shadowColor: "rgba(0,255,200,0.5)",
    navBg: "#0a0a20",
    addBtnBg: "transparent",
  },

  retro50s: {
    label: "Diner",
    icon: "☕",
    pageBg: "#fef9f0",
    stack: ["#fce8c8", "#f8ddb8", "#f4d2a8"],
    spiral: "linear-gradient(150deg, #ff4757 0%, #c0392b 55%, #922b21 100%)",
    binding: "linear-gradient(180deg, #ff6b81, #ff4757)",
    accent: "rgba(255,71,87,0.9)",
    accentSoft: "rgba(255,71,87,0.15)",
    linesColor: "rgba(0,120,200,0.1)",
    pageFont: "'Caveat', cursive",
    bodyFont: "'Caveat', cursive",
    coverBg: "repeating-conic-gradient(#ff4757 0% 25%, #fef9f0 0% 50%) 0 0 / 40px 40px",
    coverTitleColor: "#1a1209",
    coverSubColor: "rgba(26,18,9,0.65)",
    background: "linear-gradient(180deg, #fce8c8 0%, #fef9f0 100%)",
    dateColor: "#ff4757",
    titleColor: "#1a1209",
    pageNumColor: "rgba(255,71,87,0.5)",
    textColor: "#2b1b0e",
    marginLineColor: "rgba(0,120,200,0.25)",
    pillBg: "#ff4757",
    pillActive: "rgba(255,71,87,0.12)",
    pillBorder: "#1a1209",
    pillText: "#fff",
    coverIcon: "☕",
    borderColor: "#1a1209",
    shadowColor: "#1a1209",
    navBg: "#fce8c8",
    addBtnBg: "#ff4757",
  },

  // ── LEGACY THEMES ───────────────────────────────────────────────────────────
  pastel: {
    label: "Pastel",
    icon: "✿",
    pageBg: "#fffafc",
    stack: ["#fff6f9", "#f8f7ff", "#f0f7ff"],
    spiral: "linear-gradient(150deg, #f7a1c1 0%, #c9a0ff 55%, #86d3ff 100%)",
    binding: "linear-gradient(180deg, #fff0f8, #f3f8ff)",
    accent: "rgba(110,140,200,0.9)",
    accentSoft: "rgba(110,140,200,0.22)",
    linesColor: "rgba(110,140,200,0.08)",
    pageFont: "'Helvetica Neue', Arial, sans-serif",
    bodyFont: "'Helvetica Neue', Arial, sans-serif",
    coverBg: "linear-gradient(160deg, #ffd4e8 0%, #dfe9ff 100%)",
    coverTitleColor: "#2a2a4a",
    coverSubColor: "rgba(44,44,88,0.6)",
    background: "linear-gradient(180deg, #fffafc 0%, #f3f7ff 100%)",
    dateColor: "#9b72cf",
    titleColor: "#2a2a4a",
    pageNumColor: "rgba(110,140,200,0.5)",
    textColor: "#2b2b3b",
    marginLineColor: "rgba(193,164,230,0.35)",
    pillBg: "linear-gradient(135deg, #ffd4e8, #dfe9ff)",
    pillActive: "rgba(110,140,200,0.15)",
    pillBorder: "rgba(110,140,200,0.25)",
    pillText: "#2a2a4a",
    coverIcon: "✿",
    borderColor: "#1a1209",
    shadowColor: "#1a1209",
    navBg: "rgba(255,255,255,0.98)",
    addBtnBg: "transparent",
  },
  classic: {
    label: "Classic",
    icon: "✦",
    pageBg: "#fdf9f1",
    stack: ["#f2eadb", "#ece1cc", "#e4d7be"],
    spiral: "linear-gradient(150deg, #cfa020 0%, #8a6010 55%, #4a3008 100%)",
    binding: "linear-gradient(180deg, #d8c8a4, #ecdfc4)",
    accent: "rgba(200,152,72,0.85)",
    accentSoft: "rgba(200,152,72,0.2)",
    linesColor: "rgba(72,120,200,0.11)",
    pageFont: 'Georgia, "Times New Roman", serif',
    bodyFont: 'Georgia, "Times New Roman", serif',
    coverBg: "linear-gradient(160deg, #1a0a02 0%, #8a5d25 50%, #c59e4a 100%)",
    coverTitleColor: "#fff7e6",
    coverSubColor: "rgba(255,247,230,0.75)",
    background: "radial-gradient(ellipse at 38% 28%, #221409 0%, #0e0806 60%, #040302 100%)",
    dateColor: "#9e5f28",
    titleColor: "#1a0e04",
    pageNumColor: "rgba(158,95,40,0.6)",
    textColor: "#2b1e0f",
    marginLineColor: "rgba(198,48,38,0.22)",
    pillBg: "linear-gradient(135deg, #c59e4a, #8a5d25)",
    pillActive: "rgba(200,152,72,0.18)",
    pillBorder: "rgba(200,152,72,0.35)",
    pillText: "#3b2206",
    coverIcon: "✦",
    borderColor: "#1a1209",
    shadowColor: "#1a1209",
    navBg: "rgba(255,255,255,0.98)",
    addBtnBg: "transparent",
  },
  midnight: {
    label: "Midnight",
    icon: "☽",
    pageBg: "#1e2035",
    stack: ["#191a2d", "#141525", "#10111e"],
    spiral: "linear-gradient(150deg, #6366f1 0%, #8b5cf6 55%, #a78bfa 100%)",
    binding: "linear-gradient(180deg, #2d2f4a, #232440)",
    accent: "rgba(167,139,250,0.9)",
    accentSoft: "rgba(167,139,250,0.18)",
    linesColor: "rgba(167,139,250,0.07)",
    pageFont: "'Palatino Linotype', Palatino, Georgia, serif",
    bodyFont: "'Palatino Linotype', Palatino, Georgia, serif",
    coverBg: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #1a1535 100%)",
    coverTitleColor: "#e2d9f3",
    coverSubColor: "rgba(226,217,243,0.55)",
    background: "radial-gradient(ellipse at 30% 20%, #1a1535 0%, #0d0a1e 60%, #070510 100%)",
    dateColor: "#a78bfa",
    titleColor: "#e2d9f3",
    pageNumColor: "rgba(167,139,250,0.4)",
    textColor: "#c8c3de",
    marginLineColor: "rgba(167,139,250,0.2)",
    pillBg: "linear-gradient(135deg, #6366f1, #4c1d95)",
    pillActive: "rgba(167,139,250,0.15)",
    pillBorder: "rgba(167,139,250,0.3)",
    pillText: "#e2d9f3",
    coverIcon: "☽",
    borderColor: "#6366f1",
    shadowColor: "rgba(99,102,241,0.5)",
    navBg: "#2d2f4a",
    addBtnBg: "transparent",
  },
  sakura: {
    label: "Sakura",
    icon: "꩜",
    pageBg: "#fffcfd",
    stack: ["#fff0f4", "#ffe8f0", "#ffd8e8"],
    spiral: "linear-gradient(150deg, #f4a0b8 0%, #e87fa3 55%, #d5728a 100%)",
    binding: "linear-gradient(180deg, #ffe0ec, #fff0f6)",
    accent: "rgba(213,114,138,0.9)",
    accentSoft: "rgba(213,114,138,0.18)",
    linesColor: "rgba(213,114,138,0.07)",
    pageFont: "'Garamond', 'EB Garamond', Georgia, serif",
    bodyFont: "'Garamond', 'EB Garamond', Georgia, serif",
    coverBg: "linear-gradient(160deg, #6b1a30 0%, #b84a6e 50%, #f0a0bc 100%)",
    coverTitleColor: "#fff5f8",
    coverSubColor: "rgba(255,245,248,0.7)",
    background: "linear-gradient(180deg, #fff5f8 0%, #ffeef4 100%)",
    dateColor: "#c45c7a",
    titleColor: "#2a0e1a",
    pageNumColor: "rgba(196,92,122,0.45)",
    textColor: "#1e0e15",
    marginLineColor: "rgba(196,92,122,0.2)",
    pillBg: "linear-gradient(135deg, #e87fa3, #b84a6e)",
    pillActive: "rgba(213,114,138,0.15)",
    pillBorder: "rgba(213,114,138,0.3)",
    pillText: "#2a0e1a",
    coverIcon: "꩜",
    borderColor: "#1a1209",
    shadowColor: "#1a1209",
    navBg: "rgba(255,255,255,0.98)",
    addBtnBg: "transparent",
  },
};

// Cartoon / retro theme keys shown first in the picker
const THEME_ORDER = ["comic", "typewriter", "popart", "neon", "retro50s", "pastel", "classic", "midnight", "sakura"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isJSON(text) {
  if (!text || typeof text !== "string") return false;
  try { JSON.parse(text); return true; } catch (e) { return false; }
}

function convertPlainToTipTap(text) {
  const blocks = String(text || "").split("\n\n").filter(Boolean).map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  }));
  if (blocks.length === 0) blocks.push({ type: "paragraph" });
  return JSON.stringify({ type: "doc", content: blocks });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function NavBtn({ onClick, disabled, children, spec, "aria-label": ariaLabel }) {
  const isRetro = ["comic", "typewriter", "popart", "neon", "retro50s"].includes(spec._key);
  return (
    <button
      className="diary-nav-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width:         "40px",
        height:        "40px",
        borderRadius:  "4px",
        border:        disabled
          ? `2px solid rgba(128,128,128,0.2)`
          : `2.5px solid ${spec.borderColor || "#1a1209"}`,
        background: disabled
          ? "rgba(128,128,128,0.06)"
          : spec.navBg || "rgba(255,255,255,0.98)",
        color:     disabled ? "rgba(0,0,0,0.2)" : (spec.textColor || "#1a1209"),
        cursor:    disabled ? "default" : "pointer",
        fontSize:  "16px",
        fontWeight: 900,
        display:   "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: disabled
          ? "none"
          : `3px 3px 0px ${spec.shadowColor || "#1a1209"}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function DiaryInternal({ documentId = null }) {
  const [pages, setPages]             = useState(INITIAL_PAGES);
  const pagesRef                       = useRef(pages);
  const indexRef                       = useRef(0);
  const [index, setIndex]             = useState(0);
  const [phase, setPhase]             = useState(null);
  const [showCover, setShowCover]     = useState(true);
  const [theme, setTheme]             = useState("comic"); // default to new retro theme
  const [flipClass, setFlipClass]     = useState("");
  const timerRef                       = useRef(null);
  const autoPagingRef                  = useRef(false);
  const overflowCheckTimerRef          = useRef(null);
  const notebookRef                    = useRef(null);

  // GraphQL: optional sections-backed diary
  const { data: sectionsData } = useQuery(GET_SECTIONS, { variables: { documentId }, skip: !documentId });
  const [createSection]        = useMutation(CREATE_SECTION);
  const [updateSectionContent] = useMutation(UPDATE_SECTION_CONTENT);

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { indexRef.current = index; }, [index]);

  // Persist theme
  useEffect(() => {
    try {
      const t = typeof window !== "undefined" ? localStorage.getItem("diary.theme") : null;
      if (t && THEMES[t]) setTheme(t);
    } catch (e) {}
  }, []);
  useEffect(() => {
    try {
      if (typeof window !== "undefined") localStorage.setItem("diary.theme", theme);
    } catch (e) {}
  }, [theme]);

  // Sections sync
  useEffect(() => {
    if (!(documentId && sectionsData && Array.isArray(sectionsData.getSections))) return;
    const mapped = sectionsData.getSections
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => ({ id: s.id, title: s.title || "", date: s.updatedAt || s.createdAt || null, content: s.content || "" }));
    if (!mapped.length) return;
    if ((!pagesRef.current || pagesRef.current.length === 0) || showCover) {
      setPages(mapped); setIndex(0); setShowCover(false); return;
    }
    const currentId = pagesRef.current[indexRef.current]?.id;
    if (currentId) {
      const newIdx = mapped.findIndex((s) => s.id === currentId);
      if (newIdx !== -1) { setPages(mapped); setIndex(newIdx); return; }
    }
    setPages(mapped);
    setIndex(Math.min(indexRef.current, mapped.length - 1));
  }, [sectionsData, documentId, showCover]);

  const spec     = { ...THEMES[theme] || THEMES.comic, _key: theme };
  const busy     = phase !== null;
  const canPrev  = !showCover && index > 0 && !busy;
  const canNext  = !showCover && index < pages.length - 1 && !busy;

  // Autosave
  const saveFn = async ({ sectionId, content }) => {
    try {
      let parsed = null;
      try { parsed = JSON.parse(content); }
      catch (e) { parsed = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: String(content || "") }] }] }; }
      await updateSectionContent({ variables: { sectionId, contentDoc: parsed } });
    } catch (e) { console.warn("save failed", e); }
  };
  const { scheduleSave } = useDiaryAutosave(saveFn, 1000);

  // Overflow → auto new page
  const checkOverflowAndAdvance = () => {
    try {
      if (autoPagingRef.current) return;
      if (indexRef.current !== (pagesRef.current?.length || 0) - 1) return;
      const editorEl  = document.querySelector('.diary-paper .page.front .rt-editor-content');
      const pageBody  = editorEl ? editorEl.closest('.page-body') : null;
      if (!editorEl || !pageBody) return;
      if (editorEl.scrollHeight > pageBody.clientHeight - 6) {
        autoPagingRef.current = true;
        addPage();
        setTimeout(() => { autoPagingRef.current = false; }, 1200);
      }
    } catch (e) {}
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);
  useEffect(() => () => { clearTimeout(overflowCheckTimerRef.current); autoPagingRef.current = false; }, []);

  const runFlip = (newIdx) => {
    if (busy || newIdx === index) return;
    if (newIdx < 0 || newIdx >= pages.length) return;
    clearTimeout(timerRef.current);
    setShowCover(false);
    setPhase("out");
    setFlipClass(newIdx > index ? "flip-forward" : "flip-back");
    timerRef.current = setTimeout(() => {
      setIndex(newIdx);
      setPhase("in");
      timerRef.current = setTimeout(() => { setPhase(null); setFlipClass(""); }, 410);
    }, 390);
  };

  const addPage = async () => {
    if (busy) return;
    const title   = "New Entry";
    const initial = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

    if (documentId) {
      try {
        const res = await createSection({ variables: { documentId, title } });
        const sec = res?.data?.createSection;
        if (sec) {
          try { await updateSectionContent({ variables: { sectionId: sec.id, contentDoc: JSON.parse(initial) } }); } catch (e) {}
          const newIdx = pagesRef.current.length;
          setPages((p) => [...p, { id: sec.id, title: sec.title || title, date: new Date().toISOString(), content: initial }]);
          setShowCover(false);
          clearTimeout(timerRef.current);
          setPhase("out"); setFlipClass("flip-forward");
          timerRef.current = setTimeout(() => { setIndex(newIdx); setPhase("in"); timerRef.current = setTimeout(() => { setPhase(null); setFlipClass(""); }, 410); }, 390);
          setTimeout(() => { const ed = document.querySelector(".rt-editor-content"); if (ed) ed.focus(); }, 900);
        }
      } catch (e) { console.warn("create section failed", e); }
      return;
    }

    const newIdx = pagesRef.current.length;
    setPages((p) => [...p, { title, date: new Date().toISOString(), content: initial }]);
    setShowCover(false);
    clearTimeout(timerRef.current);
    setPhase("out"); setFlipClass("flip-forward");
    timerRef.current = setTimeout(() => { setIndex(newIdx); setPhase("in"); timerRef.current = setTimeout(() => { setPhase(null); setFlipClass(""); }, 410); }, 390);
    setTimeout(() => { const ed = document.querySelector(".rt-editor-content"); if (ed) ed.focus(); }, 900);
  };

  const saveField = (field) => (e) => {
    const val = e.currentTarget.innerText;
    setPages((p) => p.map((pg, i) => (i === index ? { ...pg, [field]: val } : pg)));
  };

  const onEditorChange = (sectionId, value) => {
    if (!documentId) {
      setPages((p) => p.map((pg, i) => (i === index ? { ...pg, content: value } : pg)));
    } else {
      setPages((p) => p.map((pg) => (pg.id === sectionId ? { ...pg, content: value } : pg)));
      scheduleSave({ sectionId, content: value });
    }
    if (typeof window !== "undefined") {
      clearTimeout(overflowCheckTimerRef.current);
      overflowCheckTimerRef.current = setTimeout(checkOverflowAndAdvance, 140);
    }
  };

  // Auto-focus editor on page change
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector(".rt-editor-content");
      if (el) try { el.focus(); } catch (e) {}
    }, 520);
    return () => clearTimeout(t);
  }, [index, showCover]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === "n" || e.key === "N")) { e.preventDefault(); addPage(); return; }
      if (e.key === "ArrowLeft") {
        if (showCover) { setShowCover(false); setPhase("in"); timerRef.current = setTimeout(() => setPhase(null), 410); setIndex(0); }
        else runFlip(index - 1);
      } else if (e.key === "ArrowRight") {
        if (showCover) { setShowCover(false); setPhase("in"); timerRef.current = setTimeout(() => setPhase(null), 410); setIndex(0); }
        else runFlip(index + 1);
      }
    };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKey);
    return () => { if (typeof window !== "undefined") window.removeEventListener("keydown", onKey); };
  }, [index, pages.length, busy, showCover]);

  const page      = pages[index] || {};
  const animClass = phase === "out" ? "diary-flip-out" : phase === "in" ? "diary-flip-in" : "";

  // Is the current theme a retro/cartoon one?
  const isRetroTheme = ["comic", "typewriter", "popart", "neon", "retro50s"].includes(theme);

  // Determine display font for title/date based on theme
  const displayFont = isRetroTheme ? (spec.pageFont) : (spec.pageFont);
  const bodyFont    = spec.bodyFont || spec.pageFont;

  return (
    <div style={{ background: spec.background, minHeight: "100vh", transition: "background 0.5s ease" }}>
      <style>{ANIM_CSS}</style>

      <div className="diary-wrapper">
        {/* Eyebrow */}
        <div
          style={{
            color:          isRetroTheme ? spec.dateColor : "rgba(120,110,140,0.3)",
            fontSize:       isRetroTheme ? "13px" : "9px",
            letterSpacing:  isRetroTheme ? "8px" : "6px",
            textTransform:  "uppercase",
            marginBottom:   "28px",
            fontFamily:     isRetroTheme ? spec.pageFont : "inherit",
            fontWeight:     isRetroTheme ? 700 : 400,
            opacity:        isRetroTheme ? 0.6 : 1,
          }}
        >
          ✦ My Diary ✦
        </div>

        {/* ── Notebook ── */}
        <div
          ref={notebookRef}
          className={`notebook-frame ${flipClass}`}
          style={{ filter: isRetroTheme ? undefined : "none" }}
        >
          <div
            className="diary-paper diary-paper-inner"
            data-theme={theme}
            style={{
              background: spec.pageBg,
              border:     `${isRetroTheme ? "3.5px" : "1px"} solid ${isRetroTheme ? (spec.borderColor || "#1a1209") : "rgba(17,24,39,0.04)"}`,
              boxShadow:  isRetroTheme
                ? `5px 6px 0px ${spec.shadowColor || "#1a1209"}, 8px 10px 0px rgba(26,18,9,0.15)`
                : "0 24px 52px rgba(17,24,39,0.14), 0 6px 18px rgba(17,24,39,0.07)",
            }}
          >

            {/* ── Theme Picker ── */}
            <div
              style={{
                position:    "absolute",
                top:         "-56px",
                right:       0,
                display:     "flex",
                gap:         "5px",
                alignItems:  "center",
                zIndex:      40,
                flexWrap:    "wrap",
                justifyContent: "flex-end",
                maxWidth:    "var(--page-width)",
              }}
            >
              {THEME_ORDER.map((key) => {
                const t = THEMES[key];
                if (!t) return null;
                const isActive = theme === key;
                const isRetro  = ["comic", "typewriter", "popart", "neon", "retro50s"].includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    title={t.label}
                    aria-pressed={isActive}
                    className={`theme-pill ${isActive ? "active" : ""}`}
                    style={{
                      display:        "flex",
                      alignItems:     "center",
                      gap:            "4px",
                      padding:        "5px 10px",
                      borderRadius:   isRetro ? "3px" : "20px",
                      border:         `2px solid ${isActive ? "#1a1209" : (isRetro ? "rgba(26,18,9,0.3)" : "rgba(200,200,200,0.25)")}`,
                      background:     isActive
                        ? (typeof t.pillBg === "string" && t.pillBg.startsWith("linear") ? t.pillBg : t.pillBg)
                        : (isRetro ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)"),
                      cursor:         "pointer",
                      fontSize:       "10px",
                      fontWeight:     isActive ? 800 : 500,
                      letterSpacing:  isRetro ? "0.8px" : "0.4px",
                      textTransform:  isRetro ? "uppercase" : "none",
                      color:          isActive
                        ? (key === "neon" ? "#000" : (key === "midnight" ? "#e2d9f3" : "#fff"))
                        : "rgba(60,50,40,0.7)",
                      boxShadow:      isActive
                        ? `2px 2px 0px ${isRetro ? "#1a1209" : "rgba(0,0,0,0.2)"}`
                        : (isRetro ? "2px 2px 0px rgba(26,18,9,0.2)" : "0 1px 4px rgba(0,0,0,0.06)"),
                      backdropFilter: "blur(4px)",
                      whiteSpace:     "nowrap",
                    }}
                  >
                    <span style={{ fontSize: "11px" }}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Spiral rings */}
            <div
              className="spiral-rings"
              style={{
                position:        "absolute",
                top:             "-16px",
                left:            "22px",
                right:           "22px",
                display:         "flex",
                justifyContent:  "space-around",
                alignItems:      "center",
                zIndex:          30,
                pointerEvents:   "none",
              }}
            >
              {Array.from({ length: 13 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width:        "16px",
                    height:       "24px",
                    borderRadius: "50%",
                    background:   spec.spiral,
                    border:       isRetroTheme ? "2px solid #1a1209" : "1px solid rgba(0,0,0,0.12)",
                    boxShadow:    isRetroTheme
                      ? "2px 2px 0 #1a1209"
                      : "0 1px 3px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.1)",
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* Pages stacked behind */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  position:     "absolute",
                  top:          `${i * 3}px`,
                  left:         `${i * -2}px`,
                  right:        `${i * -2}px`,
                  height:       "calc(100% + 4px)",
                  background:   i === 1 ? spec.stack[0] : i === 2 ? spec.stack[1] : spec.stack[2],
                  borderRadius: "3px 3px 14px 14px",
                  zIndex:       9 - i,
                  border:       isRetroTheme ? `2px solid ${spec.borderColor || "#1a1209"}` : "none",
                  boxShadow:    isRetroTheme ? `${i + 1}px ${i + 1}px 0 rgba(26,18,9,0.18)` : "none",
                }}
              />
            ))}

            {/* Drop shadow (legacy themes) */}
            {!isRetroTheme && (
              <div
                style={{
                  position:     "absolute",
                  bottom:       "-22px",
                  left:         "7%",
                  right:        "7%",
                  height:       "26px",
                  background:   "rgba(16,24,32,0.10)",
                  borderRadius: "50%",
                  filter:       "blur(18px)",
                  zIndex:       1,
                }}
              />
            )}

            {/* Floating left nav */}
            <div
              className="diary-floating-nav diary-floating-nav-left"
              style={{ position: "absolute", top: "50%", left: "-58px", transform: "translateY(-50%)", zIndex: 50 }}
            >
              <NavBtn onClick={() => runFlip(index - 1)} disabled={!canPrev} spec={spec} aria-label="Previous page">
                ←
              </NavBtn>
            </div>

            {/* Floating right nav + add */}
            <div
              className="diary-floating-nav diary-floating-nav-right"
              style={{
                position:       "absolute",
                top:            "50%",
                right:          "-58px",
                transform:      "translateY(-50%)",
                zIndex:         50,
                display:        "flex",
                flexDirection:  "column",
                gap:            "10px",
                alignItems:     "center",
              }}
            >
              <button
                onClick={addPage}
                disabled={busy}
                className="diary-add-btn"
                aria-label="Add new page (Ctrl+N)"
                style={{
                  width:         "40px",
                  height:        "40px",
                  borderRadius:  isRetroTheme ? "4px" : "50%",
                  border:        `${isRetroTheme ? "2.5px" : "none"} solid ${spec.borderColor || "#1a1209"}`,
                  background:    isRetroTheme ? (spec.addBtnBg || spec.spiral) : spec.spiral,
                  color:         theme === "neon" ? "#000" : "#fff",
                  fontSize:      "20px",
                  fontWeight:    900,
                  cursor:        busy ? "default" : "pointer",
                  boxShadow:     isRetroTheme
                    ? `3px 3px 0px ${spec.borderColor || "#1a1209"}`
                    : "0 6px 16px rgba(0,0,0,0.16)",
                  opacity:       busy ? 0.5 : 1,
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent: "center",
                }}
              >
                +
              </button>
              <NavBtn onClick={() => runFlip(index + 1)} disabled={!canNext} spec={spec} aria-label="Next page">
                →
              </NavBtn>
            </div>

            {/* ── Cover ── */}
            {showCover ? (
              <div
                style={{
                  position:       "relative",
                  zIndex:         10,
                  background:     spec.coverBg,
                  borderRadius:   "6px",
                  height:         "100%",
                  padding:        "56px 40px",
                  boxSizing:      "border-box",
                  overflow:       "hidden",
                  display:        "flex",
                  flexDirection:  "column",
                  alignItems:     "center",
                  justifyContent: "center",
                  color:          spec.coverTitleColor,
                }}
              >
                {/* Halftone overlay on cover */}
                {isRetroTheme && (
                  <div
                    style={{
                      position:        "absolute",
                      inset:           0,
                      backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)",
                      backgroundSize:  "6px 6px",
                      pointerEvents:   "none",
                      mixBlendMode:    "multiply",
                      opacity:         0.25,
                    }}
                  />
                )}
                {/* Decorative lines on cover */}
                <div
                  style={{
                    position:        "absolute",
                    top: 0, bottom: 0, left: 0, right: 0,
                    backgroundImage: `repeating-linear-gradient(transparent, transparent 34px, rgba(255,255,255,0.06) 34px, rgba(255,255,255,0.06) 35px)`,
                    pointerEvents:   "none",
                  }}
                />
                <div style={{ fontSize: "32px", marginBottom: "14px" }}>{spec.coverIcon || spec.icon}</div>
                <div
                  style={{
                    fontSize:      isRetroTheme ? "48px" : "32px",
                    fontWeight:    700,
                    fontFamily:    spec.pageFont,
                    letterSpacing: isRetroTheme ? "6px" : "1px",
                    textTransform: isRetroTheme ? "uppercase" : "none",
                    textShadow:    isRetroTheme && theme !== "neon"
                      ? "3px 3px 0px rgba(0,0,0,0.2)"
                      : theme === "neon"
                        ? "0 0 20px currentColor"
                        : "none",
                  }}
                >
                  My Diary
                </div>
                <div
                  style={{
                    marginTop:     "8px",
                    fontSize:      "11px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color:         spec.coverSubColor,
                    fontFamily:    bodyFont,
                  }}
                >
                  A private journal
                </div>

                <div style={{ marginTop: "36px", display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => {
                      if (pages && pages.length > 0) {
                        setShowCover(false); setPhase("in");
                        timerRef.current = setTimeout(() => setPhase(null), 410);
                        setIndex(0);
                      } else { addPage(); }
                    }}
                    style={{
                      padding:       "11px 26px",
                      borderRadius:  isRetroTheme ? "4px" : "24px",
                      border:        isRetroTheme ? `2.5px solid #1a1209` : "none",
                      cursor:        "pointer",
                      background:    "rgba(255,255,255,0.92)",
                      color:         "#1a0e04",
                      fontWeight:    800,
                      fontSize:      "13px",
                      letterSpacing: isRetroTheme ? "1px" : "0.3px",
                      textTransform: isRetroTheme ? "uppercase" : "none",
                      fontFamily:    spec.pageFont,
                      boxShadow:     isRetroTheme ? "3px 3px 0px #1a1209" : "0 4px 14px rgba(0,0,0,0.15)",
                    }}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => addPage()}
                    style={{
                      padding:       "11px 26px",
                      borderRadius:  isRetroTheme ? "4px" : "24px",
                      background:    "transparent",
                      border:        `${isRetroTheme ? "2.5px" : "1.5px"} solid ${isRetroTheme ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)"}`,
                      color:         spec.coverTitleColor,
                      cursor:        "pointer",
                      fontSize:      "13px",
                      fontWeight:    isRetroTheme ? 700 : 400,
                      letterSpacing: "0.3px",
                      fontFamily:    spec.pageFont,
                      boxShadow:     isRetroTheme ? "2px 2px 0 rgba(0,0,0,0.2)" : "none",
                    }}
                  >
                    + New Page
                  </button>
                </div>
              </div>
            ) : (
              /* ── Page ── */
              <div
                className={`page front ${animClass}`}
                style={{
                  position:               "relative",
                  zIndex:                 10,
                  borderRadius:           "3px 3px 14px 14px",
                  height:                 "100%",
                  padding:                0,
                  boxSizing:              "border-box",
                  overflow:               "hidden",
                  backgroundImage:        `repeating-linear-gradient(transparent, transparent 27px, ${spec.linesColor} 27px, ${spec.linesColor} 28px)`,
                  backgroundPositionY:    "76px",
                  backgroundColor:        spec.pageBg,
                }}
              >
                {/* Binding strip */}
                <div
                  style={{
                    position:     "absolute",
                    top: 0, left: 0, right: 0,
                    height:       "16px",
                    background:   spec.binding,
                    borderBottom: isRetroTheme ? `2px solid ${spec.borderColor || "#1a1209"}` : "none",
                  }}
                />

                {/* Margin line */}
                <div
                  style={{
                    position:   "absolute",
                    top: 0, bottom: 0,
                    left:       "58px",
                    width:      isRetroTheme ? "2px" : "1.5px",
                    background: spec.marginLineColor,
                  }}
                />

                {/* Right-edge vignette */}
                <div
                  style={{
                    position:      "absolute",
                    top: 0, bottom: 0, right: 0,
                    width:         "48px",
                    background:    "linear-gradient(90deg, transparent, rgba(0,0,0,0.018))",
                    pointerEvents: "none",
                  }}
                />

                {/* ── Editable content ── */}
                <div className="page-content" style={{ position: "relative", zIndex: 1 }}>
                  {/* Date */}
                  <div
                    key={`date-${index}`}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={saveField("date")}
                    style={{
                      fontSize:      "9px",
                      letterSpacing: isRetroTheme ? "3px" : "2.5px",
                      textTransform: "uppercase",
                      color:         spec.dateColor,
                      marginBottom:  "12px",
                      cursor:        "text",
                      display:       "inline-block",
                      fontFamily:    isRetroTheme ? spec.pageFont : spec.pageFont,
                      fontWeight:    isRetroTheme ? 700 : 400,
                    }}
                  >
                    {page.date}
                  </div>

                  {/* Title */}
                  <div
                    key={`title-${index}`}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={saveField("title")}
                    style={{
                      fontSize:      isRetroTheme ? "28px" : "23px",
                      fontStyle:     isRetroTheme ? "normal" : "italic",
                      fontWeight:    isRetroTheme ? 700 : 400,
                      fontFamily:    spec.pageFont,
                      color:         spec.titleColor,
                      marginBottom:  "26px",
                      lineHeight:    1.25,
                      cursor:        "text",
                      letterSpacing: isRetroTheme ? "2px" : "0px",
                      textTransform: isRetroTheme ? "uppercase" : "none",
                      borderBottom:  isRetroTheme ? `2.5px solid ${spec.marginLineColor}` : "none",
                      paddingBottom: isRetroTheme ? "10px" : "0",
                      textShadow:    theme === "neon" ? `0 0 12px ${spec.dateColor}` : "none",
                    }}
                  >
                    {page.title}
                  </div>

                  {/* Body */}
                  <div
                    className="page-body"
                    style={{
                      color:       spec.textColor,
                      fontFamily:  bodyFont,
                      boxSizing:   "border-box",
                      paddingRight: "6px",
                      fontSize:    isRetroTheme ? "15px" : "inherit",
                    }}
                  >
                    <RichTextEditor
                      value={isJSON(page.content) ? page.content : convertPlainToTipTap(page.content)}
                      disabled={false}
                      onChange={(val) => onEditorChange(page.id || null, val)}
                    />
                  </div>
                </div>

                {/* Page number */}
                <div
                  className="page-num-stamp"
                  style={{
                    position:    "absolute",
                    bottom:      "18px",
                    left:        0,
                    right:       0,
                    textAlign:   "center",
                    fontSize:    "11px",
                    fontStyle:   isRetroTheme ? "normal" : "italic",
                    fontFamily:  isRetroTheme ? spec.pageFont : "inherit",
                    fontWeight:  isRetroTheme ? 700 : 400,
                    color:       spec.pageNumColor,
                    letterSpacing: isRetroTheme ? "2px" : "0",
                  }}
                >
                  {isRetroTheme ? `— ${index + 1} —` : index + 1}
                </div>

                {/* Corner fold */}
                {canNext && (
                  <div
                    className="diary-corner"
                    onClick={() => runFlip(index + 1)}
                    title="Next page"
                    style={{
                      position:   "absolute",
                      bottom:     0,
                      right:      0,
                      width:      "40px",
                      height:     "40px",
                      background: `linear-gradient(225deg, ${spec.stack[0]} 0%, ${spec.pageBg} 58%)`,
                      clipPath:   "polygon(100% 0, 100% 100%, 0 100%)",
                      cursor:     "pointer",
                      borderTop:  isRetroTheme ? `2px solid ${spec.borderColor || "#1a1209"}` : "none",
                      borderLeft: isRetroTheme ? `2px solid ${spec.borderColor || "#1a1209"}` : "none",
                    }}
                  />
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── Bottom controls ── */}
        <div
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        "14px",
            marginTop:  "46px",
          }}
        >
          <NavBtn onClick={() => runFlip(index - 1)} disabled={!canPrev} spec={spec} aria-label="Previous page">←</NavBtn>

          <span
            style={{
              color:         isRetroTheme ? spec.dateColor : "rgba(120,100,80,0.4)",
              fontSize:      isRetroTheme ? "13px" : "11px",
              letterSpacing: "2px",
              minWidth:      "72px",
              textAlign:     "center",
              fontFamily:    isRetroTheme ? spec.pageFont : "inherit",
              fontWeight:    isRetroTheme ? 700 : 400,
            }}
          >
            {isRetroTheme ? `${index + 1} / ${pages.length}` : `${index + 1} / ${pages.length}`}
          </span>

          <NavBtn onClick={() => runFlip(index + 1)} disabled={!canNext} spec={spec} aria-label="Next page">→</NavBtn>

          <button
            className="diary-add-btn"
            onClick={addPage}
            disabled={busy}
            style={{
              marginLeft:    "10px",
              background:    "transparent",
              border:        `${isRetroTheme ? "2.5px" : "1px"} solid ${isRetroTheme ? (spec.borderColor || "#1a1209") : spec.pillBorder}`,
              color:         spec.accent,
              padding:       "8px 20px",
              borderRadius:  isRetroTheme ? "4px" : "20px",
              cursor:        busy ? "default" : "pointer",
              fontSize:      isRetroTheme ? "11px" : "11px",
              letterSpacing: "1px",
              fontFamily:    spec.pageFont,
              fontWeight:    isRetroTheme ? 800 : 400,
              textTransform: isRetroTheme ? "uppercase" : "none",
              boxShadow:     isRetroTheme ? `2px 2px 0 ${spec.borderColor || "#1a1209"}` : "none",
              opacity:       busy ? 0.5 : 1,
            }}
          >
            + New Page
          </button>
        </div>

        {/* Hint */}
        <div
          style={{
            color:         isRetroTheme ? spec.dateColor : "rgba(120,100,80,0.25)",
            opacity:       isRetroTheme ? 0.45 : 1,
            fontSize:      isRetroTheme ? "11px" : "10px",
            marginTop:     "18px",
            letterSpacing: "1px",
            fontFamily:    isRetroTheme ? spec.pageFont : "inherit",
            fontWeight:    isRetroTheme ? 700 : 400,
            textTransform: isRetroTheme ? "uppercase" : "none",
          }}
        >
          Click any text to edit · ← → to navigate · Ctrl+N for new page
        </div>
      </div>
    </div>
  );
}

export default function Diary(props) {
  const client = useMemo(() => createApolloClient(""), []);
  return (
    <ApolloProvider client={client}>
      <DiaryInternal {...props} />
    </ApolloProvider>
  );
}