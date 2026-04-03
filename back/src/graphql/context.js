import { getUserIdFromAuthHeader } from "../utils/auth.js";
import User from "../models/User.js";
import { createLoaders } from "./loaders.js";

export async function buildContext(authHeader) {
  const loaders = createLoaders();
  const userId = getUserIdFromAuthHeader(authHeader);
  if (!userId) {
    return { currentUser: null, loaders };
  }

  const currentUser = await User.findById(userId);
  return { currentUser, loaders };
}

export function requireAuth(contextValue) {
  if (!contextValue.currentUser) {
    throw new Error("Authentication required");
  }
  return contextValue.currentUser;
}
