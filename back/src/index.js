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
import { attachCursorSocket } from "./realtime/cursorSocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const graphqlDocsDirectory = path.resolve(__dirname, "..", "public", "graphql-docs");
const graphqlDocsIndex = path.join(graphqlDocsDirectory, "index.html");

async function startServer() {
  await connectPostgres();

  const app = express();
  const httpServer = http.createServer(app);
  attachCursorSocket(httpServer, env);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql"
  });

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
    wsServer
  );

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
      origin: env.corsOrigin === "*" ? true : env.corsOrigin
    }),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => buildContext(req.headers.authorization || null)
    })
  );

  app.get("/health", (_, res) => {
    res.status(200).json({ status: "ok" });
  });

  httpServer.listen(env.port, () => {
    const docsSuffix = env.graphqlDocsEnabled
      ? `, docs: http://localhost:${env.port}/docs/graphql`
      : "";

    // eslint-disable-next-line no-console
    console.log(
      `SyncNote API running on http://localhost:${env.port}/graphql (env: ${env.nodeEnv})${docsSuffix}`
    );
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
