const CURSOR_PALETTE = [
  { bg: "#ff6b6b", fg: "#ffffff", border: "#b82525" },
  { bg: "#4dabf7", fg: "#ffffff", border: "#1f6aa8" },
  { bg: "#51cf66", fg: "#0f3d1d", border: "#2b8a3e" },
  { bg: "#fcc419", fg: "#4a3700", border: "#c99700" },
  { bg: "#9775fa", fg: "#ffffff", border: "#5f3dc4" },
  { bg: "#ff922b", fg: "#4a2700", border: "#d97706" },
  { bg: "#22b8cf", fg: "#07353c", border: "#0c8599" },
  { bg: "#f06595", fg: "#57132a", border: "#c2255c" }
];

function hashUserId(userId) {
  const text = String(userId || "");
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getCursorColor(userId) {
  const index = hashUserId(userId) % CURSOR_PALETTE.length;
  return CURSOR_PALETTE[index];
}
