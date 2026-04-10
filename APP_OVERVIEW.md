SyncNote — App overview

Purpose

SyncNote is a collaborative document workspace that supports:
- multi-section rich-text documents
- real-time presence and per-section cursors
- document sharing, permissions and invitations
- comments, likes, and version history
- discoverable public documents

High-level architecture

- Monorepo with two top-level apps:
  - `back/` — Node.js GraphQL API + realtime sockets
  - `front/` — Next.js 14 React frontend (app/ directory)

Technical stack

- API: Node.js, Express, Apollo Server (GraphQL), WebSocket support via `graphql-ws` + `ws`.
- Realtime: websocket subscription server mounted at `/graphql` and a separate cursor socket (see `back/realtime/cursorSocket.js`).
- Database: PostgreSQL (connection helpers and schema in `back/src/db/`).
- Authentication: JWT bearer auth handled in GraphQL context builder (`back/src/graphql/context.js`).
- Client: Next.js app using `@apollo/client`, `graphql-ws` for subscriptions, and TipTap for the rich-text editor.

Functional areas (quick)

- Documents: create, edit, save, rename, set visibility (public/private).
- Sections: documents are composed of ordered sections; sections can be added, moved, deleted.
- Collaboration: live cursors, presence, and activity lists per document/section.
- Sharing & permissions: owner can invite collaborators and set permissions; invites and notifications are handled server-side.
- Discover: public documents appear in a discover view.

How the pieces connect (agents-friendly)

- Frontend obtains an auth token and connects to the GraphQL HTTP endpoint for queries/mutations and to the GraphQL WS endpoint for subscriptions. The main server entry is [back/src/index.js](back/src/index.js).
- GraphQL schema and resolvers live under [back/src/graphql/](back/src/graphql/). Use those modules to find mutations for `createDocument`, `invite`, `createComment`, etc.
- The realtime cursor socket is attached in `back/src/index.js` by `attachCursorSocket(httpServer, env)` and implemented in [back/src/realtime/cursorSocket.js](back/src/realtime/cursorSocket.js).
- Postgres schema and DB helpers are in [back/src/db/](back/src/db/). Use `back/scripts/setup-postgres.js` to initialize the DB used by this project.

Key files / entry points

- **Server entry:** [back/src/index.js](back/src/index.js)
- **GraphQL schema:** [back/src/graphql/schema.js](back/src/graphql/schema.js)
- **GraphQL resolvers:** [back/src/graphql/resolvers.js](back/src/graphql/resolvers.js)
- **Context / auth:** [back/src/graphql/context.js](back/src/graphql/context.js)
- **Cursor realtime socket:** [back/src/realtime/cursorSocket.js](back/src/realtime/cursorSocket.js)
- **DB helpers & schema:** [back/src/db/postgres.js](back/src/db/postgres.js), [back/src/db/schema.sql](back/src/db/schema.sql)
- **Frontend main app:** [front/app](front/app) (Next.js routes and pages)
- **Editor UI:** [front/components/EditorPane.js](front/components/EditorPane.js)
- **Sections & sidebar:** [front/components/SectionsTree.js](front/components/SectionsTree.js)
- **Workspace shell / orchestration:** [front/components/WorkspaceApp.js](front/components/WorkspaceApp.js)
- **Apollo client helpers:** [front/lib/apollo.js](front/lib/apollo.js), [front/lib/graphql.js](front/lib/graphql.js)
- **Run script:** `run-servers.bat` (starts both front and back dev servers)

Local development

- Start Postgres (locally or via docker), then run DB setup if needed:

  npm --prefix back run db:setup

- Start servers (dev):

  .\run-servers.bat

- Or individually:

  npm --prefix back run dev
  npm --prefix front run dev

Notes for agents (quick actionable pointers)

- To find mutations and inputs, inspect `back/src/graphql/typeDefs.js` and `back/src/graphql/resolvers.js`.
- To simulate realtime events, connect a GraphQL WS client to `ws://localhost:<BACK_PORT>/graphql` and send subscription operations defined in the schema.
- For front-end UI hooks that open share modals, search for `onOpenShareModal` in `front/components` to locate call sites.

Contributing guidance

- Keep front routes in `front/app/` (Next.js app directory). Follow existing component patterns for server calls (use `front/lib/apollo.js`).
- When adding new subscriptions, update both server `schema` and client subscription usage via `graphql-ws`.

Contact / maintainers

- Repository author details not set in `package.json`; ask the repo owner for contact and deployment details.

---

This document is intentionally concise; ask me to expand any section (API examples, mutation signatures, or component wiring) if you want runnable snippets or agent-ready examples.
