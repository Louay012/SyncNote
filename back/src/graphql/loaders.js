import DataLoader from "dataloader";
import Comment from "../models/Comment.js";
import Document from "../models/Document.js";
import Invitation from "../models/Invitation.js";
import Like from "../models/Like.js";
import Section from "../models/Section.js";
import Share from "../models/Share.js";
import User from "../models/User.js";

function groupBy(items, keySelector) {
  const grouped = new Map();

  for (const item of items) {
    const key = String(keySelector(item));
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  }

  return grouped;
}

function mapById(items) {
  const mapped = new Map();

  for (const item of items) {
    if (!item?.id) {
      continue;
    }
    mapped.set(String(item.id), item);
  }

  return mapped;
}

function parseDocumentLikeKey(key) {
  const [documentId, userId] = String(key).split(":");
  return { documentId, userId };
}

export function createLoaders() {
  const usersById = new DataLoader(async (ids) => {
    const users = await User.findByIds(ids);
    const byId = mapById(users);
    return ids.map((id) => byId.get(String(id)) || null);
  });

  const documentsById = new DataLoader(async (ids) => {
    const documents = await Document.findByIds(ids);
    const byId = mapById(documents);
    return ids.map((id) => byId.get(String(id)) || null);
  });

  const sectionsById = new DataLoader(async (ids) => {
    const sections = await Section.findByIds(ids);
    const byId = mapById(sections);
    return ids.map((id) => byId.get(String(id)) || null);
  });

  const sectionsByDocumentId = new DataLoader(async (documentIds) => {
    const sections = await Section.findByDocumentIds(documentIds);
    const byDocumentId = groupBy(sections, (section) => section.documentId);
    return documentIds.map((documentId) => byDocumentId.get(String(documentId)) || []);
  });

  const sharesByDocumentId = new DataLoader(async (documentIds) => {
    const shares = await Share.findByDocumentIds(documentIds);
    const byDocumentId = groupBy(shares, (share) => share.document);
    return documentIds.map((documentId) => byDocumentId.get(String(documentId)) || []);
  });

  const commentsByDocumentId = new DataLoader(async (documentIds) => {
    const comments = await Comment.findByDocumentIds(documentIds);
    const byDocumentId = groupBy(comments, (comment) => comment.document);
    return documentIds.map((documentId) => byDocumentId.get(String(documentId)) || []);
  });

  const likesCountByDocumentId = new DataLoader(async (documentIds) => {
    const counts = await Like.countByDocumentIds(documentIds);
    const countMap = new Map(counts.map((item) => [String(item.documentId), item.total]));
    return documentIds.map((documentId) => countMap.get(String(documentId)) || 0);
  });

  const documentLikedByUser = new DataLoader(async (keys) => {
    const pairs = keys.map(parseDocumentLikeKey);
    const existingPairs = await Like.findExistingPairs(pairs);
    const existing = new Set(
      existingPairs.map((pair) => `${String(pair.documentId)}:${String(pair.userId)}`)
    );

    return keys.map((key) => existing.has(String(key)));
  });

  const invitationsById = new DataLoader(async (ids) => {
    const invitations = await Invitation.findByIds(ids);
    const byId = mapById(invitations);
    return ids.map((id) => byId.get(String(id)) || null);
  });

  return {
    usersById,
    documentsById,
    sectionsById,
    sectionsByDocumentId,
    sharesByDocumentId,
    commentsByDocumentId,
    likesCountByDocumentId,
    documentLikedByUser,
    invitationsById
  };
}
