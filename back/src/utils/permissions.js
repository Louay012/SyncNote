import Document from "../models/Document.js";
import Share from "../models/Share.js";

export function ensureObjectId(id, fieldName = "id") {
  if (!/^\d+$/.test(String(id))) {
    throw new Error(`Invalid ${fieldName}`);
  }
}

export async function ensureDocumentExists(documentId) {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Document not found");
  }
  return document;
}

export async function canAccessDocument(userId, documentId) {
  const document = await Document.findById(documentId);
  if (!document) {
    return false;
  }

  if (String(document.owner) === String(userId)) {
    return true;
  }

  const share = await Share.findOne({ document: documentId, user: userId });
  return Boolean(share);
}

export async function ensureDocumentAccess(userId, documentId) {
  const hasAccess = await canAccessDocument(userId, documentId);
  if (!hasAccess) {
    throw new Error("You do not have access to this document");
  }
}

export async function ensureDocumentOwner(userId, documentId) {
  const document = await ensureDocumentExists(documentId);
  if (String(document.owner) !== String(userId)) {
    throw new Error("Only the document owner can perform this action");
  }
  return document;
}
