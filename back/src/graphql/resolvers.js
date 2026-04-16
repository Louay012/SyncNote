import crypto from "node:crypto";
import { GraphQLScalarType, Kind } from "graphql";
import { withFilter } from "graphql-subscriptions";
import { env } from "../config/env.js";
import * as Y from "yjs";
import { query as dbQuery } from "../db/postgres.js";
import Comment from "../models/Comment.js";
import Document from "../models/Document.js";
import Invitation from "../models/Invitation.js";
import Like from "../models/Like.js";
import Notification from "../models/Notification.js";
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
  buildPasswordResetEmail,
  buildVerificationEmail,
  isEmailDeliveryEnabled,
  sendTransactionalEmail
} from "../utils/email.js";
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
const EMAIL_VERIFY_TOKEN_TTL_MINUTES = 24 * 60;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;

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

function validatePasswordValue(password, fieldName = "Password") {
  requireNonEmpty(password, fieldName);
  const normalized = String(password);

  if (normalized.length < 8) {
    throw new Error(`${fieldName} must be at least 8 characters long`);
  }

  if (normalized.length > 128) {
    throw new Error(`${fieldName} is too long`);
  }

  return normalized;
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

function tokenExpiresAt(minutesFromNow) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function appRoute(pathname) {
  const baseUrl = String(env.appUrl || "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}${pathname}`;
}

function parseExpiresToMs(expires) {
  if (!expires) return undefined;
  const s = String(expires).trim();
  const m = s.match(/^(\d+)\s*([smhd])$/i);
  if (m) {
    const n = Number(m[1]);
    const u = m[2].toLowerCase();
    const mul = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[u] || 1000;
    return n * mul;
  }
  // fallback: try parse seconds
  const asNum = Number(s);
  if (Number.isFinite(asNum)) return asNum * 1000;
  return undefined;
}

async function createEmailVerificationToken(userId) {
  const token = generateSecureToken();
  const expiresAt = tokenExpiresAt(EMAIL_VERIFY_TOKEN_TTL_MINUTES);

  await dbQuery(
    "DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );

  await dbQuery(
    `
      INSERT INTO email_verification_tokens(user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, token, expiresAt]
  );

  return token;
}

async function consumeEmailVerificationToken(token) {
  const { rows } = await dbQuery(
    `
      UPDATE email_verification_tokens
      SET used_at = NOW()
      WHERE token = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
    `,
    [token]
  );

  return rows[0]?.user_id ? String(rows[0].user_id) : null;
}

async function createPasswordResetToken(userId) {
  const token = generateSecureToken();
  const expiresAt = tokenExpiresAt(PASSWORD_RESET_TOKEN_TTL_MINUTES);

  await dbQuery(
    "DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );

  await dbQuery(
    `
      INSERT INTO password_reset_tokens(user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, token, expiresAt]
  );

  return token;
}

async function consumePasswordResetToken(token) {
  const { rows } = await dbQuery(
    `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
    `,
    [token]
  );

  return rows[0]?.user_id ? String(rows[0].user_id) : null;
}

async function sendVerificationEmail(user) {
  const token = await createEmailVerificationToken(user.id);
  const verifyUrl = `${appRoute("/auth/verify")}?token=${encodeURIComponent(token)}`;
  const message = buildVerificationEmail({
    name: user.name,
    verifyUrl
  });

  return sendTransactionalEmail({
    to: user.email,
    ...message
  });
}

async function sendPasswordResetEmail(user) {
  const token = await createPasswordResetToken(user.id);
  const resetUrl = `${appRoute("/auth/reset-password")}?token=${encodeURIComponent(token)}`;
  const message = buildPasswordResetEmail({
    name: user.name,
    resetUrl
  });

  return sendTransactionalEmail({
    to: user.email,
    ...message
  });
}

function applyStringOperation(baseContent, operationInput = {}) {
  const content = String(baseContent ?? "");
  const type = String(operationInput.type || "").toUpperCase();
  const position = Math.max(Number(operationInput.position) || 0, 0);
  const safePosition = Math.min(position, content.length);
  const deleteCount = Math.max(Number(operationInput.deleteCount) || 0, 0);
  const text = String(operationInput.text ?? "");

  if (type === "INSERT") {
    return `${content.slice(0, safePosition)}${text}${content.slice(safePosition)}`;
  }

  if (type === "DELETE") {
    return `${content.slice(0, safePosition)}${content.slice(safePosition + deleteCount)}`;
  }

  if (type === "REPLACE") {
    return `${content.slice(0, safePosition)}${text}${content.slice(safePosition + deleteCount)}`;
  }

  throw new Error("Unsupported section operation type");
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

async function getDocumentLikeState(contextValue, documentId, userId) {
  const safeDocumentId = String(documentId);
  const safeUserId = userId ? String(userId) : null;

  const likesCount = await contextValue.loaders.likesCountByDocumentId.load(
    safeDocumentId
  );

  if (!safeUserId) {
    return {
      documentId: safeDocumentId,
      likesCount,
      likedByMe: false
    };
  }

  const likedByMe = await contextValue.loaders.documentLikedByUser.load(
    `${safeDocumentId}:${safeUserId}`
  );

  return {
    documentId: safeDocumentId,
    likesCount,
    likedByMe: Boolean(likedByMe)
  };
}

async function createUserNotification({
  recipientId,
  actorId,
  type,
  title,
  message,
  documentId = null,
  invitationId = null
}) {
  const notification = await Notification.create({
    recipientId,
    actorId,
    type,
    title,
    message,
    documentId,
    invitationId
  });

  await pubsub.publish(EVENTS.USER_NOTIFICATION_RECEIVED, {
    userNotificationReceived: notification,
    recipientId: String(recipientId)
  });

  return notification;
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
  JSON: new GraphQLScalarType({
    name: "JSON",
    description: "Arbitrary JSON value",
    serialize(value) {
      return value;
    },
    parseValue(value) {
      return value;
    },
    parseLiteral(ast) {
      function parseAst(node) {
        switch (node.kind) {
          case Kind.STRING:
          case Kind.BOOLEAN:
          case Kind.INT:
          case Kind.FLOAT:
            return node.value;
          case Kind.OBJECT: {
            const obj = Object.create(null);
            for (const field of node.fields) {
              obj[field.name.value] = parseAst(field.value);
            }
            return obj;
          }
          case Kind.LIST:
            return node.values.map(parseAst);
          case Kind.NULL:
            return null;
          default:
            return null;
        }
      }

      return parseAst(ast);
    }
  }),

  Query: {
    me: async (_, __, contextValue) => contextValue.currentUser,

    document: async (_, { id }, contextValue) => {
      // Allow unauthenticated access for public documents.
      const user = contextValue.currentUser || null;
      ensureObjectId(id, "document id");
      await ensureDocumentAccess(user ? user.id : null, id);

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

    searchOtherUsersDocumentsByTitle: async (
      _,
      { keyword, mode, ...args },
      contextValue
    ) => {
      const user = requireAuth(contextValue);
      const normalizedKeyword = String(keyword || "").trim();
      if (normalizedKeyword.length < 2) {
        throw new Error("Keyword must have at least 2 characters");
      }

      return Document.searchOtherUsersByTitle(
        user.id,
        normalizedKeyword,
        {
          ...normalizeDocumentListArgs(args),
          mode: mode || "TITLE"
        }
      );
    },

    getSections: async (_, { documentId }, contextValue) => {
      const user = contextValue.currentUser || null;
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user ? user.id : null, documentId);

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      await Section.ensureDefaults(documentId, document.content || "");
      return Section.findByDocumentId(documentId);
    },

    getVersions: async (_, { documentId }, contextValue) => {
      const user = contextValue.currentUser || null;
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user ? user.id : null, documentId);
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
    },

    myInvitations: async (_, { status }, contextValue) => {
      const user = requireAuth(contextValue);
      return Invitation.findByInvitee(user.id, {
        status: status || undefined
      });
    },

    myNotifications: async (_, args, contextValue) => {
      const user = requireAuth(contextValue);
      return Notification.findByRecipient(user.id, args || {});
    }
    ,
    listDiaryEntries: async (_, { documentId }, contextValue) => {
      const user = contextValue.currentUser || null;
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user ? user.id : null, documentId);

      const { rows } = await dbQuery(
        `
          SELECT id, document_id, page_number, date, mood, text, word_count, created_at, updated_at
          FROM diary_pages
          WHERE document_id = $1
          ORDER BY page_number ASC
        `,
        [documentId]
      );

      return rows.map((r) => ({
        id: String(r.id),
        documentId: String(r.document_id),
        pageNumber: r.page_number,
        date: r.date,
        mood: r.mood,
        text: r.text,
        wordCount: r.word_count || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    }
  },

  Mutation: {
    register: async (_, { name, email, password }, contextValue) => {
      validateRegisterInput({ name, email, password });
      const safePassword = validatePasswordValue(password, "Password");
      const normalizedEmail = normalizeEmail(email);
      const requiresEmailVerification = isEmailDeliveryEnabled();
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        throw new Error("Email is already registered");
      }

      const hashedPassword = await hashPassword(safePassword);
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: !requiresEmailVerification
      });

      if (requiresEmailVerification) {
        await sendVerificationEmail(user);
      }

      const token = signToken(user.id);
      try {
        if (contextValue && contextValue.res && typeof contextValue.res.cookie === "function") {
          const maxAge = parseExpiresToMs(env.jwtExpiresIn) || 7 * 24 * 60 * 60 * 1000;
          contextValue.res.cookie("syncnote-token", token, {
            httpOnly: true,
            secure: env.nodeEnv === "production",
            sameSite: "lax",
            maxAge
          });
        }
      } catch (e) {}

      return {
        token,
        user
      };
    },

    login: async (_, { email, password }, contextValue) => {
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

      if (!user.emailVerified) {
        if (!isEmailDeliveryEnabled()) {
          const upgradedUser = await User.findByIdAndUpdate(
            user.id,
            { emailVerified: true },
            { new: true }
          );

          await dbQuery(
            "DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL",
            [user.id]
          );

          return {
            token: signToken(user.id),
            user: upgradedUser || { ...user, emailVerified: true }
          };
        }

        const { rows: verificationRows } = await dbQuery(
          "SELECT EXISTS(SELECT 1 FROM email_verification_tokens WHERE user_id = $1) AS has_verification_record",
          [user.id]
        );

        if (!verificationRows[0]?.has_verification_record) {
          const upgradedLegacyUser = await User.findByIdAndUpdate(
            user.id,
            { emailVerified: true },
            { new: true }
          );

          return {
            token: signToken(user.id),
            user: upgradedLegacyUser || { ...user, emailVerified: true }
          };
        }

        throw new Error("Please verify your email before signing in");
      }

      const token = signToken(user.id);
      try {
        if (contextValue && contextValue.res && typeof contextValue.res.cookie === "function") {
          const maxAge = parseExpiresToMs(env.jwtExpiresIn) || 7 * 24 * 60 * 60 * 1000;
          contextValue.res.cookie("syncnote-token", token, {
            httpOnly: true,
            secure: env.nodeEnv === "production",
            sameSite: "lax",
            maxAge
          });
        }
      } catch (e) {}

      return {
        token,
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

    updatePassword: async (_, { currentPassword, newPassword }, contextValue) => {
      const user = requireAuth(contextValue);
      const safeCurrentPassword = validatePasswordValue(
        currentPassword,
        "Current password"
      );
      const safeNewPassword = validatePasswordValue(newPassword, "New password");

      if (safeCurrentPassword === safeNewPassword) {
        throw new Error("New password must be different from current password");
      }

      const existingUser = await User.findById(user.id);
      if (!existingUser) {
        throw new Error("User not found");
      }

      const validPassword = await comparePassword(
        safeCurrentPassword,
        existingUser.password
      );

      if (!validPassword) {
        throw new Error("Current password is incorrect");
      }

      const hashedPassword = await hashPassword(safeNewPassword);
      return User.findByIdAndUpdate(
        user.id,
        { password: hashedPassword },
        { new: true }
      );
    },

    verifyEmail: async (_, { token }) => {
      const safeToken = String(token || "").trim();
      if (!safeToken) {
        throw new Error("Verification token is required");
      }

      const userId = await consumeEmailVerificationToken(safeToken);
      if (!userId) {
        throw new Error("Verification link is invalid or expired");
      }

      await User.findByIdAndUpdate(userId, { emailVerified: true }, { new: true });
      return true;
    },

    resendVerificationEmail: async (_, { email }) => {
      const normalizedEmail = normalizeEmail(email);
      requireNonEmpty(normalizedEmail, "Email");

      if (!isEmailDeliveryEnabled()) {
        throw new Error("Email delivery is not configured on server");
      }

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        throw new Error("No account found with this email");
      }

      if (user.emailVerified) {
        return true;
      }

      await sendVerificationEmail(user);
      return true;
    },

    requestPasswordReset: async (_, { email }) => {
      const normalizedEmail = normalizeEmail(email);
      requireNonEmpty(normalizedEmail, "Email");

      if (!isEmailDeliveryEnabled()) {
        throw new Error("Email delivery is not configured on server");
      }

      const user = await User.findOne({ email: normalizedEmail });
      if (user) {
        await sendPasswordResetEmail(user);
      }

      return true;
    },

    resetPassword: async (_, { token, newPassword }) => {
      const safeToken = String(token || "").trim();
      if (!safeToken) {
        throw new Error("Password reset token is required");
      }

      const safeNewPassword = validatePasswordValue(newPassword, "New password");

      const userId = await consumePasswordResetToken(safeToken);
      if (!userId) {
        throw new Error("Password reset link is invalid or expired");
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const isSameAsCurrent = await comparePassword(safeNewPassword, user.password);
      if (isSameAsCurrent) {
        throw new Error("New password must be different from current password");
      }

      const hashedPassword = await hashPassword(safeNewPassword);
      await User.findByIdAndUpdate(user.id, { password: hashedPassword }, { new: true });
      return true;
    },

    createDocument: async (
      _,
      { title, content = "", isPublic = false },
      contextValue
    ) => {
      const user = requireAuth(contextValue);
      const safeTitle = validateTextInput(title, "Title", 160);

      const document = await Document.create({
        title: safeTitle,
        content: String(content || ""),
        isPublic: Boolean(isPublic),
        owner: user.id
      });

      await Section.ensureDefaults(document.id, String(content || ""));
      return document;
    },

    updateDocument: async (_, { id, title, content, isPublic }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(id, "document id");

      if (!(await canEditDocument(user.id, id))) {
        throw new Error("You do not have permission to edit this document");
      }

      if (typeof isPublic === "boolean") {
        await ensureDocumentOwner(user.id, id);
      }

      const updates = {};

      if (typeof title === "string") {
        updates.title = validateTextInput(title, "Title", 160);
      }

      if (typeof content === "string") {
        updates.content = validateSectionContent(content);
      }

      if (typeof isPublic === "boolean") {
        updates.isPublic = isPublic;
      }

      if (!Object.keys(updates).length) {
        throw new Error("At least one field (title, content, or isPublic) must be provided");
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

    updateSectionContent: async (_, { sectionId, contentDoc }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(sectionId, "section id");
      await ensureSectionEditAccess(user.id, sectionId);

      const currentSection = await Section.findById(sectionId);
      if (!currentSection) {
        throw new Error("Section not found");
      }

      try {
        const serialized = JSON.stringify(contentDoc || {});
      } catch (e) {}

      // Let Section.normalizeRichContent enforce shape/size validation.
      const updatedSection = await Section.updateById(sectionId, { content: contentDoc });

      try {
      } catch (e) {}

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

      try {
      } catch (e) {}

      const updatedSection = await Section.updateById(sectionId, updates);
      try {
      } catch (e) {}
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

    applySectionOperation: async (
      _,
      { sectionId, baseContent, operation },
      contextValue
    ) => {
      const user = requireAuth(contextValue);
      ensureObjectId(sectionId, "section id");
      await ensureSectionEditAccess(user.id, sectionId);

      const currentSection = await Section.findById(sectionId);
      if (!currentSection) {
        throw new Error("Section not found");
      }

      const normalizedBaseContent = validateSectionContent(baseContent);
      try {
      } catch (e) {}
      if (String(currentSection.content || "") !== normalizedBaseContent) {
        throw new Error("Section content is out of date");
      }

      const nextContent = validateSectionContent(
        applyStringOperation(normalizedBaseContent, operation)
      );

      // Defensive guard: prevent accidental blanking where an operation would
      // replace a previously non-empty rich doc with an empty paragraph doc.
      try {
        const EMPTY_DOC_SHAPE = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
        if (
          String(nextContent || "").trim() === EMPTY_DOC_SHAPE &&
          String(normalizedBaseContent || "").trim() !== EMPTY_DOC_SHAPE
        ) {
          console.warn("resolvers.applySectionOperation: rejecting operation that would blank section", { sectionId });
          throw new Error("Operation rejected: would remove section content (preventing accidental data loss)");
        }
      } catch (e) {
        // If we threw above, rethrow to abort the operation; otherwise ignore errors.
        if (e && String(e.message || "").startsWith("Operation rejected")) {
          throw e;
        }
      }
      try {
      } catch (e) {}

      const updatedSection = await Section.updateById(sectionId, {
        content: nextContent
      });
      try {
      } catch (e) {}

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

    sendCollaborationInvite: async (
      _,
      { documentId, userEmail, permission = "EDIT" },
      contextValue
    ) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentOwner(user.id, documentId);

      const normalizedEmail = normalizeEmail(userEmail);
      requireNonEmpty(normalizedEmail, "User email");

      const invitee = await User.findOne({ email: normalizedEmail });
      if (!invitee) {
        throw new Error("Collaborator not found");
      }

      if (String(invitee.id) === String(user.id)) {
        throw new Error("Owner cannot invite themselves");
      }

      if (![
        "VIEW",
        "EDIT"
      ].includes(permission)) {
        throw new Error("Permission must be VIEW or EDIT");
      }

      const existingShare = await Share.findOne({
        document: documentId,
        user: invitee.id
      });

      if (existingShare) {
        throw new Error("User is already a collaborator");
      }

      const invitation = await Invitation.upsertPending({
        documentId,
        inviterId: user.id,
        inviteeId: invitee.id,
        permission
      });

      const document = await Document.findById(documentId);

      await createUserNotification({
        recipientId: invitee.id,
        actorId: user.id,
        type: "INVITE_RECEIVED",
        title: `${user.name} invited you to collaborate`,
        message: `Document: ${document?.title || "Untitled"}`,
        documentId,
        invitationId: invitation.id
      });

      return invitation;
    },

    respondToInvitation: async (_, { invitationId, approve }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(invitationId, "invitation id");

      const updated = await Invitation.respond({
        invitationId,
        inviteeId: user.id,
        status: approve ? "APPROVED" : "REJECTED"
      });

      if (!updated) {
        throw new Error("Invitation not found or already handled");
      }

      if (approve) {
        await Share.findOneAndUpdate(
          { document: updated.documentId, user: updated.inviteeId },
          { permission: updated.permission },
          { new: true, upsert: true }
        );
      }

      const document = await Document.findById(updated.documentId);

      await createUserNotification({
        recipientId: updated.inviterId,
        actorId: user.id,
        type: approve ? "INVITE_APPROVED" : "INVITE_REJECTED",
        title: approve
          ? `${user.name} accepted your invitation`
          : `${user.name} declined your invitation`,
        message: `Document: ${document?.title || "Untitled"}`,
        documentId: updated.documentId,
        invitationId: updated.id
      });

      return updated;
    },

    markNotificationRead: async (_, { notificationId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(notificationId, "notification id");

      const updated = await Notification.markRead(notificationId, user.id);
      if (!updated) {
        throw new Error("Notification not found");
      }

      return updated;
    },

    likeDocument: async (_, { documentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      if (String(document.owner) === String(user.id)) {
        throw new Error("You cannot like your own document");
      }

      if (!document.isPublic && !(await canAccessDocument(user.id, documentId))) {
        throw new Error("Document is private");
      }

      const alreadyLiked = await Like.findOne({
        documentId,
        userId: user.id
      });

      await Like.like(documentId, user.id);

      if (!alreadyLiked) {
        await createUserNotification({
          recipientId: document.owner,
          actorId: user.id,
          type: "DOCUMENT_LIKED",
          title: `${user.name} liked your document`,
          message: `Document: ${document.title}`,
          documentId: document.id
        });
      }

      contextValue.loaders.likesCountByDocumentId.clear(String(documentId));
      contextValue.loaders.documentLikedByUser.clear(
        `${String(documentId)}:${String(user.id)}`
      );

      return getDocumentLikeState(contextValue, documentId, user.id);
    },

    unlikeDocument: async (_, { documentId }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      if (String(document.owner) === String(user.id)) {
        throw new Error("You cannot unlike your own document");
      }

      await Like.unlike(documentId, user.id);

      contextValue.loaders.likesCountByDocumentId.clear(String(documentId));
      contextValue.loaders.documentLikedByUser.clear(
        `${String(documentId)}:${String(user.id)}`
      );

      return getDocumentLikeState(contextValue, documentId, user.id);
    },

    

    saveDocumentSnapshot: async (_, { documentId, snapshotBase64 }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");

      if (!(await canEditDocument(user.id, documentId))) {
        throw new Error("You do not have permission to save this document");
      }

      if (!snapshotBase64 || !String(snapshotBase64).trim()) {
        throw new Error("snapshotBase64 is required");
      }


      const snapshotBuffer = Buffer.from(String(snapshotBase64), "base64");

      // Defensive check: if the incoming snapshot decodes to an empty Y.Doc
      // while an existing non-empty snapshot is present in DB, skip the
      // upsert to avoid accidental data loss. This prevents a buggy client
      // or race from overwriting the canonical server snapshot with an
      // empty document.
      try {
        const incomingDoc = new Y.Doc();
        try { Y.applyUpdate(incomingDoc, new Uint8Array(snapshotBuffer)); } catch (e) { /* ignore decode failures */ }
        const incomingHasContent = (typeof incomingDoc.getText === 'function' && incomingDoc.getText('content') && incomingDoc.getText('content').toString().length > 0) ||
          (typeof incomingDoc.getXmlFragment === 'function' && incomingDoc.getXmlFragment('prosemirror') && (incomingDoc.getXmlFragment('prosemirror').length > 0 || String(incomingDoc.getXmlFragment('prosemirror') || '').length > 0));

        if (!incomingHasContent) {
          // check existing snapshot
          try {
            const existing = await dbQuery(`SELECT snapshot FROM document_snapshots WHERE document_id = $1`, [documentId]);
            if (existing && existing.rows && existing.rows[0] && existing.rows[0].snapshot) {
              const existingBuf = existing.rows[0].snapshot;
              try {
                const existingDoc = new Y.Doc();
                try { Y.applyUpdate(existingDoc, new Uint8Array(existingBuf)); } catch (e) { /* ignore */ }
                const existingHasContent = (typeof existingDoc.getText === 'function' && existingDoc.getText('content') && existingDoc.getText('content').toString().length > 0) ||
                  (typeof existingDoc.getXmlFragment === 'function' && existingDoc.getXmlFragment('prosemirror') && (existingDoc.getXmlFragment('prosemirror').length > 0 || String(existingDoc.getXmlFragment('prosemirror') || '').length > 0));
                if (existingHasContent) {
                  console.warn("saveDocumentSnapshot: incoming snapshot appears empty while existing snapshot is non-empty - skipping upsert to avoid data loss", { documentId, providedLen: snapshotBuffer.length, existingLen: existingBuf.length, savedBy: user.id });
                  // Do not overwrite the latest snapshot; treat the call as successful
                  // but avoid inserting a history row that would reflect empty state.
                  try { await Document.touchUpdatedAt(documentId); } catch (e) {}
                  return true;
                }
              } catch (e) {
                // if anything goes wrong decoding existing snapshot, fall through
              }
            }
          } catch (e) {
            // ignore DB read failures here and continue with normal upsert
          }
        }
      } catch (e) {
        // ignore any errors in defensive checks and continue to persist
      }

      // Upsert latest snapshot
      await dbQuery(
        `
          INSERT INTO document_snapshots (document_id, snapshot, updated_at)
          VALUES ($1, $2, now())
          ON CONFLICT (document_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at
        `,
        [documentId, snapshotBuffer]
      );

      // Optional history record
      await dbQuery(
        `INSERT INTO document_snapshots_history (document_id, snapshot, saved_by) VALUES ($1, $2, $3)`,
        [documentId, snapshotBuffer, user.id]
      );

      // touch document updated_at
      try {
        await Document.touchUpdatedAt(documentId);
      } catch (e) {
        // best-effort
      }

      // Perform optional history pruning according to server config
      try {
        const keepRows = Number(env.yjsHistoryKeepRows || 0);
        if (keepRows > 0) {
          await dbQuery(
            `DELETE FROM document_snapshots_history WHERE document_id = $1 AND id NOT IN (SELECT id FROM document_snapshots_history WHERE document_id = $1 ORDER BY id DESC LIMIT $2)`,
            [documentId, keepRows]
          );
        }
      } catch (e) {
        // best-effort cleanup
      }

      try {
        const maxAge = Number(env.yjsHistoryMaxAgeDays || 0);
        if (maxAge > 0) {
          await dbQuery(
            `DELETE FROM document_snapshots_history WHERE document_id = $1 AND created_at < now() - ($2 * INTERVAL '1 day')`,
            [documentId, maxAge]
          );
        }
      } catch (e) {
        // best-effort cleanup
      }

      return true;
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
    },

    createDiaryEntry: async (
      _,
      { documentId, date = null, mood = null, text = "", pageNumber = null },
      contextValue
    ) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");

      if (!(await canEditDocument(user.id, documentId))) {
        throw new Error("You do not have permission to edit this document");
      }

      const safeText = String(text || "");
      const wordCount = safeText.trim().split(/\s+/).filter(Boolean).length;

      await dbQuery("BEGIN");
      try {
        if (pageNumber !== null && pageNumber !== undefined) {
          const pn = Math.max(1, Number(pageNumber) || 1);
          await dbQuery(
            `UPDATE diary_pages SET page_number = page_number + 1 WHERE document_id = $1 AND page_number >= $2`,
            [documentId, pn]
          );

          const ins = await dbQuery(
            `
              INSERT INTO diary_pages(document_id, page_number, date, mood, text, word_count)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id, document_id, page_number, date, mood, text, word_count, created_at, updated_at
            `,
            [documentId, pn, date || null, mood || null, safeText, wordCount]
          );

          await dbQuery("COMMIT");
          const r = ins.rows[0];
          return {
            id: String(r.id),
            documentId: String(r.document_id),
            pageNumber: r.page_number,
            date: r.date,
            mood: r.mood,
            text: r.text,
            wordCount: r.word_count || 0,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          };
        }

        const maxRes = await dbQuery(
          `SELECT COALESCE(MAX(page_number), 0) AS maxp FROM diary_pages WHERE document_id = $1`,
          [documentId]
        );
        const next = (maxRes.rows[0] && (maxRes.rows[0].maxp || 0)) + 1;

        const ins = await dbQuery(
          `
            INSERT INTO diary_pages(document_id, page_number, date, mood, text, word_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, document_id, page_number, date, mood, text, word_count, created_at, updated_at
          `,
          [documentId, next, date || null, mood || null, safeText, wordCount]
        );

        await dbQuery("COMMIT");
        const r = ins.rows[0];
        return {
          id: String(r.id),
          documentId: String(r.document_id),
          pageNumber: r.page_number,
          date: r.date,
          mood: r.mood,
          text: r.text,
          wordCount: r.word_count || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      } catch (e) {
        try {
          await dbQuery("ROLLBACK");
        } catch (er) {}
        throw e;
      }
    },

    updateDiaryEntry: async (_, { id, mood = null, text = "" }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(id, "id");

      const found = await dbQuery(`SELECT document_id FROM diary_pages WHERE id = $1`, [id]);
      if (!found.rows || !found.rows[0]) {
        throw new Error("Diary entry not found");
      }

      const documentId = found.rows[0].document_id;
      if (!(await canEditDocument(user.id, documentId))) {
        throw new Error("You do not have permission to edit this document");
      }

      const safeText = String(text || "");
      const wordCount = safeText.trim().split(/\s+/).filter(Boolean).length;

      const res = await dbQuery(
        `UPDATE diary_pages SET text = $1, mood = $2, word_count = $3, updated_at = now() WHERE id = $4 RETURNING id, document_id, page_number, date, mood, text, word_count, created_at, updated_at`,
        [safeText, mood || null, wordCount, id]
      );

      const r = res.rows[0];
      return {
        id: String(r.id),
        documentId: String(r.document_id),
        pageNumber: r.page_number,
        date: r.date,
        mood: r.mood,
        text: r.text,
        wordCount: r.word_count || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
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
    },

    userNotificationReceived: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([EVENTS.USER_NOTIFICATION_RECEIVED]),
        async ({ recipientId }, _, contextValue) => {
          const user = requireAuth(contextValue);
          return String(recipientId) === String(user.id);
        }
      )
    }
  },

  Document: {
    owner: async (doc, _, contextValue) => contextValue.loaders.usersById.load(doc.owner),

    content: async (doc, _, contextValue) => {
      const sections = await contextValue.loaders.sectionsByDocumentId.load(doc.id);
      const root = firstRootSection(sections);
      return root?.content ?? doc.content ?? "";
    },

    collaborators: async (doc, _, contextValue) => {
      const shares = await contextValue.loaders.sharesByDocumentId.load(doc.id);
      const userIds = shares.map((share) => share.user);

      if (!userIds.length) {
        return [];
      }

      const users = await contextValue.loaders.usersById.loadMany(userIds);
      return users.filter((user) => user && !(user instanceof Error));
    },

    sections: async (doc, _, contextValue) => {
      await Section.ensureDefaults(doc.id, doc.content || "");
      contextValue.loaders.sectionsByDocumentId.clear(doc.id);
      return contextValue.loaders.sectionsByDocumentId.load(doc.id);
    },

    comments: async (doc, _, contextValue) =>
      contextValue.loaders.commentsByDocumentId.load(doc.id)
    ,
    snapshotBase64: async (doc, _, contextValue) => {
      try {
        const { rows } = await dbQuery(
          `SELECT snapshot FROM document_snapshots WHERE document_id = $1`,
          [doc.id]
        );
        const row = rows[0];
        if (!row || !row.snapshot) return null;
        return Buffer.from(row.snapshot).toString("base64");
      } catch (e) {
        return null;
      }
    }
  },

  DiscoverDocument: {
    owner: async (doc, _, contextValue) => contextValue.loaders.usersById.load(doc.owner),
    likesCount: async (doc, _, contextValue) =>
      contextValue.loaders.likesCountByDocumentId.load(doc.id),
    likedByMe: async (doc, _, contextValue) => {
      const userId = contextValue.currentUser?.id;
      if (!userId) {
        return false;
      }

      return contextValue.loaders.documentLikedByUser.load(
        `${String(doc.id)}:${String(userId)}`
      );
    }
  },

  CollaborationInvitation: {
    document: async (invitation, _, contextValue) =>
      contextValue.loaders.documentsById.load(invitation.documentId),
    inviter: async (invitation, _, contextValue) =>
      contextValue.loaders.usersById.load(invitation.inviterId),
    invitee: async (invitation, _, contextValue) =>
      contextValue.loaders.usersById.load(invitation.inviteeId)
  },

  UserNotification: {
    recipient: async (notification, _, contextValue) =>
      contextValue.loaders.usersById.load(notification.recipientId),
    actor: async (notification, _, contextValue) => {
      if (!notification.actorId) {
        return null;
      }
      return contextValue.loaders.usersById.load(notification.actorId);
    },
    document: async (notification, _, contextValue) => {
      if (!notification.documentId) {
        return null;
      }
      return contextValue.loaders.documentsById.load(notification.documentId);
    },
    invitation: async (notification, _, contextValue) => {
      if (!notification.invitationId) {
        return null;
      }

      return contextValue.loaders.invitationsById.load(notification.invitationId);
    }
  },

  Section: {
    updatedBy: async (section, _, contextValue) => {
      if (!section.updatedById) {
        return null;
      }

      return contextValue.loaders.usersById.load(section.updatedById);
    }
  },

  Comment: {
    author: async (comment, _, contextValue) =>
      contextValue.loaders.usersById.load(comment.author),
    section: async (comment, _, contextValue) =>
      contextValue.loaders.sectionsById.load(comment.section)
  },

  Share: {
    user: async (share, _, contextValue) => contextValue.loaders.usersById.load(share.user),
    document: async (share, _, contextValue) =>
      contextValue.loaders.documentsById.load(share.document)
  },

  Version: {
    createdBy: async (version, _, contextValue) =>
      contextValue.loaders.usersById.load(version.createdBy)
  },

  Presence: {
    user: async (presence, _, contextValue) =>
      contextValue.loaders.usersById.load(presence.userId)
  },
  
};
