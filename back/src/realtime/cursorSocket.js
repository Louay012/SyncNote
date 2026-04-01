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

function clearCursor(documentId, cursorId) {
  const map = getDocumentCursorMap(documentId, false);
  if (!map) {
    return;
  }

  map.delete(String(cursorId));
  if (map.size === 0) {
    cursorByDocument.delete(String(documentId));
  }
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
        clearCursor(socket.data.documentId, socket.id);
        socket.leave(roomForDocument(socket.data.documentId));
      }

      socket.data.documentId = safeDocumentId;
      socket.join(roomForDocument(safeDocumentId));

      const cursors = listCursors(safeDocumentId);

      socket.emit("cursor:snapshot", {
        documentId: safeDocumentId,
        selfCursorId: socket.id,
        cursors
      });
    });

    socket.on("cursor:move", ({ documentId, sectionId, sectionTitle, line, column, offset } = {}) => {
      const user = socket.data.currentUser;
      const joinedDocumentId = socket.data.documentId;
      const safeDocumentId = String(documentId || "").trim();

      if (!user || !joinedDocumentId || !safeDocumentId) {
        return;
      }

      if (safeDocumentId !== joinedDocumentId) {
        return;
      }

      const payload = {
        cursorId: socket.id,
        documentId: safeDocumentId,
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
        line: Math.max(Number(line) || 1, 1),
        column: Math.max(Number(column) || 1, 1),
        offset: Math.max(Number(offset) || 0, 0),
        at: new Date().toISOString()
      };

      const map = getDocumentCursorMap(safeDocumentId, true);
      map.set(socket.id, payload);

      io.emit("cursor:moved", payload);
    });

    socket.on("cursor:leave", ({ documentId } = {}) => {
      const user = socket.data.currentUser;
      const safeDocumentId = String(documentId || socket.data.documentId || "").trim();

      if (!user || !safeDocumentId) {
        return;
      }

      clearCursor(safeDocumentId, socket.id);
      socket.leave(roomForDocument(safeDocumentId));
      socket.data.documentId = null;

      io.emit("cursor:left", {
        documentId: safeDocumentId,
        userId: user.id,
        cursorId: socket.id
      });
    });

    socket.on("disconnect", () => {
      const user = socket.data.currentUser;
      const documentId = socket.data.documentId;

      if (!user || !documentId) {
        return;
      }

      clearCursor(documentId, socket.id);
      io.emit("cursor:left", {
        documentId: String(documentId),
        userId: user.id,
        cursorId: socket.id
      });
    });
  });

  return io;
}
