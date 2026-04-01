import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import cors from "cors";
import express from "express";
import http from "http";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import { env } from "./config/env.js";
import { connectPostgres } from "./db/postgres.js";
import { buildContext } from "./graphql/context.js";
import { schema } from "./graphql/schema.js";
import { attachCursorSocket } from "./realtime/cursorSocket.js";

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
    // eslint-disable-next-line no-console
    console.log(
      `SyncNote API running on http://localhost:${env.port}/graphql (env: ${env.nodeEnv})`
    );
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
