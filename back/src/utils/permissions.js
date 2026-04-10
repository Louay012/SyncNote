import Document from "../models/Document.js";
import Section from "../models/Section.js";
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
  // Public documents are readable by anyone (including unauthenticated users).
  if (document.isPublic) {
    return true;
  }

  if (userId == null) {
    return false;
  }

  if (String(document.owner) === String(userId)) {
    return true;
  }

  const share = await Share.findOne({ document: documentId, user: userId });
  return Boolean(share);
}

export async function canEditDocument(userId, documentId) {
  const document = await Document.findById(documentId);
  if (!document) {
    return false;
  }

  if (String(document.owner) === String(userId)) {
    return true;
  }

  const share = await Share.findOne({
    document: documentId,
    user: userId,
    permission: "EDIT"
  });

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

export async function ensureSectionExists(sectionId) {
  const section = await Section.findById(sectionId);
  if (!section) {
    throw new Error("Section not found");
  }
  return section;
}

export async function ensureSectionAccess(userId, sectionId) {
  const section = await ensureSectionExists(sectionId);
  await ensureDocumentAccess(userId, section.documentId);
  return section;
}

export async function ensureSectionEditAccess(userId, sectionId) {
  const section = await ensureSectionExists(sectionId);
  const editable = await canEditDocument(userId, section.documentId);
  if (!editable) {
    throw new Error("You do not have permission to edit this section");
  }
  return section;
}
