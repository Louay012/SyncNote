import { GraphQLScalarType, Kind } from "graphql";
import { withFilter } from "graphql-subscriptions";
import Comment from "../models/Comment.js";
import Document from "../models/Document.js";
import Share from "../models/Share.js";
import User from "../models/User.js";
import { requireAuth } from "./context.js";
import { EVENTS, pubsub } from "./pubsub.js";
import {
  comparePassword,
  hashPassword,
  signToken
} from "../utils/auth.js";
import {
  canAccessDocument,
  ensureDocumentAccess,
  ensureDocumentOwner,
  ensureObjectId
} from "../utils/permissions.js";

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

async function canEditDocument(userId, documentId) {
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
      return Document.findById(id);
    },

    myDocuments: async (_, __, contextValue) => {
      const user = requireAuth(contextValue);
      return Document.findByOwner(user.id);
    },

    sharedWithMeDocuments: async (_, __, contextValue) => {
      const user = requireAuth(contextValue);
      const shares = await Share.find({ user: user.id });
      const docIds = shares.map((share) => share.document);
      return Document.findByIds(docIds);
    },

    searchDocuments: async (_, { keyword }, contextValue) => {
      const user = requireAuth(contextValue);
      return Document.searchAccessible(user.id, keyword);
    }
  },

  Mutation: {
    register: async (_, { name, email, password }) => {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw new Error("Email is already registered");
      }

      const hashedPassword = await hashPassword(password);
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword
      });

      return {
        token: signToken(user.id),
        user
      };
    },

    login: async (_, { email, password }) => {
      const user = await User.findOne({ email: email.toLowerCase() });
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
      const updatedUser = await User.findByIdAndUpdate(
        user.id,
        { ...(name ? { name } : {}) },
        { new: true }
      );
      return updatedUser;
    },

    createDocument: async (_, { title, content = "" }, contextValue) => {
      const user = requireAuth(contextValue);
      return Document.create({ title, content, owner: user.id });
    },

    updateDocument: async (_, { id, title, content }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(id, "document id");

      if (!(await canEditDocument(user.id, id))) {
        throw new Error("You do not have permission to edit this document");
      }

      const updates = {
        ...(typeof title === "string" ? { title } : {}),
        content
      };

      const document = await Document.findByIdAndUpdate(id, updates, {
        new: true
      });

      if (!document) {
        throw new Error("Document not found");
      }

      await pubsub.publish(EVENTS.DOCUMENT_UPDATED, {
        documentUpdated: document,
        documentId: id
      });

      return document;
    },

    deleteDocument: async (_, { id }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(id, "document id");
      await ensureDocumentOwner(user.id, id);

      await Promise.all([
        Document.findByIdAndDelete(id),
        Comment.deleteMany({ document: id }),
        Share.deleteMany({ document: id })
      ]);

      return true;
    },

    addComment: async (_, { documentId, text }, contextValue) => {
      const user = requireAuth(contextValue);
      ensureObjectId(documentId, "document id");
      await ensureDocumentAccess(user.id, documentId);

      const comment = await Comment.create({
        text,
        author: user.id,
        document: documentId
      });

      await pubsub.publish(EVENTS.COMMENT_ADDED, {
        commentAdded: comment,
        documentId
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

      const collaborator = await User.findOne({ email: userEmail.toLowerCase() });

      if (!collaborator) {
        throw new Error("Collaborator not found");
      }

      if (String(collaborator.id) === String(user.id)) {
        throw new Error("Owner already has access");
      }

      if (!["VIEW", "EDIT"].includes(permission)) {
        throw new Error("Permission must be VIEW or EDIT");
      }

      const share = await Share.findOneAndUpdate(
        { document: documentId, user: collaborator.id },
        { permission },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return share;
    }
  },

  Subscription: {
    documentUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([EVENTS.DOCUMENT_UPDATED]),
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

    collaborators: async (doc) => {
      const shares = await Share.find({ document: doc.id });
      const userIds = shares.map((share) => share.user);
      return User.findByIds(userIds);
    },

    comments: async (doc) => Comment.find({ document: doc.id })
  },

  Comment: {
    author: async (comment) => User.findById(comment.author),
    document: async (comment) => Document.findById(comment.document)
  },

  Share: {
    user: async (share) => User.findById(share.user),
    document: async (share) => Document.findById(share.document)
  }
};
