import { getUserIdFromAuthHeader } from "../utils/auth.js";
import User from "../models/User.js";
import { createLoaders } from "./loaders.js";

export async function buildContext(authHeader, req = null, res = null) {
  const loaders = createLoaders();

  // If authHeader not provided, try to parse cookie from `req` (server-side rendering / browser requests)
  let effectiveAuth = authHeader || "";
  if (!effectiveAuth && req && req.headers && req.headers.cookie) {
    try {
      const cookies = String(req.headers.cookie || "").split(";").map((c) => c.trim());
      for (const c of cookies) {
        if (c.startsWith("syncnote-token=") || c.startsWith("syncnote_token=")) {
          const token = decodeURIComponent(c.split("=")[1] || "");
          if (token) {
            effectiveAuth = `Bearer ${token}`;
            break;
          }
        }
      }
    } catch (e) {
      // ignore cookie parsing errors
    }
  }

  const userId = getUserIdFromAuthHeader(effectiveAuth);
  if (!userId) {
    return { currentUser: null, loaders, req, res };
  }

  const currentUser = await User.findById(userId);
  return { currentUser, loaders, req, res };
}

export function requireAuth(contextValue) {
  if (!contextValue.currentUser) {
    throw new Error("Authentication required");
  }
  return contextValue.currentUser;
}
