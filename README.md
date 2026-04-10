# SyncNote

SyncNote is a full-stack collaborative document workspace with a GraphQL backend and a Next.js frontend.

It includes:

- Authentication with email verification and password reset
- Document collaboration with owner/collaborator permissions
- Section/subsection editing with autosave
- Section comments and version snapshots
- Invitations and notifications
- Public discovery and document likes
- Realtime subscriptions (sections/comments/typing/presence/notifications)
- Live remote cursor streaming with Socket.IO
- Generated GraphQL docs using Magidoc

## Tech Stack

- Backend: Node.js, Express, Apollo Server, graphql-ws, PostgreSQL
- Frontend: Next.js (App Router), React, Apollo Client, TipTap
- Realtime: GraphQL subscriptions + Socket.IO
- Auth: JWT (Bearer)

## Architecture

1. Frontend sends GraphQL queries/mutations over HTTP and subscriptions over WebSocket.
2. Backend builds request context (current user + DataLoaders).
3. Resolvers validate input and permissions, then call model layer.
4. Models execute SQL on PostgreSQL.
5. PubSub and Socket.IO emit realtime events back to clients.

Main backend flow:

- back/src/index.js
- back/src/graphql/context.js
- back/src/graphql/resolvers.js
- back/src/models/*

Main frontend flow:

- front/lib/apollo.js
- front/lib/graphql.js
- front/components/WorkspaceApp.js

## Features Implemented

### Auth and account

- Register, login, profile update, password change
- Email verification flow
- Password reset flow (request + token reset)
- Route guards via Next.js middleware

### Documents and sections

- Create/update/delete documents
- Public/private document visibility
- Section tree: root sections + one level of subsections
- Section reorder, title updates, content updates
- String-operation based section autosave (`INSERT`, `DELETE`, `REPLACE`)

### Collaboration

- Share by invitation (`VIEW` / `EDIT`)
- Approve/decline invitations
- Remove collaborator access
- Presence and typing status by document/section

### Social and activity

- Like/unlike public documents
- Notification center for likes and invitation events
- Mark notifications as read

### Realtime

- GraphQL subscriptions:
  - `sectionUpdated(documentId)`
  - `commentAdded(sectionId)`
  - `userTyping(documentId)`
  - `userPresenceChanged(documentId)`
  - `userNotificationReceived`
- Socket.IO cursor channel for low-latency remote cursor updates

### API docs

- Magidoc static site generated from the schema
- Served by backend at /docs/graphql

## Project Structure

```text
back/
  magidoc.mjs
  scripts/
    setup-postgres.js
  src/
    config/
      env.js
    db/
      postgres.js
      schema.js
      schema.sql
    graphql/
      context.js
      loaders.js
      pubsub.js
      resolvers.js
      schema.js
      typeDefs.js
    models/
      _shared.js
      User.js
      Document.js
      Section.js
      Comment.js
      Share.js
      Invitation.js
      Notification.js
      Like.js
      Version.js
    realtime/
      cursorSocket.js
    utils/
      auth.js
      email.js
      permissions.js
    index.js

front/
  app/
    auth/
      check-email/page.js
      forgot-password/page.js
      reset-password/page.js
      verify/page.js
      page.js
    doc/[id]/page.js
    discover/page.js
    documents/page.js
    invitations/page.js
    profile/page.js
    settings/page.js
    layout.js
    page.js
    loading.js
    error.js
    not-found.js
  components/
    AppShell.js
    AuthPanel.js
    AuthScreen.js
    DashboardPage.js
    DocumentsPage.js
    DiscoverPage.js
    WorkspaceApp.js
    EditorPane.js
    RichTextEditor.js
    SectionsTree.js
    SectionItem.js
    CommentsPane.js
    VersionPanel.js
    NotificationCenter.js
    InvitationsPage.js
    ProfilePage.js
    SettingsPage.js
    SidebarNavigation.js
    ThemeToggle.js
    TabsPanel.js
    plus support pages/components
  lib/
    apollo.js
    graphql.js
    authToken.js
    useAuthSession.js
    uiErrors.js
    richTextDoc.js
    cursorSocket.js
    cursorColors.js
  middleware.js
```

## Getting Started

## 1. Install dependencies

```bash
cd back
npm install

cd ../front
npm install
```

## 2. Configure backend env

Copy back/.env.example to back/.env.

Required:

```env
POSTGRES_URI=postgres://postgres:postgres@127.0.0.1:5432/syncnote
JWT_SECRET=change_this_secret
```

Common optional values:

```env
PORT=4000
APP_URL=http://localhost:3000
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
GRAPHQL_INTROSPECTION=true
GRAPHQL_DOCS_ENABLED=true

# SMTP (enable real verification/reset emails)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=SyncNote <no-reply@syncnote.local>
```

## 3. Configure frontend env

Copy front/.env.local.example to front/.env.local.

```env
NEXT_PUBLIC_GRAPHQL_HTTP=http://localhost:4000/graphql
NEXT_PUBLIC_GRAPHQL_WS=ws://localhost:4000/graphql

# Optional cursor socket override
# NEXT_PUBLIC_CURSOR_SOCKET_URL=http://localhost:4000
# NEXT_PUBLIC_CURSOR_SOCKET_PATH=/cursor
```

## 4. Initialize database schema

```bash
cd back
npm run db:setup
```

## 5. Run services

Backend:

```bash
cd back
npm run dev
```

Frontend:

```bash
cd front
npm run dev
```

Windows helper:

```bat
run-servers.bat
```

## Endpoints

- GraphQL HTTP: http://localhost:4000/graphql
- GraphQL WS: ws://localhost:4000/graphql
- Health: http://localhost:4000/health
- API docs UI: http://localhost:4000/docs/graphql

## GraphQL Examples (Current Schema)

Register:

```graphql
mutation Register {
  register(name: "Alice", email: "alice@example.com", password: "password123") {
    token
    user {
      id
      name
      email
      emailVerified
    }
  }
}
```

Create document:

```graphql
mutation CreateDocument {
  createDocument(title: "Team Notes", content: "Initial content", isPublic: false) {
    id
    title
    isPublic
    updatedAt
  }
}
```

Get sections:

```graphql
query GetSections {
  getSections(documentId: "1") {
    id
    title
    content
    parentId
    order
  }
}
```

Add comment (section-scoped):

```graphql
mutation AddComment {
  addComment(sectionId: "10", content: "Looks good") {
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

Subscribe to section updates:

```graphql
subscription OnSectionUpdated {
  sectionUpdated(documentId: "1") {
    id
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

## API Documentation (Magidoc)

Generate static docs:

```bash
cd back
npm run docs:generate
```

Dev mode docs:

```bash
npm run docs:dev
```

Preview generated docs:

```bash
npm run docs:preview
```

Note: If docs are enabled but not generated, /docs/graphql returns a 503 guidance response.

## Auth Notes

- Use Authorization: Bearer <token> for authenticated GraphQL operations.
- Subscriptions send bearer token via WebSocket connectionParams.
- Frontend middleware protects private routes and redirects unauthenticated users to /auth.

## Production Checklist

- Set NODE_ENV=production
- Set GRAPHQL_INTROSPECTION=false
- Set GRAPHQL_DOCS_ENABLED=false unless docs are intentionally public
- Set strict CORS_ORIGIN (no wildcard)
- Configure SMTP credentials for real transactional email
- Use secure JWT secret and managed PostgreSQL credentials

## Known Limitations

- No automated test suite is configured yet.
- Linting is minimal (back has placeholder lint script).
- Section initialization (Section.ensureDefaults) may be a hotspot in some heavy list workloads.
