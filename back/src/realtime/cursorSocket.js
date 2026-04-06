import { Server as SocketIOServer } from "socket.io";
import { getUserIdFromAuthHeader } from "../utils/auth.js";
import User from "../models/User.js";
import { canAccessDocument } from "../utils/permissions.js";

const cursorByDocument = new Map();

function isAllowedCursorOrigin(origin, configuredOrigin) {
  if (!origin) {
    return true;
  }

  if (!configuredOrigin || configuredOrigin === "*") {
    return true;
  }

  if (origin === configuredOrigin) {
    return true;
  }

  if (
    configuredOrigin === "http://localhost:3000" &&
    origin === "http://127.0.0.1:3000"
  ) {
    return true;
  }

  if (
    configuredOrigin === "http://127.0.0.1:3000" &&
    origin === "http://localhost:3000"
  ) {
    return true;
  }

  return false;
}

function roomForDocument(documentId) {
  return `doc:${String(documentId)}`;
}

function getDocumentCursorMap(documentId, create = false) {
  const key = String(documentId);
  if (!cursorByDocument.has(key) && create) {
    cursorByDocument.set(key, new Map());
  }
  return cursorByDocument.get(key) || null;
}

function clearCursor(documentId, userId, ownerCursorId = null) {
  const map = getDocumentCursorMap(documentId, false);
  if (!map) {
    return false;
  }

  const key = String(userId);
  const existing = map.get(key);
  if (!existing) {
    return false;
  }

  if (ownerCursorId && String(existing.cursorId || "") !== String(ownerCursorId)) {
    return false;
  }

  map.delete(key);
  if (map.size === 0) {
    cursorByDocument.delete(String(documentId));
  }

  return true;
}

function listCursors(documentId) {
  const map = getDocumentCursorMap(documentId, false);
  if (!map) {
    return [];
  }

  return Array.from(map.values());
}

export function attachCursorSocket(httpServer, env) {
  const io = new SocketIOServer(httpServer, {
    path: "/cursor",
    cors: {
      origin: (origin, callback) => {
        const allowed = isAllowedCursorOrigin(origin, env.corsOrigin);
        callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
      },
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const authToken = String(socket.handshake.auth?.token || "").trim();
      const authHeaderFromHandshake = String(
        socket.handshake.auth?.authorization || ""
      ).trim();

      const authHeader = authHeaderFromHandshake ||
        (authToken ? `Bearer ${authToken}` : null);

      const userId = getUserIdFromAuthHeader(authHeader);
      if (!userId) {
        next(new Error("Authentication required"));
        return;
      }

      const currentUser = await User.findById(userId);
      if (!currentUser) {
        next(new Error("Authentication required"));
        return;
      }

      socket.data.currentUser = {
        id: String(currentUser.id),
        name: currentUser.name
      };

      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.currentUser?.id) {
      socket.emit("cursor:self", {
        userId: socket.data.currentUser.id,
        cursorId: socket.id
      });
    }

    socket.on("cursor:join", async ({ documentId } = {}) => {
      const user = socket.data.currentUser;
      const safeDocumentId = String(documentId || "").trim();

      if (!user || !safeDocumentId) {
        return;
      }

      const canAccess = await canAccessDocument(user.id, safeDocumentId);
      if (!canAccess) {
        return;
      }

      if (socket.data.documentId && socket.data.documentId !== safeDocumentId) {
        clearCursor(socket.data.documentId, user.id, socket.id);
        socket.leave(roomForDocument(socket.data.documentId));
      }

      socket.data.documentId = safeDocumentId;
      socket.join(roomForDocument(safeDocumentId));

      const map = getDocumentCursorMap(safeDocumentId, true);
      const existing = map.get(String(user.id));
      socket.data.cursorSeq = Math.max(
        Number(socket.data.cursorSeq) || 0,
        Number(existing?.seq) || 0
      );

      const cursors = listCursors(safeDocumentId);

      socket.emit("cursor:snapshot", {
        documentId: safeDocumentId,
        selfCursorId: socket.id,
        cursors
      });
    });

    socket.on("cursor:move", ({ documentId, sectionId, sectionTitle, from, to, offset } = {}) => {
      const user = socket.data.currentUser;
      const joinedDocumentId = socket.data.documentId;
      const safeDocumentId = String(documentId || "").trim();

      if (!user || !joinedDocumentId || !safeDocumentId) {
        return;
      }

      if (safeDocumentId !== joinedDocumentId) {
        return;
      }

      const map = getDocumentCursorMap(safeDocumentId, true);
      const previous = map.get(String(user.id));
      const nextSeq =
        Math.max(Number(socket.data.cursorSeq) || 0, Number(previous?.seq) || 0) + 1;

      const payload = {
        cursorId: socket.id,
        documentId: safeDocumentId,
        seq: nextSeq,
        userId: user.id,
        user: {
          id: user.id,
          name: user.name
        },
        sectionId:
          sectionId !== null && sectionId !== undefined
            ? String(sectionId)
            : null,
        sectionTitle: String(sectionTitle || ""),
        from: Math.max(Number(from) || 1, 1),
        to: Math.max(Number(to) || Math.max(Number(from) || 1, 1), Math.max(Number(from) || 1, 1)),
        offset: Math.max(Number(offset) || 0, 0),
        at: new Date().toISOString()
      };

      socket.data.cursorSeq = payload.seq;

      if (previous) {
        const prevSeq = Math.max(Number(previous.seq) || 0, 0);
        if (payload.seq <= prevSeq) {
          return;
        }
      }
      map.set(String(user.id), payload);

      socket.to(roomForDocument(safeDocumentId)).emit("cursor:moved", payload);
      socket.to(roomForDocument(safeDocumentId)).emit("cursor:update", payload);
    });

    socket.on("cursor:leave", ({ documentId } = {}) => {
      const user = socket.data.currentUser;
      const safeDocumentId = String(documentId || socket.data.documentId || "").trim();

      if (!user || !safeDocumentId) {
        return;
      }

      const removed = clearCursor(safeDocumentId, user.id, socket.id);
      socket.leave(roomForDocument(safeDocumentId));
      socket.data.documentId = null;

      if (removed) {
        io.to(roomForDocument(safeDocumentId)).emit("cursor:left", {
          documentId: safeDocumentId,
          userId: user.id,
          cursorId: socket.id
        });
      }
    });

    socket.on("disconnect", () => {
      const user = socket.data.currentUser;
      const documentId = socket.data.documentId;

      if (!user || !documentId) {
        return;
      }

      const removed = clearCursor(documentId, user.id, socket.id);
      if (removed) {
        io.to(roomForDocument(documentId)).emit("cursor:left", {
          documentId: String(documentId),
          userId: user.id,
          cursorId: socket.id
        });
      }
    });
  });

  return io;
}
