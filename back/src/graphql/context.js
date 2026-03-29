import { getUserIdFromAuthHeader } from "../utils/auth.js";
import User from "../models/User.js";

export async function buildContext(authHeader) {
  const userId = getUserIdFromAuthHeader(authHeader);
  if (!userId) {
    return { currentUser: null };
  }

  const currentUser = await User.findById(userId).select("_id name email");
  return { currentUser };
}

export function requireAuth(contextValue) {
  if (!contextValue.currentUser) {
    throw new Error("Authentication required");
  }
  return contextValue.currentUser;
}
