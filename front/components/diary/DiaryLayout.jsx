"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, ApolloProvider } from "@apollo/client";
import RichTextEditor from "../RichTextEditor";
import useDiaryAutosave from "./useDiaryAutosave";
import { GET_SECTIONS, CREATE_SECTION, UPDATE_SECTION_CONTENT, REORDER_SECTION, GET_DOCUMENT, UPDATE_DOCUMENT } from "@/lib/graphql";
import { EMOJI_GROUPS, STICKER_PACKS, searchStickers, getStickersByGroup, getGroupColor } from "@/lib/stickers";
import { createApolloClient } from "@/lib/apollo";

// ─── Inline animation / micro-interaction CSS ─────────────────────────────────
const ANIM_CSS = `
  @keyframes diaryFlipOut {
    0%   { transform: perspective(1300px) rotateX(0deg) translateY(0) scale(1); opacity: 1; filter: brightness(1); }
    38%  { transform: perspective(1300px) rotateX(-48deg) translateY(-10px) scale(0.995); opacity: 0.96; filter: brightness(1.02); }
    72%  { transform: perspective(1300px) rotateX(-92deg) translateY(-18px) scale(0.985); opacity: 0.55; filter: brightness(0.92); }
    100% { transform: perspective(1300px) rotateX(-118deg) translateY(-12px) scale(0.98); opacity: 0.16; filter: brightness(0.88); }
  }
  @keyframes diaryFlipIn {
    0%   { transform: perspective(1300px) rotateX(86deg) translateY(16px) scale(0.985); opacity: 0.14; filter: brightness(0.9); }
    48%  { transform: perspective(1300px) rotateX(18deg) translateY(-4px) scale(1.002); opacity: 0.86; filter: brightness(1.03); }
    100% { transform: perspective(1300px) rotateX(0deg) translateY(0) scale(1); opacity: 1; filter: brightness(1); }
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
    animation: diaryFlipOut 0.48s cubic-bezier(0.45, 0.05, 0.18, 0.98) forwards;
    transform-origin: top center;
    box-shadow: 0 26px 46px rgba(47, 30, 18, 0.26), inset 0 -34px 44px rgba(0,0,0,0.08) !important;
  }
  .diary-flip-in {
    animation: diaryFlipIn 0.52s cubic-bezier(0.14, 0.72, 0.22, 1) forwards;
    transform-origin: top center;
    box-shadow: 0 18px 36px rgba(47, 30, 18, 0.18), inset 0 22px 34px rgba(255,255,255,0.2) !important;
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

  /* ── Kawaii heart beat ── */
  @keyframes heartBeatInline {
    0%, 100% { transform: scale(1); }
    14%       { transform: scale(1.25); }
    28%       { transform: scale(1); }
    42%       { transform: scale(1.15); }
  }
  /* ── Pixel diamond spin ── */
  @keyframes pixelSpin {
    0%   { transform: rotate(0deg)   scale(1); }
    25%  { transform: rotate(90deg)  scale(1.1); }
    50%  { transform: rotate(180deg) scale(1); }
    75%  { transform: rotate(270deg) scale(1.1); }
    100% { transform: rotate(360deg) scale(1); }
  }
  /* ── Pixel scanline flicker ── */
  @keyframes scanFlicker {
    0%, 100% { opacity: 0.85; }
    50%       { opacity: 1; }
  }

  .pixel-cover-icon   { animation: pixelSpin 3s linear infinite; display: inline-block; }
  .kawaii-cover-icon  { animation: heartBeatInline 1.4s ease infinite; display: inline-block; }
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

  // ── NEW GAME / CUTE THEMES ──────────────────────────────────────────────────
  pixel: {
    label: "Pixel",
    icon: "◆",
    pageBg: "#f8f4ff",
    stack: ["#e8deff", "#d8c8ff", "#c8b0ff"],
    spiral: "linear-gradient(150deg, #e91e63 0%, #9c27b0 55%, #3f51b5 100%)",
    binding: "linear-gradient(180deg, #e91e63, #9c27b0)",
    accent: "rgba(233,30,99,0.95)",
    accentSoft: "rgba(233,30,99,0.15)",
    linesColor: "rgba(63,81,181,0.1)",
    pageFont: "'Press Start 2P', monospace",
    bodyFont: "'Press Start 2P', monospace",
    coverBg: "linear-gradient(160deg, #1a0a2e 0%, #16213e 48%, #0f3460 100%)",
    coverTitleColor: "#e91e63",
    coverSubColor: "rgba(233,30,99,0.7)",
    background: "repeating-linear-gradient(0deg, #f0ebff 0px, #f0ebff 3px, #f8f4ff 3px, #f8f4ff 48px)",
    dateColor: "#e91e63",
    titleColor: "#1a0a2e",
    pageNumColor: "rgba(233,30,99,0.55)",
    textColor: "#1a0a2e",
    marginLineColor: "rgba(63,81,181,0.3)",
    pillBg: "#e91e63",
    pillActive: "rgba(233,30,99,0.15)",
    pillBorder: "#1a0a2e",
    pillText: "#fff",
    coverIcon: "◆",
    borderColor: "#1a0a2e",
    shadowColor: "#1a0a2e",
    navBg: "#e8deff",
    addBtnBg: "#e91e63",
  },

  kawaii: {
    label: "Kawaii",
    icon: "♡",
    pageBg: "#fff5fb",
    stack: ["#ffe8f5", "#ffd6ef", "#ffc4e9"],
    spiral: "linear-gradient(150deg, #ff69b4 0%, #da70d6 55%, #9370db 100%)",
    binding: "linear-gradient(180deg, #ffb3d9, #e8a0d8)",
    accent: "rgba(255,105,180,0.95)",
    accentSoft: "rgba(255,105,180,0.18)",
    linesColor: "rgba(218,112,214,0.1)",
    pageFont: "'Nunito', 'Patrick Hand', cursive",
    bodyFont: "'Nunito', 'Patrick Hand', cursive",
    coverBg: "linear-gradient(160deg, #ff69b4 0%, #da70d6 50%, #9370db 100%)",
    coverTitleColor: "#fff",
    coverSubColor: "rgba(255,255,255,0.8)",
    background: "radial-gradient(circle at 25% 15%, #fff0fa 0%, #fff5fb 55%, #f0e8ff 100%)",
    dateColor: "#d44498",
    titleColor: "#5a1a4a",
    pageNumColor: "rgba(212,68,152,0.55)",
    textColor: "#4a1a3a",
    marginLineColor: "rgba(255,105,180,0.3)",
    pillBg: "linear-gradient(135deg, #ff69b4, #da70d6)",
    pillActive: "rgba(255,105,180,0.15)",
    pillBorder: "#cc4499",
    pillText: "#fff",
    coverIcon: "♡",
    borderColor: "#cc4499",
    shadowColor: "#cc4499",
    navBg: "#ffe0f4",
    addBtnBg: "#ff69b4",
  },
};

// Cartoon / retro theme keys shown first in the picker
const THEME_ORDER = ["pixel", "kawaii", "comic", "typewriter", "popart", "neon", "retro50s", "pastel", "classic", "midnight", "sakura"];

const DEFAULT_WALL_NOTES = [
  { id: "note-1", text: "today felt soft", color: "#fff8d7", x: 8, y: 15, rotate: -2 },
  { id: "note-2", text: "remember to breathe", color: "#ffe1ee", x: 73, y: 20, rotate: 2 },
  { id: "note-3", text: "tiny wins count", color: "#def7ec", x: 11, y: 66, rotate: 1 },
];

const FALLBACK_STICKERS = [
  { id: "fallback-love", type: "love", label: "Love", mark: "<3" },
  { id: "fallback-star", type: "star", label: "Star", mark: "*" },
  { id: "fallback-flower", type: "flower", label: "Flower", mark: "o" },
  { id: "fallback-moon", type: "moon", label: "Moon", mark: "c" },
  { id: "fallback-music", type: "music", label: "Music", mark: "~" },
];
const KLIPY_STICKER_QUERY = "cute journal sticker";
const PET_CHOICES = ["whiteCat", "sittingCat", "sleepyCat"];
const PET_TYPES = {
  whiteCat: {
    label: "White cat",
    src: "/pets/white-cat.gif",
  },
  sittingCat: {
    label: "Sitting cat",
    src: "/pets/whitecat-sitting1.gif",
  },
  sleepyCat: {
    label: "Sleepy cat",
    src: "/pets/whitecat-sleep.gif",
  },
};
const PET_REST_MESSAGES = [
  "I'm keeping your thoughts warm.",
  "That page feels cozy.",
  "Want to add a tiny note?",
  "I'm here when words slow down.",
];
const PET_TYPING_MESSAGE = "tap tap... I'm writing with you";

const clampCanvasPercent = (value, min = 3, max = 88) => Math.max(min, Math.min(max, value));

function readStickerImage(item) {
  const candidates = [
    item?.url,
    item?.image,
    item?.image_url,
    item?.media_url,
    item?.thumbnail,
    item?.preview,
    item?.images?.fixed_height?.url,
    item?.images?.fixed_width?.url,
    item?.images?.original?.url,
    item?.files?.gif,
    item?.files?.webp,
    item?.file?.url,
    item?.content?.url,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || null;
}

function normalizeKlipyStickers(payload) {
  const list =
    payload?.data?.data ||
    payload?.data?.stickers ||
    payload?.stickers ||
    payload?.results ||
    payload?.data ||
    [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item, idx) => {
      const src = readStickerImage(item);
      if (!src) return null;
      return {
        id: String(item?.id || item?.slug || `klipy-${idx}`),
        type: "klipy",
        label: item?.title || item?.name || "Klipy sticker",
        src,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

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
  const isRetro = ["pixel", "kawaii", "comic", "typewriter", "popart", "neon", "retro50s"].includes(spec._key);
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

// ─── Sticker Picker Panel Component ──────────────────────────────────────────
function StickerPickerPanel({ theme, isRetroTheme, spec, onAddSticker }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPacks, setShowPacks] = useState(false);
  const [activePack, setActivePack] = useState(null);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const filteredStickers = useMemo(() => {
    if (searchQuery.trim()) {
      return searchStickers(searchQuery);
    }
    if (showPacks && activePack) {
      const pack = STICKER_PACKS.find(p => p.id === activePack);
      return pack ? pack.stickers : [];
    }
    return getStickersByGroup(activeGroup);
  }, [activeGroup, searchQuery, showPacks, activePack]);

  const borderColor = isRetroTheme ? (spec.borderColor || "#1a1209") : "rgba(17,24,39,0.08)";
  const bgColor = spec.pageBg || "#fff";
  const textColor = spec.textColor || "#1a1209";

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="sticker-picker-trigger"
        aria-label="Open sticker picker"
        title="Emoji stickers"
        style={{
          padding: "6px 12px",
          borderRadius: "8px",
          border: `2px solid ${borderColor}`,
          background: isRetroTheme ? (spec.navBg || "rgba(255,255,255,0.92)") : "transparent",
          color: textColor,
          cursor: "pointer",
          fontSize: "16px",
          fontWeight: 700,
          fontFamily: spec.pageFont,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: isRetroTheme ? `2px 2px 0px ${spec.shadowColor || "#1a1209"}` : "none",
        }}
      >
        <span>🎨</span>
        <span style={{ fontSize: "11px", letterSpacing: "1px" }}>Emoji</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "0",
            marginTop: "8px",
            background: bgColor,
            color: textColor,
            borderRadius: "12px",
            border: isRetroTheme ? `2.5px solid ${borderColor}` : "1px solid rgba(17,24,39,0.1)",
            boxShadow: isRetroTheme
              ? `5px 6px 0px ${spec.shadowColor || "#1a1209"}, 0 12px 32px rgba(0,0,0,0.15)`
              : "0 12px 32px rgba(0,0,0,0.12)",
            padding: "12px",
            width: "320px",
            maxHeight: "400px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 10000,
          }}
        >
          {/* Search bar */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search stickers..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowPacks(false); }}
              style={{
                width: "100%",
                padding: "8px 10px 8px 32px",
                borderRadius: "8px",
                border: `1.5px solid ${borderColor}`,
                background: isRetroTheme ? `${spec.pillActive || "rgba(0,0,0,0.04)"}` : "rgba(0,0,0,0.04)",
                color: textColor,
                fontSize: "12px",
                fontFamily: spec.bodyFont || "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", opacity: 0.5 }}>🔍</span>
          </div>

          {/* Tab row: Groups | Packs */}
          <div style={{ display: "flex", gap: "4px", borderBottom: `1px solid ${borderColor}40`, paddingBottom: "6px" }}>
            <button
              type="button"
              onClick={() => { setShowPacks(false); setActiveGroup("all"); setSearchQuery(""); }}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                background: !showPacks ? spec.pillBg || "#e91e63" : "transparent",
                color: !showPacks ? "#fff" : textColor,
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: spec.pageFont,
              }}
            >
              Groups
            </button>
            <button
              type="button"
              onClick={() => { setShowPacks(true); setActivePack(null); setSearchQuery(""); }}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                background: showPacks ? spec.pillBg || "#e91e63" : "transparent",
                color: showPacks ? "#fff" : textColor,
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: spec.pageFont,
              }}
            >
              Packs
            </button>
          </div>

          {/* Group filter chips (when not in packs mode) */}
          {!showPacks && !searchQuery && (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxHeight: "32px", overflowY: "auto" }}>
              {EMOJI_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGroup(g.id)}
                  title={g.label}
                  style={{
                    padding: "3px 6px",
                    borderRadius: "6px",
                    border: activeGroup === g.id ? `2px solid ${borderColor}` : "1px solid transparent",
                    background: activeGroup === g.id ? (spec.pillActive || "rgba(0,0,0,0.06)") : "transparent",
                    cursor: "pointer",
                    fontSize: "16px",
                    lineHeight: 1,
                    transition: "all 0.1s ease",
                  }}
                >
                  {g.icon}
                </button>
              ))}
            </div>
          )}

          {/* Pack selector (when in packs mode) */}
          {showPacks && !searchQuery && (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxHeight: "60px", overflowY: "auto" }}>
              {STICKER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setActivePack(pack.id)}
                  title={pack.label}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: activePack === pack.id ? `2px solid ${borderColor}` : "1px solid transparent",
                    background: activePack === pack.id ? (spec.pillActive || "rgba(0,0,0,0.06)") : "transparent",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: spec.pageFont,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.1s ease",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>{pack.icon}</span>
                  <span style={{ color: textColor }}>{pack.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sticker grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: "4px",
              overflowY: "auto",
              maxHeight: "220px",
              padding: "4px 2px",
            }}
          >
            {filteredStickers.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                type="button"
                onClick={() => {
                  onAddSticker(emoji, `Sticker ${emoji}`);
                  // Don't close — let them add multiple
                }}
                title={emoji}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: "8px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.1s ease, transform 0.1s ease",
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = spec.pillActive || "rgba(0,0,0,0.06)";
                  e.currentTarget.style.transform = "scale(1.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div style={{ fontSize: "10px", opacity: 0.4, textAlign: "center", fontFamily: spec.pageFont }}>
            {filteredStickers.length} stickers · double-click to remove
          </div>
        </div>
      )}
    </div>
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
  const [coverTitle, setCoverTitle]   = useState("My Diary");
  const [coverSubtitle, setCoverSubtitle] = useState("A private journal");
  const [coverImage, setCoverImage]   = useState(null);
  const coverImageInputRef            = useRef(null);
  const justSavedCoverRef             = useRef(null);
  const coverSaveTimerRef             = useRef(null);
  const [theme, setTheme]             = useState("pixel"); // default to new game theme
  const [showThemePanel, setShowThemePanel] = useState(false);
  const settingsRef = useRef(null);
  const [selectedBodyFont, setSelectedBodyFont] = useState(null);
  const [selectedFontSize, setSelectedFontSize] = useState(null);
  const [flipClass, setFlipClass]     = useState("");
  const timerRef                       = useRef(null);
  const typingTimerRef                 = useRef(null);
  const autoPagingRef                  = useRef(false);
  const overflowCheckTimerRef          = useRef(null);
  const notebookRef                    = useRef(null);
  const workspaceCanvasRef             = useRef(null);
  const [wallNotes, setWallNotes]      = useState(DEFAULT_WALL_NOTES);
  const [stickerChoices, setStickerChoices] = useState(FALLBACK_STICKERS);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [stickers, setStickers]        = useState([
    { id: "sticker-1", type: "star", label: "Star", mark: "*", x: 68, y: 14, rotate: 12 },
    { id: "sticker-2", type: "love", label: "Love", mark: "<3", x: 21, y: 74, rotate: -10 },
  ]);
  const [pets, setPets]                = useState([
    { id: "pet-1", type: "sittingCat", x: 72, y: 56, rotate: 1 },
  ]);
  const [workspaceMood] = useState("soft");
  const [petMood, setPetMood]          = useState("rest");
  const [petMessage, setPetMessage]    = useState(PET_REST_MESSAGES[0]);

  // GraphQL: optional sections-backed diary
  const { data: sectionsData } = useQuery(GET_SECTIONS, { variables: { documentId }, skip: !documentId });
  const [createSection]        = useMutation(CREATE_SECTION);
  const [updateSectionContent] = useMutation(UPDATE_SECTION_CONTENT);
  const [reorderSection]       = useMutation(REORDER_SECTION);
  const { data: documentData } = useQuery(GET_DOCUMENT, { variables: { id: documentId }, skip: !documentId, fetchPolicy: "network-only" });
  const [updateDocumentMutation] = useMutation(UPDATE_DOCUMENT);

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

  // Persist cover title/subtitle per-document if documentId provided, else global
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      // Only initialize from localStorage if the server did not provide a value.
      const keyT = documentId ? `diary.cover.title.${documentId}` : `diary.cover.title`;
      const keyS = documentId ? `diary.cover.sub.${documentId}` : `diary.cover.sub`;
      const savedT = localStorage.getItem(keyT);
      const savedS = localStorage.getItem(keyS);
      // If server provided a value, prefer it. Otherwise fall back to localStorage.
      if (!documentData?.document && savedT) setCoverTitle(savedT);
      if (!documentData?.document && savedS) setCoverSubtitle(savedS);
    } catch (e) {}
  }, [documentId, documentData]);

  // Initialize cover fields from server-side document when available
  useEffect(() => {
    try {
      const doc = documentData?.document;
      if (!doc) return;
      if (typeof doc.coverTitle === "string") setCoverTitle(doc.coverTitle || "");
      if (typeof doc.coverImage === "string") setCoverImage(doc.coverImage || null);
    } catch (e) {}
  }, [documentData]);

  // Persist cover fields to server when documentId is present (debounced)
  useEffect(() => {
    if (!documentId) return;
    try {
      clearTimeout(coverSaveTimerRef.current);
      coverSaveTimerRef.current = setTimeout(async () => {
        try {
          await updateDocumentMutation({ variables: { id: documentId, coverImage: coverImage || null, coverTitle: coverTitle || null } });
        } catch (e) {
          // swallow — non-critical
          console.warn("failed to save cover metadata", e);
        }
      }, 700);
    } catch (e) {}
    return () => clearTimeout(coverSaveTimerRef.current);
  }, [coverImage, coverTitle, documentId, updateDocumentMutation]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const keyT = documentId ? `diary.cover.title.${documentId}` : `diary.cover.title`;
      const keyS = documentId ? `diary.cover.sub.${documentId}` : `diary.cover.sub`;
      if (coverTitle) localStorage.setItem(keyT, coverTitle);
      else localStorage.removeItem(keyT);
      if (coverSubtitle) localStorage.setItem(keyS, coverSubtitle);
      else localStorage.removeItem(keyS);
    } catch (e) {}
  }, [coverTitle, coverSubtitle, documentId]);

  // Persist/restore cover image
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const keyI = documentId ? `diary.cover.image.${documentId}` : `diary.cover.image`;
      const savedI = localStorage.getItem(keyI);
      if (savedI) setCoverImage(savedI);
    } catch (e) {}
  }, [documentId]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const keyI = documentId ? `diary.cover.image.${documentId}` : `diary.cover.image`;
      if (coverImage) {
        try { localStorage.setItem(keyI, coverImage); } catch (e) {
          // Image too large for localStorage — skip silently
        }
      } else {
        localStorage.removeItem(keyI);
      }
    } catch (e) {}
  }, [coverImage, documentId]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const key = documentId ? `diary.workspace.${documentId}` : "diary.workspace";
      const saved = localStorage.getItem(key);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.wallNotes)) setWallNotes(parsed.wallNotes);
      if (Array.isArray(parsed.stickers)) setStickers(parsed.stickers);
      if (Array.isArray(parsed.pets)) setPets(parsed.pets);
    } catch (e) {}
  }, [documentId]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const key = documentId ? `diary.workspace.${documentId}` : "diary.workspace";
      localStorage.setItem(key, JSON.stringify({ wallNotes, stickers, pets, workspaceMood }));
    } catch (e) {}
  }, [wallNotes, stickers, pets, workspaceMood, documentId]);

  useEffect(() => {
    let cancelled = false;

    async function loadKlipyStickers() {
      if (typeof window === "undefined") return;
      const apiKey = process.env.NEXT_PUBLIC_KLIPY_API_KEY || "";
      const customUrl = process.env.NEXT_PUBLIC_KLIPY_STICKERS_URL || "";
      const urls = customUrl
        ? [customUrl]
        : [
            `https://api.klipy.com/api/v1/stickers/search?query=${encodeURIComponent(KLIPY_STICKER_QUERY)}&limit=10`,
            `https://api.klipy.com/api/v1/stickers/trending?limit=10`,
          ];

      setStickersLoading(true);
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            headers: apiKey ? { "x-api-key": apiKey, Authorization: `Bearer ${apiKey}` } : {},
          });
          if (!res.ok) continue;
          const payload = await res.json();
          const next = normalizeKlipyStickers(payload);
          if (!cancelled && next.length) {
            setStickerChoices(next);
            return;
          }
        } catch (e) {}
      }
      if (!cancelled) setStickerChoices(FALLBACK_STICKERS);
    }

    loadKlipyStickers().finally(() => {
      if (!cancelled) setStickersLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onDoc(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowThemePanel(false);
    }
    if (typeof document !== "undefined") document.addEventListener("mousedown", onDoc);
    return () => { if (typeof document !== "undefined") document.removeEventListener("mousedown", onDoc); };
  }, []);

  // Persist/restore font choices
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const ff = localStorage.getItem("diary.fontFamily");
        const fs = localStorage.getItem("diary.fontSize");
        if (ff) setSelectedBodyFont(ff);
        if (fs) setSelectedFontSize(fs);
      }
    } catch (e) {}
  }, []);
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        if (selectedBodyFont) localStorage.setItem("diary.fontFamily", selectedBodyFont);
        else localStorage.removeItem("diary.fontFamily");
        if (selectedFontSize) localStorage.setItem("diary.fontSize", selectedFontSize);
        else localStorage.removeItem("diary.fontSize");
      }
    } catch (e) {}
  }, [selectedBodyFont, selectedFontSize]);

  // Sections sync
  useEffect(() => {
    if (!(documentId && sectionsData && Array.isArray(sectionsData.getSections))) return;
    const mapped = sectionsData.getSections
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => ({ id: s.id, title: s.title || "", date: s.updatedAt || s.createdAt || null, content: s.content || "", order: s.order }));
    if (!mapped.length) return;

    // If we just saved a cover locally but the server hasn't returned it yet,
    // keep the local cover at the front until the server includes it.
    const savedCoverId = justSavedCoverRef.current;
    if (savedCoverId) {
      const mappedHas = mapped.find((m) => m.id === savedCoverId);
      if (!mappedHas) {
        const localCover = (pagesRef.current || []).find((p) => p && p.id === savedCoverId);
        if (localCover) {
          setPages([localCover, ...mapped]);
          setIndex(0);
          setShowCover(false);
          return;
        }
      } else {
        // server now returned the cover — clear the marker so normal sync proceeds
        justSavedCoverRef.current = null;
      }
    }

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

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearTimeout(typingTimerRef.current);
  }, []);
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
    nudgePetsForTyping();
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

  // Cover-aware page numbering (detect either local `pageNumber` or server `order` === 0)
  const hasCoverPage = Array.isArray(pages) && pages.some((p) => p && ((typeof p.pageNumber === "number" && p.pageNumber === 0) || (p.order !== undefined && p.order === 0)));
  const getDisplayNumber = (idx) => {
    const pg = pages[idx];
    if (pg && pg.pageNumber !== undefined && pg.pageNumber !== null) return pg.pageNumber;
    if (pg && pg.order !== undefined && pg.order === 0) return 0;
    if (hasCoverPage) return idx; // when cover is stored as page 0, other pages are offset by index
    if (showCover) return 0; // overlay cover
    return idx + 1;
  };
  const displayCurrentNumber = getDisplayNumber(index);
  const totalDisplayCount = hasCoverPage ? Math.max(0, pages.length - 1) : pages.length;

  // Is the current theme a retro/cartoon one?
  const isRetroTheme = ["pixel", "kawaii", "comic", "typewriter", "popart", "neon", "retro50s"].includes(theme);

  // Determine display font for title/date based on theme
  const displayFont = isRetroTheme ? (spec.pageFont) : (spec.pageFont);
  const bodyFont    = selectedBodyFont || spec.bodyFont || spec.pageFont;
  const appliedFontSize = selectedFontSize || (isRetroTheme ? "15px" : "inherit");

  // Font size adjustment helpers
  const clampFont = (n) => Math.max(10, Math.min(28, n));
  const changeFontSize = (delta) => {
    let base = 16;
    if (selectedFontSize) base = parseInt(selectedFontSize, 10) || 16;
    else base = isRetroTheme ? 15 : 16;
    const next = clampFont(base + delta);
    setSelectedFontSize(`${next}px`);
  };

  const addWallNote = () => {
    const colors = ["#fff8d7", "#ffe1ee", "#def7ec", "#e4edff"];
    const nextIndex = wallNotes.length + 1;
    setWallNotes((notes) => [
      ...notes,
      {
        id: `note-${Date.now()}`,
        text: "new thought",
        color: colors[nextIndex % colors.length],
        x: 20 + ((nextIndex * 13) % 58),
        y: 18 + ((nextIndex * 11) % 54),
        rotate: nextIndex % 2 === 0 ? 2 : -2,
      },
    ]);
  };

  const updateWallNote = (id, text) => {
    setWallNotes((notes) => notes.map((note) => (note.id === id ? { ...note, text } : note)));
  };

  const removeWallNote = (id) => {
    setWallNotes((notes) => notes.filter((note) => note.id !== id));
  };

  const addSticker = (sticker) => {
    const count = stickers.length;
    setStickers((items) => [
      ...items,
      {
        id: `sticker-${Date.now()}`,
        type: sticker.type || "klipy",
        label: sticker.label || "Sticker",
        src: sticker.src || null,
        mark: sticker.mark || "*",
        x: 12 + ((count * 23) % 72),
        y: 18 + ((count * 17) % 66),
        rotate: count % 2 === 0 ? -12 : 10,
      },
    ]);
  };

  const removeSticker = (id) => {
    setStickers((items) => items.filter((item) => item.id !== id));
  };

  const addPet = (type) => {
    const count = pets.length;
    setPets((items) => [
      ...items,
      {
        id: `pet-${Date.now()}`,
        type,
        x: 14 + ((count * 29) % 66),
        y: 18 + ((count * 19) % 56),
        rotate: count % 2 === 0 ? -1 : 2,
      },
    ]);
  };

  const removePet = (id) => {
    setPets((items) => items.filter((item) => item.id !== id));
  };

  const moveCanvasItem = (kind, id, x, y) => {
    const update = (item) => item.id === id ? { ...item, x, y } : item;
    if (kind === "note") setWallNotes((items) => items.map(update));
    if (kind === "sticker") setStickers((items) => items.map(update));
    if (kind === "pet") setPets((items) => items.map(update));
  };

  const startCanvasDrag = (kind, id) => (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const canvas = workspaceCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const target = event.currentTarget.closest("[data-canvas-item]");
    const targetRect = target?.getBoundingClientRect();
    const offsetX = targetRect ? event.clientX - targetRect.left : 0;
    const offsetY = targetRect ? event.clientY - targetRect.top : 0;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const x = ((moveEvent.clientX - rect.left - offsetX) / rect.width) * 100;
      const y = ((moveEvent.clientY - rect.top - offsetY) / rect.height) * 100;
      moveCanvasItem(kind, id, clampCanvasPercent(x), clampCanvasPercent(y));
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const nudgePetsForTyping = () => {
    setPetMood("typing");
    setPetMessage(PET_TYPING_MESSAGE);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      const next = PET_REST_MESSAGES[Math.floor(Math.random() * PET_REST_MESSAGES.length)];
      setPetMood("rest");
      setPetMessage(next);
    }, 1200);
  };

  // Compute line spacing (px) so ruled lines match editor line-height
  const fontSizeNumber = selectedFontSize ? (parseInt(selectedFontSize, 10) || (isRetroTheme ? 15 : 16)) : (isRetroTheme ? 15 : 16);
  const lineMultiplier = theme === "pixel" ? 2.4 : 1.9;
  const rtLineStep = `${Math.round(fontSizeNumber * lineMultiplier)}px`;

  return (
    <div
      className={`diary-room diary-room-${workspaceMood}`}
      style={{ background: spec.background, minHeight: "100vh", transition: "background 0.5s ease" }}
    >
      <style>{ANIM_CSS}</style>

      {/* Settings + theme picker popover */}
      <div
        ref={settingsRef}
        style={{
          position: "fixed",
          top: "16px",
          right: "16px",
          zIndex: 9999,
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={() => setShowThemePanel((s) => !s)}
          aria-label="Open settings"
          title="Themes"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            border: `2px solid ${spec.borderColor || "#1a1209"}`,
            background: spec.navBg || "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: `3px 3px 0px ${spec.shadowColor || "#1a1209"}`,
          }}
        >
          <span style={{ fontSize: "18px" }}>⚙️</span>
        </button>

        {showThemePanel && (
          <div
            style={{
              marginTop: "6px",
              background: spec.pageBg,
              color: spec.textColor,
              borderRadius: "10px",
              padding: "12px",
              boxShadow: isRetroTheme ? `5px 6px 0px ${spec.shadowColor || "#1a1209"}` : "0 8px 24px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxWidth: "420px",
              width: "min(420px, 88vw)",
              fontFamily: spec.pageFont,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "8px", border: `1.5px solid ${spec.borderColor || "rgba(0,0,0,0.08)"}`, background: spec.pillActive || "transparent", color: spec.textColor }}
              >
                {THEME_ORDER.map((k) => (
                  <option key={k} value={k}>{THEMES[k]?.label || k}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Font</label>
              <select
                value={selectedBodyFont || ""}
                onChange={(e) => setSelectedBodyFont(e.target.value === "" ? null : e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "8px", border: `1.5px solid ${spec.borderColor || "rgba(0,0,0,0.08)"}`, background: "transparent", color: spec.textColor }}
              >
                <option value="">Theme default</option>
                <option value="Georgia, serif">Serif (Georgia)</option>
                <option value="'Helvetica Neue', Arial, sans-serif">Sans-serif</option>
                <option value="'Courier New', monospace">Monospace</option>
                <option value="'Patrick Hand', cursive">Handwritten</option>
                <option value="'Garamond', 'EB Garamond', serif">Garamond</option>
                <option value="'Press Start 2P', monospace">Pixel</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Size</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => changeFontSize(-1)}
                  aria-label="Decrease font size"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: `1.5px solid ${spec.borderColor || "rgba(0,0,0,0.08)"}`,
                    background: "transparent",
                    color: spec.textColor,
                    cursor: "pointer",
                    fontSize: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  −
                </button>
                <div style={{ minWidth: "48px", textAlign: "center", fontSize: "13px", color: spec.textColor }}>{selectedFontSize || (isRetroTheme ? "15px" : "Default")}</div>
                <button
                  onClick={() => changeFontSize(1)}
                  aria-label="Increase font size"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: `1.5px solid ${spec.borderColor || "rgba(0,0,0,0.08)"}`,
                    background: "transparent",
                    color: spec.textColor,
                    cursor: "pointer",
                    fontSize: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
        <div className="diary-workspace">
          <div className="diary-workspace-toolbar" aria-label="Sticker and pet tools">
            {/* ── Sticker Picker Panel ── */}
            <StickerPickerPanel
              theme={theme}
              isRetroTheme={isRetroTheme}
              spec={spec}
              onAddSticker={(emoji, label) => {
                addSticker({ type: "emoji", label: label || "Sticker", mark: emoji, src: null });
              }}
            />
            
            {/* ── Klipy Stickers (existing) ── */}
            <span className="workspace-tool-label">Klipy</span>
            <div className="sticker-palette" aria-label="Klipy sticker palette">
              {stickerChoices.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => addSticker(sticker)}
                  className={`sticker-button sticker-${sticker.type}`}
                  aria-label={`Add ${sticker.label} sticker`}
                  title={sticker.label}
                >
                  {sticker.src ? <img src={sticker.src} alt="" draggable="false" /> : sticker.mark}
                </button>
              ))}
            </div>

            <span className="workspace-tool-label">Pets</span>
            <div className="pet-palette" aria-label="Pet palette">
              {PET_CHOICES.map((type) => {
                const pet = PET_TYPES[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addPet(type)}
                    className="pet-button"
                    aria-label={`Add ${pet.label}`}
                    title={`Add ${pet.label}`}
                  >
                    <img src={pet.src} alt="" draggable="false" />
                  </button>
                );
              })}
            </div>
            {stickersLoading ? <span className="workspace-status">Loading stickers</span> : null}
          </div>

          <div ref={workspaceCanvasRef} className="diary-canvas" aria-label="Personal diary workspace">
              {false && wallNotes.map((note) => (
                <div
                  key={note.id}
                  className="canvas-note"
                  data-canvas-item="note"
                  style={{
                    background: note.color,
                    left: `${note.x ?? 10}%`,
                    top: `${note.y ?? 18}%`,
                    transform: `rotate(${note.rotate}deg)`,
                  }}
                >
                  <button
                    type="button"
                    className="canvas-drag-handle"
                    onPointerDown={startCanvasDrag("note", note.id)}
                    aria-label="Drag note"
                  >
                    move
                  </button>
                  <textarea
                    value={note.text}
                    onChange={(e) => updateWallNote(note.id, e.target.value)}
                    aria-label="Canvas note"
                    maxLength={120}
                  />
                  <button type="button" className="canvas-remove" onClick={() => removeWallNote(note.id)} aria-label="Remove note">x</button>
                </div>
              ))}
              {stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  data-canvas-item="sticker"
                  className={`canvas-sticker canvas-sticker-${sticker.type || "klipy"} ${sticker.src ? "canvas-sticker-image" : ""}`}
                  onPointerDown={startCanvasDrag("sticker", sticker.id)}
                  onDoubleClick={() => removeSticker(sticker.id)}
                  aria-label={`Drag ${sticker.label || sticker.type || "sticker"} sticker`}
                  title="Drag to move, double-click to remove"
                  style={{
                    left: `${sticker.x}%`,
                    top: `${sticker.y}%`,
                    transform: `rotate(${sticker.rotate}deg)`,
                  }}
                >
                  {sticker.src ? <img src={sticker.src} alt="" draggable="false" /> : (sticker.mark || "*")}
                </button>
              ))}
              {pets.map((pet) => {
                const petSpec = PET_TYPES[pet.type] || PET_TYPES.whiteCat;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    data-canvas-item="pet"
                    className={`canvas-pet ${petMood === "typing" ? "is-typing" : ""}`}
                    onPointerDown={startCanvasDrag("pet", pet.id)}
                    onDoubleClick={() => removePet(pet.id)}
                    aria-label={`Drag ${petSpec.label}`}
                    title="Drag to move, double-click to remove"
                    style={{
                      left: `${pet.x}%`,
                      top: `${pet.y}%`,
                      transform: `rotate(${pet.rotate}deg)`,
                    }}
                  >
                    <img src={petSpec.src} alt="" draggable="false" />
                    <span className="pet-bubble">{petMessage}</span>
                  </button>
                );
              })}

          <section className="diary-book-zone" aria-label="Diary book">
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
              '--font-diary': bodyFont,
              '--rt-font-size': selectedFontSize || undefined,
              '--rt-line-step': rtLineStep,
              '--rt-line-multiplier': lineMultiplier,
              '--rt-lines-offset': '76px',
            }}
          >

            {/* Theme picker moved outside diary */}

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
                onClick={(e) => { if (e.target === e.currentTarget) coverImageInputRef.current?.click(); }}
                style={{
                  position:       "relative",
                  zIndex:         10,
                  background:     coverImage ? "transparent" : spec.coverBg,
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
                {/* Cover background image */}
                {coverImage && (
                  <div
                    style={{
                      position:           "absolute",
                      inset:              0,
                      backgroundImage:    `url(${coverImage})`,
                      backgroundSize:     "cover",
                      backgroundPosition: "center",
                      borderRadius:       "6px",
                      zIndex:             0,
                    }}
                  />
                )}

                {/* Overlay so text stays readable on top of image */}
                {coverImage && (
                  <div
                    style={{
                      position:     "absolute",
                      inset:        0,
                      background:   "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.72) 100%)",
                      borderRadius: "6px",
                      zIndex:       1,
                    }}
                  />
                )}

                {/* Hidden file input */}
                <input
                  ref={coverImageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setCoverImage(ev.target.result);
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />

                {/* 📷 Choose / Change image button — top-right of cover */}
                <button
                  onClick={() => coverImageInputRef.current?.click()}
                  title={coverImage ? "Change cover image" : "Add cover image"}
                  style={{
                    position:      "absolute",
                    top:           "14px",
                    right:         "14px",
                    zIndex:        20,
                    display:       "flex",
                    alignItems:    "center",
                    gap:           "5px",
                    padding:       "6px 12px",
                    borderRadius:  isRetroTheme ? "4px" : "20px",
                    border:        isRetroTheme ? `2px solid #1a1209` : `1.5px solid rgba(255,255,255,0.6)`,
                    background:    coverImage
                      ? "rgba(0,0,0,0.42)"
                      : isRetroTheme
                        ? (spec.navBg || "rgba(255,255,255,0.92)")
                        : "rgba(255,255,255,0.18)",
                    backdropFilter: "blur(4px)",
                    color:         coverImage || !isRetroTheme ? "rgba(255,255,255,0.9)" : spec.textColor,
                    cursor:        "pointer",
                    fontSize:      "11px",
                    fontWeight:    700,
                    letterSpacing: "0.5px",
                    fontFamily:    spec.pageFont,
                    boxShadow:     isRetroTheme ? "2px 2px 0 #1a1209" : "0 2px 8px rgba(0,0,0,0.18)",
                    transition:    "background 0.2s ease",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>📷</span>
                  {coverImage ? "Change" : "Add Photo"}
                </button>

                {/* Remove image button — shown only if image is set */}
                {coverImage && (
                  <button
                    onClick={() => setCoverImage(null)}
                    title="Remove cover image"
                    style={{
                      position:      "absolute",
                      top:           "14px",
                      right:         coverImage ? "126px" : "14px",
                      zIndex:        20,
                      padding:       "6px 10px",
                      borderRadius:  isRetroTheme ? "4px" : "20px",
                      border:        "1.5px solid rgba(255,255,255,0.45)",
                      background:    "rgba(0,0,0,0.35)",
                      backdropFilter: "blur(4px)",
                      color:         "rgba(255,255,255,0.75)",
                      cursor:        "pointer",
                      fontSize:      "11px",
                      fontWeight:    600,
                      fontFamily:    spec.pageFont,
                    }}
                  >
                    ✕
                  </button>
                )}

                {/* All remaining cover content sits above the overlay */}
                <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                  {/* Halftone overlay on cover (retro only, no image) */}
                  {isRetroTheme && !coverImage && (
                    <div
                      style={{
                        position:        "absolute",
                        inset:           "-56px -40px",
                        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)",
                        backgroundSize:  "6px 6px",
                        pointerEvents:   "none",
                        mixBlendMode:    "multiply",
                        opacity:         0.25,
                      }}
                    />
                  )}
                  {/* Decorative lines (no image) */}
                  {!coverImage && (
                    <div
                      style={{
                        position:        "absolute",
                        inset:           "-56px -40px",
                        backgroundImage: `repeating-linear-gradient(transparent, transparent 34px, rgba(255,255,255,0.06) 34px, rgba(255,255,255,0.06) 35px)`,
                        pointerEvents:   "none",
                      }}
                    />
                  )}

                  <div style={{ fontSize: "32px", marginBottom: "14px" }}>
                    <span className={theme === "pixel" ? "pixel-cover-icon" : theme === "kawaii" ? "kawaii-cover-icon" : ""}>
                      {spec.coverIcon || spec.icon}
                    </span>
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Cover title"
                    onInput={(e) => setCoverTitle(e.currentTarget.textContent || "")}
                    style={{
                      fontSize:      isRetroTheme ? "48px" : "32px",
                      fontWeight:    700,
                      fontFamily:    spec.pageFont,
                      letterSpacing: isRetroTheme ? "6px" : "1px",
                      textTransform: isRetroTheme ? "uppercase" : "none",
                      textShadow:    coverImage
                        ? "0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)"
                        : isRetroTheme && theme !== "neon"
                          ? "3px 3px 0px rgba(0,0,0,0.2)"
                          : theme === "neon"
                            ? "0 0 20px currentColor"
                            : "none",
                      color:         coverImage ? "#fff" : spec.coverTitleColor,
                      outline: "none",
                      cursor: "text",
                      textAlign: "center",
                      minWidth: "40%",
                    }}
                  >
                    {coverTitle}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Cover subtitle"
                    onInput={(e) => setCoverSubtitle(e.currentTarget.textContent || "")}
                    style={{
                      marginTop:     "8px",
                      fontSize:      "11px",
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color:         coverImage ? "rgba(255,255,255,0.75)" : spec.coverSubColor,
                      fontFamily:    bodyFont,
                      textShadow:    coverImage ? "0 1px 6px rgba(0,0,0,0.6)" : "none",
                      outline: "none",
                      cursor: "text",
                      textAlign: "center",
                      minWidth: "40%",
                    }}
                  >
                    {coverSubtitle}
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
                      onClick={async () => {
                        // Persist cover as page 0. If this diary is backed by sections (documentId),
                        // create a server-side section and set its order to 0 so it appears as the first page.
                        const initialContent = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
                        if (documentId) {
                          try {
                            const res = await createSection({ variables: { documentId, title: coverTitle || "Cover" } });
                            const sec = res?.data?.createSection;
                            if (sec) {
                              try {
                                await updateSectionContent({ variables: { sectionId: sec.id, contentDoc: JSON.parse(initialContent) } });
                              } catch (e) {
                                // continue even if saving content fails
                              }
                              try {
                                await reorderSection({ variables: { sectionId: sec.id, order: 0 } });
                              } catch (e) {}

                              // Optimistically insert cover locally while server updates propagate
                              const coverPage = {
                                id: sec.id,
                                title: sec.title || coverTitle || "",
                                date: sec.updatedAt || new Date().toISOString(),
                                content: sec.content || initialContent,
                                pageNumber: 0,
                                order: 0,
                              };
                              // mark as just-saved so sections sync won't immediately clobber it
                              justSavedCoverRef.current = sec.id;
                              setPages((p) => [coverPage, ...(p || [])]);
                              setShowCover(false);
                              setPhase("in");
                              timerRef.current = setTimeout(() => setPhase(null), 410);
                              setIndex(0);
                            }
                          } catch (e) {
                            console.warn("failed to create cover section", e);
                          }
                          return;
                        }

                        // Non-backed diary: just add a local cover page
                        const coverPage = {
                          id: `cover-${Date.now()}`,
                          title: coverTitle || "",
                          date: null,
                          content: initialContent,
                          pageNumber: 0,
                        };
                        justSavedCoverRef.current = coverPage.id;
                        setPages((p) => [coverPage, ...(p || [])]);
                        setShowCover(false);
                        setPhase("in");
                        timerRef.current = setTimeout(() => setPhase(null), 410);
                        setIndex(0);
                      }}
                      style={{
                        padding:       "11px 18px",
                        borderRadius:  isRetroTheme ? "4px" : "18px",
                        background:    "transparent",
                        border:        `${isRetroTheme ? "2.5px" : "1.5px"} solid ${isRetroTheme ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)"}`,
                        color:         coverImage ? "#fff" : spec.coverTitleColor,
                        cursor:        "pointer",
                        fontSize:      "13px",
                        fontWeight:    isRetroTheme ? 700 : 400,
                        letterSpacing: "0.3px",
                        fontFamily:    spec.pageFont,
                        boxShadow:     isRetroTheme ? "2px 2px 0 rgba(0,0,0,0.2)" : "none",
                      }}
                    >
                      Save as page 0
                    </button>
                    <button
                      onClick={() => addPage()}
                      style={{
                        padding:       "11px 26px",
                        borderRadius:  isRetroTheme ? "4px" : "24px",
                        background:    "transparent",
                        border:        `${isRetroTheme ? "2.5px" : "1.5px"} solid ${isRetroTheme ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)"}`,
                        color:         coverImage ? "#fff" : spec.coverTitleColor,
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

                {/* Cover page number (0) */}
                <div
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
                    color:       coverImage ? "rgba(255,255,255,0.5)" : spec.pageNumColor,
                    letterSpacing: isRetroTheme ? "2px" : "0",
                    zIndex:      2,
                  }}
                >
                  {isRetroTheme ? `— 0 —` : 0}
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
                  backgroundColor:        spec.pageBg,
                  backgroundImage:       `repeating-linear-gradient(transparent, transparent ${rtLineStep}, ${spec.linesColor} ${rtLineStep}, ${spec.linesColor} calc(${rtLineStep} + 1px))`,
                  backgroundPositionY:   "var(--rt-lines-offset, 76px)",
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

                {/* Margin line (moved left)
                <div
                  style={{
                    position:   "absolute",
                    top: 0, bottom: 0,
                    left:       "36px",
                    width:      isRetroTheme ? "2px" : "1.5px",
                    background: spec.marginLineColor,
                    zIndex:     2,
                  }}
                /> */}

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
                <div className="page-content" style={{ position: "relative", zIndex: 1, paddingLeft: "50px" }}>
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
                      
                    }}
                  >
                    <RichTextEditor
                      value={isJSON(page.content) ? page.content : convertPlainToTipTap(page.content)}
                      disabled={false}
                      onChange={(val) => onEditorChange(page.id || null, val)}
                      globalFontSize={selectedFontSize}
                    />
                  </div>
                </div>

                {/* Page number */}
                {(() => {
                  const displayPageNumber = displayCurrentNumber;
                  return (
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
                      {isRetroTheme ? `— ${displayPageNumber} —` : displayPageNumber}
                    </div>
                  );
                })()}

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
            {isRetroTheme ? `${displayCurrentNumber} / ${totalDisplayCount}` : `${displayCurrentNumber} / ${totalDisplayCount}`}
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

          </section>
          </div>
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
