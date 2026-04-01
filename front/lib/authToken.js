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

  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
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

  window.localStorage.setItem(AUTH_TOKEN_KEY, safeToken);
  window.document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(
    safeToken
  )}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearStoredToken() {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
