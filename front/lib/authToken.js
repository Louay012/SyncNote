export const AUTH_TOKEN_KEY = "syncnote-token";
export const AUTH_COOKIE_NAME = "syncnote-token";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function hasWindow() {
  return typeof window !== "undefined";
}

export function getStoredToken() {
  if (!hasWindow()) {
    return "";
  }

  // Be tolerant of old key variants (dash vs underscore) to avoid breaking
  // in-browser tokens set by older instructions or tooling.
  const altKey = AUTH_TOKEN_KEY.replace("-", "_");
  return (
    window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(altKey) || ""
  );
}

export function setStoredToken(token) {
  if (!hasWindow()) {
    return;
  }

  const safeToken = String(token || "").trim();

  if (!safeToken) {
    clearStoredToken();
    return;
  }

  // Set both canonical and underscore variants for compatibility.
  const altKey = AUTH_TOKEN_KEY.replace("-", "_");
  window.localStorage.setItem(AUTH_TOKEN_KEY, safeToken);
  window.localStorage.setItem(altKey, safeToken);
  window.document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(
    safeToken
  )}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearStoredToken() {
  if (!hasWindow()) {
    return;
  }
  const altKey = AUTH_TOKEN_KEY.replace("-", "_");
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(altKey);
  window.document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
