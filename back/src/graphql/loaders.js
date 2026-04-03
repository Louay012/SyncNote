import DataLoader from "dataloader";
import Comment from "../models/Comment.js";
import Document from "../models/Document.js";
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

  return {
    usersById,
    documentsById,
    sectionsById,
    sectionsByDocumentId,
    sharesByDocumentId,
    commentsByDocumentId
  };
}
