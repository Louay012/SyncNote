import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

const PRESENCE_TTL_MS = 45_000;
const presenceByDocument = new Map();

function getDocumentPresenceMap(documentId, create = false) {
  const key = String(documentId);
  if (!presenceByDocument.has(key) && create) {
    presenceByDocument.set(key, new Map());
  }
  return presenceByDocument.get(key) || null;
}

function prunePresence(documentId) {
  const map = getDocumentPresenceMap(documentId, false);
  if (!map) {
    return;
  }

  const now = Date.now();
  for (const [userId, item] of map.entries()) {
    if (now - item.lastSeen > PRESENCE_TTL_MS) {
      map.delete(userId);
    }
  }

  if (map.size === 0) {
    presenceByDocument.delete(String(documentId));
  }
}

function serializePresence(documentId) {
  prunePresence(documentId);
  const map = getDocumentPresenceMap(documentId, false);
  if (!map) {
    return [];
  }

  return Array.from(map.values()).map((item) => ({
    documentId: String(documentId),
    userId: String(item.userId),
    sectionId: item.sectionId,
    sectionTitle: item.sectionTitle,
    updatedAt: new Date(item.lastSeen).toISOString()
  }));
}

export function touchPresence({ documentId, user, sectionId = null, sectionTitle = "" }) {
  const map = getDocumentPresenceMap(documentId, true);
  map.set(String(user.id), {
    userId: String(user.id),
    sectionId:
      sectionId !== null && sectionId !== undefined ? String(sectionId) : null,
    sectionTitle: String(sectionTitle || ""),
    lastSeen: Date.now()
  });

  return serializePresence(documentId);
}

export function leavePresence({ documentId, userId }) {
  const map = getDocumentPresenceMap(documentId, false);
  if (!map) {
    return [];
  }

  map.delete(String(userId));
  return serializePresence(documentId);
}

export function getPresence(documentId) {
  return serializePresence(documentId);
}

export const EVENTS = {
  SECTION_UPDATED: "SECTION_UPDATED",
  COMMENT_ADDED: "COMMENT_ADDED",
  USER_TYPING: "USER_TYPING",
  USER_PRESENCE_CHANGED: "USER_PRESENCE_CHANGED",
  USER_NOTIFICATION_RECEIVED: "USER_NOTIFICATION_RECEIVED"
};
