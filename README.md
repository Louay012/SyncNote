# SyncNote - Full Stack Collaborative Documents

SyncNote includes:

- A GraphQL backend for document collaboration, comments, sharing, and subscriptions
- A Next.js frontend with document editor UI and live updates for edits/comments

## Tech Stack

- Backend: Node.js + Express + Apollo Server + PostgreSQL
- Frontend: Next.js + React + Apollo Client
- Real-time: GraphQL Subscriptions over WebSocket
- Auth: JWT (token input in frontend for now; auth screens can be added later)

## Features

- User authentication and profile management
- Document CRUD operations
- Document sharing with collaborators
- Comments on documents
- Real-time subscriptions for document updates and new comments
- Frontend collaborative workspace:
  - Document list (owned and shared)
  - Editor panel
  - Comments panel

## Project Structure

```
back/
  src/
    config/
      env.js
    db/
      postgres.js
    graphql/
      context.js
      pubsub.js
      resolvers.js
      schema.js
      typeDefs.js
    models/
      User.js
      Document.js
      Comment.js
      Share.js
    utils/
      auth.js
      permissions.js
    index.js

front/
  app/
    globals.css
    layout.js
    page.js
  components/
    CommentsPane.js
    DocumentList.js
    EditorPane.js
    TokenPanel.js
  lib/
    apollo.js
    graphql.js
```

## Getting Started

### 1. Install dependencies

```bash
cd back && npm install
cd ../front && npm install
```

### 2. Configure environment variables

Copy `back/.env.example` to `back/.env` and update values:

```env
PORT=4000
POSTGRES_URI=postgres://postgres:postgres@127.0.0.1:5432/syncnote
# Optional: admin DB used only by npm run db:setup
# POSTGRES_ADMIN_URI=postgres://postgres:postgres@127.0.0.1:5432/postgres
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```

Initialize PostgreSQL database and schema:

```bash
cd back
npm run db:setup
```

The schema is defined in `back/src/db/schema.sql` and applied by both backend startup and `db:setup`.

### 3. Configure frontend environment

Copy `front/.env.local.example` to `front/.env.local`:

```env
NEXT_PUBLIC_GRAPHQL_HTTP=http://localhost:4000/graphql
NEXT_PUBLIC_GRAPHQL_WS=ws://localhost:4000/graphql
```

### 4. Run backend

```bash
cd back
npm run dev
```

GraphQL endpoint:

- HTTP: `http://localhost:4000/graphql`
- WS: `ws://localhost:4000/graphql`

Health endpoint:

- `http://localhost:4000/health`

### 5. Run frontend

In a second terminal:

```bash
cd front
npm run dev
```

Frontend URL:

- `http://localhost:3000`

### Run both backend and frontend together (Windows)

From project root, run:

```bat
run-servers.bat
```

This installs dependencies in `back` and `front`, then opens two terminals:
- backend: `npm run dev` in `back`
- frontend: `npm run dev` in `front`

Paste a JWT token into the token field to use authenticated operations.

## GraphQL API

### Queries

- `document(id: ID!)`
- `myDocuments`
- `sharedWithMeDocuments`
- `searchDocuments(keyword: String!)`
- `me`

### Mutations

- `register(name, email, password)`
- `login(email, password)`
- `updateProfile(name)`
- `createDocument(title, content)`
- `updateDocument(id, title, content)`
- `deleteDocument(id)`
- `addComment(documentId, text)`
- `shareDocument(documentId, userEmail, permission)`

### Subscriptions

- `documentUpdated(documentId: ID!)`
- `commentAdded(documentId: ID!)`

## Example Flow

### Register user

```graphql
mutation {
  register(name: "Alice", email: "alice@example.com", password: "password123") {
    token
    user {
      id
      name
      email
    }
  }
}
```

### Create document

```graphql
mutation {
  createDocument(title: "Team Notes", content: "Initial content") {
    id
    title
    content
    owner {
      id
      name
    }
  }
}
```

### Add comment

```graphql
mutation {
  addComment(documentId: "<doc-id>", text: "Looks good") {
    id
    text
    createdAt
    author {
      id
      name
    }
  }
}
```

### Subscribe to document updates

```graphql
subscription {
  documentUpdated(documentId: "<doc-id>") {
    id
    title
    content
    updatedAt
  }
}
```

## Auth

For authenticated operations, pass a bearer token in HTTP headers:

```http
Authorization: Bearer <token>
```

For WebSocket subscriptions, provide `Authorization` in connection params.

Frontend note:

- Auth screens are intentionally deferred.
- Use token from `register` or `login` mutation in the token panel.

## Notes

- Owner always has full access to their documents.
- Shared users can be granted `VIEW` or `EDIT` permission.
- Comment and document update subscriptions only deliver events to users with access to that document.
