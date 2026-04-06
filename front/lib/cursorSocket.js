import { io } from "socket.io-client";

const CURSOR_PATH = process.env.NEXT_PUBLIC_CURSOR_SOCKET_PATH || "/cursor";

function resolveCursorUrl() {
  if (process.env.NEXT_PUBLIC_CURSOR_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_CURSOR_SOCKET_URL;
  }

  if (process.env.NEXT_PUBLIC_GRAPHQL_HTTP) {
    try {
      const graphqlUrl = new URL(process.env.NEXT_PUBLIC_GRAPHQL_HTTP);
      return `${graphqlUrl.protocol}//${graphqlUrl.host}`;
    } catch {
      // Ignore invalid URL and continue to browser-derived fallback.
    }
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:4000`;
  }

  return "http://localhost:4000";
}

export function createCursorSocket(token) {
  return io(resolveCursorUrl(), {
    path: CURSOR_PATH,
    transports: ["polling"],
    upgrade: false,
    forceNew: true,
    auth: {
      token: String(token || "")
    },
    autoConnect: false
  });
}
