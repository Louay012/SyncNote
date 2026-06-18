// ─── Frontend Sticker Service ─────────────────────────────────────────────────
// Provides client-side sticker catalog (emoji + themed packs) and helpers
// for the diary workspace.

// ─── Emoji Sticker Groups ─────────────────────────────────────────────────────
export const EMOJI_GROUPS = [
  { id: "all", label: "All", icon: "🌀" },
  { id: "nature", label: "Nature", icon: "🌸" },
  { id: "animals", label: "Animals", icon: "🐱" },
  { id: "hearts", label: "Hearts", icon: "❤️" },
  { id: "faces", label: "Faces", icon: "😊" },
  { id: "food", label: "Food", icon: "🍕" },
  { id: "objects", label: "Objects", icon: "📖" },
  { id: "symbols", label: "Symbols", icon: "✦" },
  { id: "sky", label: "Sky", icon: "🌙" },
];

// ─── Emoji Stickers by Category ───────────────────────────────────────────────
const STICKER_DB = {
  nature: ["🌸","🌺","🌻","🌷","🌹","🌿","🍀","🌵","🌴","🌲","🍁","🌾","🌼"],
  animals: ["🐱","🐶","🐰","🦊","🐼","🐨","🦁","🐯","🐸","🐵","🦄","🐴","🐝","🦋","🐌","🐞","🐧","🦉","🐺","🦌"],
  sky: ["🌟","⭐","🌙","☀️","🌈","☁️","❄️","🌊","🔥","🌍","🌕","🌛","✨","💫"],
  hearts: ["❤️","💕","💗","💖","💓","🩷","🧡","💛","💚","💙","💜","🖤","💔","💝","💘","💞"],
  faces: ["😊","🥰","😍","🤩","😌","😇","🥹","😢","😭","😤","😡","🥳","🤗","😴","🥺","😅","😂"],
  food: ["🍎","🍊","🍋","🍇","🍓","🍑","🍒","🥝","🍕","🍔","🌮","🍦","🍩","🍪","🧁","🍫","🥐","☕","🧋","🍵"],
  objects: ["📕","📗","📘","📙","📚","📖","✏️","🖊️","🖋️","✒️","🖌️","📝","📎","📌","✂️","🎨"],
  symbols: ["✦","✧","◆","◇","♡","♥","★","☆","✶","❀","✿","🎀","✨","💫","🎈","🎉","🎊","🎁","🌈","💎","🔮","🪄","🎯","🧩","🎲"],
};

// ─── Themed Sticker Packs ─────────────────────────────────────────────────────
export const STICKER_PACKS = [
  {
    id: "pack-kawaii",
    label: "Kawaii",
    icon: "♡",
    stickers: ["🐱","🐰","🐻","🐼","🦊","🦄","💖","✨","🧁","🌈"],
  },
  {
    id: "pack-retro",
    label: "Retro Diner",
    icon: "☕",
    stickers: ["💿","📼","☎️","📷","📺","📻","⏰","🪙","🕹️","🎞️"],
  },
  {
    id: "pack-nature",
    label: "Nature Walk",
    icon: "🌿",
    stickers: ["🌿","🌳","🌸","🌻","🍄","🦋","🐞","🐌","☀️","🌈"],
  },
  {
    id: "pack-pixel",
    label: "Pixel Art",
    icon: "◆",
    stickers: ["⭐","❤️","🪙","⚔️","🗝️","👑","💎","🔥","💀","🚩"],
  },
  {
    id: "pack-mood",
    label: "Mood Tracker",
    icon: "😊",
    stickers: ["😊","🥰","😎","😢","😤","😴","🤪","🥺","🙏","🥳"],
  },
  {
    id: "pack-food",
    label: "Food & Drink",
    icon: "🍕",
    stickers: ["🍕","🍔","🍣","🎂","🍦","🍩","🍪","☕","🍵","🧋"],
  },
  {
    id: "pack-travel",
    label: "Travel & Adventure",
    icon: "✈️",
    stickers: ["✈️","🌍","🧭","🗺️","📸","🌅","🌴","⛰️","⛺","🧳"],
  },
  {
    id: "pack-celebration",
    label: "Celebration",
    icon: "🎉",
    stickers: ["🎉","🎊","🎈","🎁","🎂","✨","🏆","🥇","🎆","🌟"],
  },
  {
    id: "pack-art",
    label: "Art & Creativity",
    icon: "🎨",
    stickers: ["🎨","✏️","🖊️","🖌️","📷","🎵","🎤","🎬","✂️","👓"],
  },
  {
    id: "pack-space",
    label: "Space & Galaxy",
    icon: "🌙",
    stickers: ["🌙","⭐","🪐","🚀","🛰️","☄️","🛸","🧑‍🚀","💫","🌌"],
  },
  {
    id: "pack-ocean",
    label: "Ocean & Beach",
    icon: "🌊",
    stickers: ["🌊","🐟","🐬","🐳","🐙","🐚","🪸","⭐","🏖️","🌅"],
  },
];

// ─── All stickers flat for search ─────────────────────────────────────────────
const ALL_STICKER_EMOJIS = new Set();
Object.values(STICKER_DB).forEach(arr => arr.forEach(e => ALL_STICKER_EMOJIS.add(e)));
STICKER_PACKS.forEach(pack => pack.stickers.forEach(e => ALL_STICKER_EMOJIS.add(e)));

export const ALL_STICKERS = [...ALL_STICKER_EMOJIS];

/**
 * Search stickers by keyword (emoji name, category, etc.)
 */
export function searchStickers(query) {
  if (!query || query.trim() === "") return ALL_STICKERS.slice(0, 60);
  const q = query.toLowerCase().trim();
  // Search by emoji groups and tags
  const results = new Set();
  for (const [group, emojis] of Object.entries(STICKER_DB)) {
    if (group.includes(q)) {
      emojis.forEach(e => results.add(e));
    }
  }
  for (const pack of STICKER_PACKS) {
    if (pack.label.toLowerCase().includes(q) || pack.id.toLowerCase().includes(q)) {
      pack.stickers.forEach(e => results.add(e));
    }
  }
  // If no results, return some matching by unicode name heuristics
  if (results.size === 0) {
    ALL_STICKERS.slice(0, 40).forEach(e => results.add(e));
  }
  return [...results];
}

/**
 * Get stickers by group
 */
export function getStickersByGroup(group) {
  if (group === "all" || !group) {
    return ALL_STICKERS.slice(0, 60);
  }
  return STICKER_DB[group] || ALL_STICKERS.slice(0, 30);
}

/**
 * Get unique color for sticker group
 */
export function getGroupColor(group) {
  const colors = {
    nature: "#4ade80",
    animals: "#fbbf24",
    sky: "#60a5fa",
    hearts: "#f472b6",
    faces: "#fb923c",
    food: "#f97316",
    objects: "#a78bfa",
    symbols: "#34d399",
    all: "#6b7280",
  };
  return colors[group] || "#6b7280";
}

export default {
  EMOJI_GROUPS,
  STICKER_PACKS,
  ALL_STICKERS,
  searchStickers,
  getStickersByGroup,
  getGroupColor,
};