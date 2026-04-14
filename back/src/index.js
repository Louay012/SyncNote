import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { existsSync } from "fs";
import cors from "cors";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import { env } from "./config/env.js";
import { connectPostgres } from "./db/postgres.js";
import { buildContext } from "./graphql/context.js";
import { schema } from "./graphql/schema.js";
import { attachSnapshotRoutes } from "./routes/snapshots.js";
import { attachWsTokenRoute } from "./routes/wsToken.js";
import { attachDebugRoutes } from "./routes/debug.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const graphqlDocsDirectory = path.resolve(__dirname, "..", "public", "graphql-docs");
const graphqlDocsIndex = path.join(graphqlDocsDirectory, "index.html");

async function startServer() {
  await connectPostgres();

  const app = express();
  const httpServer = http.createServer(app);

  // legacy cursor socket removed: use Yjs awareness + CollaborationCursor instead

  // Create a noServer WebSocketServer for GraphQL subscriptions so we can
  // route upgrades centrally between /graphql and /yjs.
  const graphqlWss = new WebSocketServer({ noServer: true });

  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const authHeader =
          ctx.connectionParams?.Authorization ||
          ctx.connectionParams?.authorization ||
          null;

        return buildContext(authHeader);
      }
    },
    graphqlWss
  );

  // Create the Yjs websocket handler (noServer) and get its upgrade handler
  const { createYjsWebsocket } = await import("./realtime/yjsWebsocket.js");
  const { wss: yjsWss, handleUpgrade: handleYjsUpgrade } = createYjsWebsocket(env);

  // Central upgrade router: route to /yjs or /graphql handlers
  httpServer.on("upgrade", async (req, socket, head) => {
    try {
      const parsed = new URL(req.url, `http://${req.headers.host}`);
      const pathname = String(parsed.pathname || "");

      if (pathname.startsWith("/yjs")) {
        // Let the Yjs handler perform auth and upgrade
        const handled = await handleYjsUpgrade(req, socket, head);
        if (!handled) {
          // If handler returned false, ensure socket closed
          try { socket.write("HTTP/1.1 400 Bad Request\r\n\r\n"); } catch {}
          try { socket.destroy(); } catch {}
        }
        return;
      }

      if (pathname.startsWith("/graphql")) {
        graphqlWss.handleUpgrade(req, socket, head, (ws) => {
          graphqlWss.emit("connection", ws, req);
        });
        return;
      }

      // Not handled here — allow other upgrade listeners (if any) to run
    } catch (err) {
      console.error("Upgrade router error", err);
      try { socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n"); } catch {}
      try { socket.destroy(); } catch {}
    }
  });

  const apolloServer = new ApolloServer({
    schema,
    introspection: env.graphqlIntrospection,
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            }
          };
        }
      }
    ]
  });

  await apolloServer.start();

  if (env.graphqlDocsEnabled) {
    if (existsSync(graphqlDocsIndex)) {
      app.use(
        "/docs/graphql",
        express.static(graphqlDocsDirectory, {
          index: "index.html",
          redirect: false,
          extensions: ["html"]
        })
      );

      app.get("/docs/graphql", (_, res) => {
        res.sendFile(graphqlDocsIndex);
      });
    } else {
      app.get("/docs/graphql", (_, res) => {
        res.status(503).json({
          status: "docs_not_generated",
          message:
            "Magidoc site is not generated yet. Run `npm run docs:generate` inside back/.",
          expectedPath: graphqlDocsDirectory
        });
      });
    }
  }

  app.use(
    "/graphql",
    cors({
      origin: env.corsOrigin === "*" ? true : env.corsOrigin,
      credentials: true
    }),
    express.json({ limit: "8mb" }),
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => buildContext(req.headers.authorization || null, req, res)
    })
  );

  app.get("/health", (_, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Attach snapshot endpoints (beacon fallback)
  attachSnapshotRoutes(app);

  // Attach debug routes (development only)
  try { attachDebugRoutes(app); } catch (e) { console.warn('attachDebugRoutes failed', e); }

  // Attach ws-token endpoint (short-lived JWT for WebSocket auth)
  attachWsTokenRoute(app);

  httpServer.listen(env.port, () => {
    const docsSuffix = env.graphqlDocsEnabled
      ? `, docs: http://localhost:${env.port}/docs/graphql`
      : "";

    // server started (console output removed)
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
