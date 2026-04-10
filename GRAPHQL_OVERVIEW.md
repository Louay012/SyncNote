# GraphQL Overview for SyncNote

This document summarizes how GraphQL is used in this app, the benefits over a REST approach, and how the 1+N (N+1) query problem is addressed here.

## Where GraphQL is used
- Backend: the GraphQL server logic lives under `back/graphql/` (typical files: `typeDefs.js`, `schema.js`, `resolvers.js`, `context.js`, `loaders.js`, `pubsub.js`).
- Frontend: the app uses an Apollo client (see `lib/apollo.js` and `lib/graphql.js`) and page/components call queries, mutations and subscribe to updates.
- Documentation / playground: there are generated docs under `back/public/graphql-docs/` for exploration and introspection.

## High-level responsibilities
- `typeDefs` / `schema`: GraphQL schema and type definitions for documents, sections, comments, users, etc.
- `resolvers`: map schema fields to application logic (DB calls, business rules, permission checks).
- `context`: builds per-request context (auth info, loaders, pubsub, current user).
- `loaders`: batching/caching helpers used by resolvers to avoid inefficient database access.
- `pubsub`: server-side pub/sub implementation for GraphQL subscriptions (realtime collaboration events).
 - `pubsub`: server-side pub/sub implementation for GraphQL subscriptions (realtime collaboration events).

## Examples: queries, mutations, subscriptions

Below are short examples and notes about where each operation type is defined and typically used in this project.

### Queries
- What: Read-only operations that fetch data from the server.
- Example (client GraphQL document):

```graphql
query GetMyDocuments($limit: Int) {
   myDocuments(limit: $limit) {
      items {
         id
         title
         owner {
            id
            name
         }
      }
   }
}
```
- Where defined: `front/lib/graphql.js` (e.g. `GET_MY_DOCUMENTS`).
- Typical usage: called with `useQuery` in components such as `front/components/DocumentsPage.js`, `front/components/DashboardPage.js`, and `front/components/WorkspaceApp.js`.

### Mutations
- What: Operations that change server state (creates, updates, deletes).
- Example:

```graphql
mutation CreateDocument($title: String!, $content: String) {
   createDocument(title: $title, content: $content) {
      id
      title
      updatedAt
   }
}
```
- Where defined: `front/lib/graphql.js` (e.g. `CREATE_DOCUMENT`).
- Typical usage: called with `useMutation` in UI components such as `front/components/SidebarNavigation.js` and `front/components/WorkspaceApp.js`.

### Subscriptions
- What: Push-based real-time updates from the server (uses WebSocket).
- Example:

```graphql
subscription OnSectionUpdated($documentId: ID!) {
   sectionUpdated(documentId: $documentId) {
      id
      documentId
      title
      content
      updatedAt
      updatedBy {
         id
         name
      }
   }
}
```
- Where defined: `front/lib/graphql.js` (subscription documents). The WebSocket link is configured in `front/lib/apollo.js`.
- Typical usage: consumed with `useSubscription` in components such as `front/components/WorkspaceApp.js` and `front/components/NotificationCenter.js`.

For ready-to-run client snippets and examples see `front/examples/GRAPHQL_CLIENT_EXAMPLES.md`. For a server-side N+1 demo and DataLoader example see `back/src/graphql/examples/n_plus_one_demo.js` and `back/src/graphql/loaders.js`.

## Benefits of GraphQL vs REST for this app
- Precise data fetching: clients request exactly the fields they need; prevents over-fetching large document payloads.
- Single endpoint: simplifies networking and reduces client-side routing of many REST endpoints.
- Strong schema + introspection: clear contract, easier client tooling, and automated docs (helpful for editors and collaboration UI).
- Efficient nested fetching: fetching nested document → sections → comments in one request without multiple REST roundtrips.
- Real-time support: subscriptions integrate naturally with the GraphQL schema for collaborative features.
- Evolving API safely: adding fields to types is non-breaking for existing clients; versioning becomes simpler.

## The N+1 (1+N) problem — what it is
The N+1 problem happens when a resolver for a list of parent objects issues an additional database query per parent. Example: resolving `documents -> author` naïvely issues 1 query to list documents, then N separate queries to load each author, producing N+1 DB queries.

## How this app addresses N+1
1. DataLoader-style batching and per-request caching

   - Pattern: create short-lived DataLoader instances in the GraphQL request `context` (one DataLoader per entity/relation). Resolvers call `loader.load(id)` instead of directly querying the DB.
   - The loader batches many `.load()` calls that happen during a single tick into a single batched DB request (e.g., `SELECT * FROM users WHERE id IN (...)`). It then maps results back to the requested keys.
   - Per-request cache avoids duplicate loads within the same GraphQL operation but does not persist between requests (prevents stale cross-request caching).

   Example (illustrative):

   ```js
   // in back/graphql/context.js (concept)
   const DataLoader = require('dataloader')
   function createUserLoader(db) {
     return new DataLoader(async (ids) => {
       const rows = await db('users').whereIn('id', ids)
       const m = new Map(rows.map(r => [r.id, r]))
       return ids.map(id => m.get(id) || null)
     })
   }

   // per request
   const context = {
     userLoader: createUserLoader(db),
     // ...other context
   }
   ```

2. Batch-friendly DB queries and eager loading

   - Where appropriate, resolvers use a single batched query (or JOIN) to fetch related records for many parents at once, rather than issuing repeated single-row queries.
   - For example, when returning sections for several documents, use `WHERE document_id IN (...)` so all sections are retrieved in one DB call and then grouped by parent.

3. Combine with ORM/model features when available

   - If using an ORM that supports eager loading (e.g., `include`, `populate`), prefer those for complex joins when they perform better than separate queries.

4. Keep resolvers thin and prefer loaders for cross-cutting lookups

   - Put batching/caching logic in `loaders.js` and keep individual resolvers focused on mapping and permissions. This centralizes the N+1 mitigation strategy.

## Where to add new loaders or fixes
- Add new batching loaders in `back/graphql/loaders.js` and expose them on the per-request `context` (file: `back/graphql/context.js`).
- Update resolvers to call `context.<x>Loader.load(id)` (or `.loadMany(ids)`) instead of making raw DB calls per item.

## Quick checklist for contributors
- Ensure every DataLoader is created per-request (in `context`) — do not reuse a single loader instance across requests.
- Prefer batch queries (WHERE IN) for relations; use DataLoader for mapping and caching.
- Test resolver performance with real data shapes to catch remaining N+1 hotspots (look for logs showing many small queries).

---
If you want, I can:
- add a short example DataLoader implementation under `back/graphql/` and wire it into `context.js`, or
- scan the codebase for resolver patterns that still cause N+1 queries and produce a focused list of hotspots.

Created by GitHub Copilot assistant.
