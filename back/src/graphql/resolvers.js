import { GraphQLScalarType, Kind } from "graphql";
import { withFilter } from "graphql-subscriptions";
import Comment from "../models/Comment.js";
import Document from "../models/Document.js";
import Section from "../models/Section.js";
import Share from "../models/Share.js";
import User from "../models/User.js";
import Version from "../models/Version.js";
import { requireAuth } from "./context.js";
import {
  EVENTS,
  getPresence,
  leavePresence,
  pubsub,
  touchPresence
} from "./pubsub.js";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";
import {
  canAccessDocument,
  canEditDocument,
  ensureDocumentAccess,
  ensureDocumentOwner,
  ensureObjectId,
  ensureSectionAccess,
  ensureSectionEditAccess
} from "../utils/permissions.js";

const DOCUMENT_LIST_LIMIT_MIN = 1;
const DOCUMENT_LIST_LIMIT_MAX = 100;

function normalizeDocumentListArgs(args = {}) {
  const limit = Math.min(
    Math.max(Number(args.limit) || 20, DOCUMENT_LIST_LIMIT_MIN),
    DOCUMENT_LIST_LIMIT_MAX
  );
  const offset = Math.max(Number(args.offset) || 0, 0);

  return {
    limit,
    offset,
    sortBy: args.sortBy || "UPDATED_AT",
    sortDirection: args.sortDirection || "DESC"
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function requireNonEmpty(value, fieldName) {
  if (!String(value || "").trim()) {
    throw new Error(`${fieldName} is required`);
  }
}

function ensureUuid(value, fieldName = "id") {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || "")
    )
  ) {
    throw new Error(`Invalid ${fieldName}`);
  }
}

function validateRegisterInput({ name, email, password }) {
  requireNonEmpty(name, "Name");
  requireNonEmpty(email, "Email");
  requireNonEmpty(password, "Password");

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Invalid email format");
  }

  if (String(password).length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
}

function validateTextInput(text, fieldName, max = 2000) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  if (normalized.length > max) {
    throw new Error(`${fieldName} is too long`);
  }

  return normalized;
}

function validateSectionTitle(title) {
  return validateTextInput(title, "Section title", 120);
}

function validateSectionContent(content) {
  const normalized = String(content ?? "");
  if (normalized.length > 100_000) {
    throw new Error("Section content is too long");
  }
  return normalized;
}

function parseVersionSnapshot(snapshotValue) {
  if (!snapshotValue) {
    return {};
  }

  if (typeof snapshotValue === "string") {
    try {
      return JSON.parse(snapshotValue);
    } catch {
      throw new Error("Version snapshot is invalid JSON");
    }
  }

  return snapshotValue;
}

function dateValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid Date value");
  }
  return parsed.toISOString();
}

function firstRootSection(sections = []) {
  return sections
    .filter((section) => section.parentId === null)
    .sort((a, b) => a.order - b.order)[0];
}

async function syncLegacyDocumentContent(documentId) {
  const sections = await Section.findByDocumentId(documentId);
  const root = firstRootSection(sections);

  await Document.findByIdAndUpdate(
    documentId,
    { content: root?.content || "" },
    { new: true }
  );

  return sections;
}

function withActor(section, userId) {
  if (!section) {
    return section;
  }

  return {
    ...section,
    updatedById: String(userId)
  };
}

export const resolvers = {
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "ISO-8601 DateTime",
    serialize: dateValue,
    parseValue: dateValue,
    parseLiteral(ast) {
      if (ast.kind !== Kind.STRING) {
        throw new Error("DateTime must be a string");
      }
      return dateValue(ast.value);
    }
  }),

  Query: {
    me: async (_, __, contextValue) => contextValue.currentUser,

    document: async (_, { id }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(id, "document id");
      await ensureDocumentAccess(user.id, id);

      const document = await Document.findById(id);
      if (!document) {
        return null;
      }

      await Section.ensureDefaults(id, document.content || "");
      return document;
    },

    myDocuments: async (_, args, contextValue) => {
      const user = requireAuth(contextValue);
      return Document.findByOwner(user.id, normalizeDocumentListArgs(args));
    },

    sharedWithMeDocuments: async (_, args, contextValue) => {
      const user = requireAuth(contextValue);
      return Document.findSharedWithUser(
        user.id,
        normalizeDocumentListArgs(args)
      );
    },

    searchDocuments: async (_, { keyword, ...args }, contextValue) => {
      const user = requireAuth(contextValue);
      const normalizedKeyword = String(keyword || "").trim();
      if (normalizedKeyword.length < 2) {
        throw new Error("Keyword must have at least 2 characters");
      }

      return Document.searchAccessible(
        user.id,
        normalizedKeyword,
        normalizeDocumentListArgs(args)
      );
    },

    getSections: async (_, { documentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user.id, documentId);

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      await Section.ensureDefaults(documentId, document.content || "");
      return Section.findByDocumentId(documentId);
    },

    getVersions: async (_, { documentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user.id, documentId);
      return Version.findByDocument(documentId);
    },

    commentsBySection: async (_, { sectionId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(sectionId, "section id");
      await ensureSectionAccess(user.id, sectionId);
      return Comment.find({ section: sectionId });
    },

    documentPresence: async (_, { documentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user.id, documentId);
      return getPresence(documentId);
    }
  },

  Mutation: {
    register: async (_, { name, email, password }) => {
      validateRegisterInput({ name, email, password });
      const normalizedEmail = normalizeEmail(email);
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        throw new Error("Email is already registered");
      }

      const hashedPassword = await hashPassword(password);
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword
      });

      return {
        token: signToken(user.id),
        user
      };
    },

    login: async (_, { email, password }) => {
      const normalizedEmail = normalizeEmail(email);
      requireNonEmpty(normalizedEmail, "Email");
      requireNonEmpty(password, "Password");

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        throw new Error("Invalid email or password");
      }

      const validPassword = await comparePassword(password, user.password);
      if (!validPassword) {
        throw new Error("Invalid email or password");
      }

      return {
        token: signToken(user.id),
        user
      };
    },

    updateProfile: async (_, { name }, contextValue) => {
      const user = requireAuth(contextValue);
      if (name !== undefined) {
        requireNonEmpty(name, "Name");
      }

      return User.findByIdAndUpdate(
        user.id,
        { ...(name ? { name: name.trim() } : {}) },
        { new: true }
      );
    },

    createDocument: async (_, { title, content = "" }, contextValue) => {
      const user = requireAuth(contextValue);
      const safeTitle = validateTextInput(title, "Title", 160);

      const document = await Document.create({
        title: safeTitle,
        content: String(content || ""),
        owner: user.id
      });

      await Section.ensureDefaults(document.id, String(content || ""));
      return document;
    },

    updateDocument: async (_, { id, title, content }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(id, "document id");

      if (!(await canEditDocument(user.id, id))) {
        throw new Error("You do not have permission to edit this document");
      }

      const updates = {};

      if (typeof title === "string") {
        updates.title = validateTextInput(title, "Title", 160);
      }

      if (typeof content === "string") {
        updates.content = validateSectionContent(content);
      }

      if (!Object.keys(updates).length) {
        throw new Error("At least one field (title or content) must be provided");
      }

      const document = await Document.findByIdAndUpdate(id, updates, {
        new: true
      });

      if (!document) {
        throw new Error("Document not found");
      }

      if (typeof content === "string") {
        await Section.ensureDefaults(id, content);
        const sections = await Section.findByDocumentId(id);
        const root = firstRootSection(sections);

        if (root) {
          const updatedRoot = await Section.updateContent(root.id, content);
          await pubsub.publish(EVENTS.SECTION_UPDATED, {
            sectionUpdated: withActor(updatedRoot, user.id),
            documentId: id
          });
        }
      }

      return document;
    },

    createSection: async (_, { documentId, title, parentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");

      if (!(await canEditDocument(user.id, documentId))) {
        throw new Error("You do not have permission to edit this document");
      }

      let safeParentId = null;

      if (parentId !== null && parentId !== undefined) {
        ensureObjectId(parentId, "parent section id");
        const parent = await ensureSectionEditAccess(user.id, parentId);

        if (String(parent.documentId) !== String(documentId)) {
          throw new Error("Parent section belongs to a different document");
        }

        if (parent.parentId !== null) {
          throw new Error("Cannot add subsection to another subsection");
        }

        safeParentId = parent.id;
      }

      const created = await Section.create({
        documentId,
        title: validateSectionTitle(title),
        parentId: safeParentId,
        content: ""
      });

      await syncLegacyDocumentContent(documentId);
      const payload = withActor(created, user.id);

      await pubsub.publish(EVENTS.SECTION_UPDATED, {
        sectionUpdated: payload,
        documentId: created.documentId
      });

      return payload;
    },

    updateSection: async (_, { sectionId, title, content }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(sectionId, "section id");
      await ensureSectionEditAccess(user.id, sectionId);

      const updates = {};

      if (typeof title === "string") {
        updates.title = validateSectionTitle(title);
      }

      if (typeof content === "string") {
        updates.content = validateSectionContent(content);
      }

      if (!Object.keys(updates).length) {
        throw new Error("At least one field (title or content) must be provided");
      }

      const updatedSection = await Section.updateById(sectionId, updates);
      if (!updatedSection) {
        throw new Error("Section not found");
      }

      await syncLegacyDocumentContent(updatedSection.documentId);

      const payload = withActor(updatedSection, user.id);
      const presenceState = touchPresence({
        documentId: updatedSection.documentId,
        user,
        sectionId: updatedSection.id,
        sectionTitle: updatedSection.title
      });

      await Promise.all([
        pubsub.publish(EVENTS.SECTION_UPDATED, {
          sectionUpdated: payload,
          documentId: updatedSection.documentId
        }),
        pubsub.publish(EVENTS.USER_PRESENCE_CHANGED, {
          userPresenceChanged: presenceState,
          documentId: updatedSection.documentId
        })
      ]);

      return payload;
    },

    deleteSection: async (_, { sectionId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(sectionId, "section id");
      const section = await ensureSectionEditAccess(user.id, sectionId);

      const deleted = await Section.deleteById(sectionId);
      if (!deleted) {
        return true;
      }

      await Section.ensureDefaults(section.documentId, "");
      const sections = await syncLegacyDocumentContent(section.documentId);
      const first = sections[0] || null;

      if (first) {
        await pubsub.publish(EVENTS.SECTION_UPDATED, {
          sectionUpdated: withActor(first, user.id),
          documentId: section.documentId
        });
      }

      return true;
    },

    reorderSection: async (_, { sectionId, order }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(sectionId, "section id");
      await ensureSectionEditAccess(user.id, sectionId);

      const reordered = await Section.reorder(sectionId, order);
      if (!reordered) {
        throw new Error("Section not found");
      }

      await syncLegacyDocumentContent(reordered.documentId);
      const payload = withActor(reordered, user.id);

      await pubsub.publish(EVENTS.SECTION_UPDATED, {
        sectionUpdated: payload,
        documentId: reordered.documentId
      });

      return payload;
    },

    saveVersion: async (_, { documentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");

      if (!(await canEditDocument(user.id, documentId))) {
        throw new Error("You do not have permission to save versions for this document");
      }

      const snapshot = await Section.snapshotForDocument(documentId);
      return Version.create({
        documentId,
        snapshot,
        createdBy: user.id
      });
    },

    restoreVersion: async (_, { versionId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureUuid(versionId, "version id");

      const version = await Version.findById(versionId);
      if (!version) {
        throw new Error("Version not found");
      }

      if (!(await canEditDocument(user.id, version.documentId))) {
        throw new Error("You do not have permission to restore this version");
      }

      const snapshot = parseVersionSnapshot(version.snapshotRaw);
      const updatedSections = await Section.applySnapshot(version.documentId, snapshot);

      await syncLegacyDocumentContent(version.documentId);

      await Promise.all(
        updatedSections.map((sectionItem) =>
          pubsub.publish(EVENTS.SECTION_UPDATED, {
            sectionUpdated: withActor(sectionItem, user.id),
            documentId: sectionItem.documentId
          })
        )
      );

      return Document.findById(version.documentId);
    },

    deleteDocument: async (_, { id }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(id, "document id");
      await ensureDocumentOwner(user.id, id);

      await Promise.all([
        Document.findByIdAndDelete(id),
        Comment.deleteMany({ document: id }),
        Version.deleteMany({ document: id }),
        Share.deleteMany({ document: id })
      ]);

      return true;
    },

    addComment: async (_, { sectionId, content }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(sectionId, "section id");
      const section = await ensureSectionAccess(user.id, sectionId);

      const safeText = validateTextInput(content, "Comment", 4000);

      const comment = await Comment.create({
        text: safeText,
        author: user.id,
        section: sectionId
      });

      await pubsub.publish(EVENTS.COMMENT_ADDED, {
        commentAdded: comment,
        sectionId: String(sectionId),
        documentId: section.documentId
      });

      return comment;
    },

    shareDocument: async (
      _,
      { documentId, userEmail, permission = "EDIT" },
      contextValue
    ) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");

      await ensureDocumentOwner(user.id, documentId);

      const normalizedEmail = normalizeEmail(userEmail);
      requireNonEmpty(normalizedEmail, "User email");

      const collaborator = await User.findOne({ email: normalizedEmail });

      if (!collaborator) {
        throw new Error("Collaborator not found");
      }

      if (String(collaborator.id) === String(user.id)) {
        throw new Error("Owner already has access");
      }

      if (!["VIEW", "EDIT"].includes(permission)) {
        throw new Error("Permission must be VIEW or EDIT");
      }

      return Share.findOneAndUpdate(
        { document: documentId, user: collaborator.id },
        { permission },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    },

    unshareDocument: async (_, { documentId, userEmail }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentOwner(user.id, documentId);

      const normalizedEmail = normalizeEmail(userEmail);
      requireNonEmpty(normalizedEmail, "User email");

      const collaborator = await User.findOne({ email: normalizedEmail });
      if (!collaborator) {
        return true;
      }

      return Share.deleteOne({ document: documentId, user: collaborator.id });
    },

    updateTypingStatus: async (
      _,
      { documentId, sectionId, isTyping },
      contextValue
    ) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user.id, documentId);

      let safeSectionId = null;
      let sectionTitle = null;

      if (sectionId !== null && sectionId !== undefined) {
        ensureObjectId(sectionId, "section id");
        const section = await ensureSectionAccess(user.id, sectionId);
        safeSectionId = section.id;
        sectionTitle = section.title;
      }

      const presenceState = touchPresence({
        documentId,
        user,
        sectionId: safeSectionId,
        sectionTitle
      });

      const payload = {
        documentId: String(documentId),
        userId: String(user.id),
        sectionId: safeSectionId,
        sectionTitle,
        isTyping: Boolean(isTyping),
        at: new Date().toISOString()
      };

      await Promise.all([
        pubsub.publish(EVENTS.USER_TYPING, {
          userTyping: payload,
          documentId: String(documentId)
        }),
        pubsub.publish(EVENTS.USER_PRESENCE_CHANGED, {
          userPresenceChanged: presenceState,
          documentId: String(documentId)
        })
      ]);

      return payload;
    },

    updatePresence: async (_, { documentId, sectionId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user.id, documentId);

      let safeSectionId = null;
      let sectionTitle = null;

      if (sectionId !== null && sectionId !== undefined) {
        ensureObjectId(sectionId, "section id");
        const section = await ensureSectionAccess(user.id, sectionId);
        safeSectionId = section.id;
        sectionTitle = section.title;
      }

      const presenceState = touchPresence({
        documentId,
        user,
        sectionId: safeSectionId,
        sectionTitle
      });

      await pubsub.publish(EVENTS.USER_PRESENCE_CHANGED, {
        userPresenceChanged: presenceState,
        documentId: String(documentId)
      });

      return presenceState;
    },

    leaveDocument: async (_, { documentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user.id, documentId);

      const presenceState = leavePresence({
        documentId,
        userId: user.id
      });

      await pubsub.publish(EVENTS.USER_PRESENCE_CHANGED, {
        userPresenceChanged: presenceState,
        documentId: String(documentId)
      });

      return true;
    }
  },

  Subscription: {
    sectionUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([EVENTS.SECTION_UPDATED]),
        async ({ documentId }, { documentId: incomingId }, contextValue) => {
          const user = requireAuth(contextValue);
          return (
            String(documentId) === String(incomingId) &&
            (await canAccessDocument(user.id, documentId))
          );
        }
      )
    },

    commentAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([EVENTS.COMMENT_ADDED]),
        async ({ sectionId, documentId }, { sectionId: incomingId }, contextValue) => {
          const user = requireAuth(contextValue);
          return (
            String(sectionId) === String(incomingId) &&
            (await canAccessDocument(user.id, documentId))
          );
        }
      )
    },

    userTyping: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([EVENTS.USER_TYPING]),
        async ({ documentId }, { documentId: incomingId }, contextValue) => {
          const user = requireAuth(contextValue);
          return (
            String(documentId) === String(incomingId) &&
            (await canAccessDocument(user.id, documentId))
          );
        }
      )
    },

    userPresenceChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([EVENTS.USER_PRESENCE_CHANGED]),
        async ({ documentId }, { documentId: incomingId }, contextValue) => {
          const user = requireAuth(contextValue);
          return (
            String(documentId) === String(incomingId) &&
            (await canAccessDocument(user.id, documentId))
          );
        }
      )
    }
  },

  Document: {
    owner: async (doc) => User.findById(doc.owner),

    content: async (doc) => {
      const sections = await Section.findByDocumentId(doc.id);
      const root = firstRootSection(sections);
      return root?.content ?? doc.content ?? "";
    },

    collaborators: async (doc) => {
      const shares = await Share.find({ document: doc.id });
      const userIds = shares.map((share) => share.user);
      return User.findByIds(userIds);
    },

    sections: async (doc) => {
      await Section.ensureDefaults(doc.id, doc.content || "");
      return Section.findByDocumentId(doc.id);
    },

    comments: async (doc) => Comment.find({ document: doc.id })
  },

  Section: {
    updatedBy: async (section) => {
      if (!section.updatedById) {
        return null;
      }

      return User.findById(section.updatedById);
    }
  },

  Comment: {
    author: async (comment) => User.findById(comment.author),
    section: async (comment) => Section.findById(comment.section)
  },

  Share: {
    user: async (share) => User.findById(share.user),
    document: async (share) => Document.findById(share.document)
  },

  Version: {
    createdBy: async (version) => User.findById(version.createdBy)
  },

  Presence: {
    user: async (presence) => User.findById(presence.userId)
  },

  TypingEvent: {
    user: async (typingEvent) => User.findById(typingEvent.userId)
  }
};
