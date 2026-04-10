# SyncNote Technical Resume

Last verified: 2026-04-10

## 1. Scope Implemented

SyncNote is implemented as a complete collaborative document system with:

- JWT auth and protected frontend routes
- Email verification and password reset workflows
- Document ownership and collaborator permission model
- Section-based editor with autosave operations
- Section comments, version snapshots, and restore
- Invitation and notification lifecycle
- Public discovery and document likes
- Realtime collaboration signals (presence, typing, section updates, comments)
- Realtime remote cursor streaming
- Generated GraphQL documentation with Magidoc

## 2. Runtime Topology

### Backend service

- Express HTTP server
- Apollo GraphQL endpoint (`/graphql`)
- GraphQL subscription WebSocket on same path (`/graphql`)
- Socket.IO server for cursor channel (`/cursor`)
- Optional static Magidoc route (`/docs/graphql`)

Entry point:

- back/src/index.js

### Frontend service

- Next.js app (port 3000 by script)
- App Router pages for auth, dashboard, editor, documents, discover, invitations, profile, settings
- Apollo Client split links (HTTP for query/mutation, WS for subscription)
- Socket.IO client for cursor sync

Main orchestration:

- front/components/WorkspaceApp.js

## 3. Backend Implementation Inventory

### 3.1 GraphQL contract and execution

Files:

- back/src/graphql/typeDefs.js
- back/src/graphql/resolvers.js
- back/src/graphql/schema.js
- back/src/graphql/context.js
- back/src/graphql/loaders.js
- back/src/graphql/pubsub.js

Implemented GraphQL areas:

1. Auth and identity
   - register, login, verifyEmail, resendVerificationEmail
   - requestPasswordReset, resetPassword
   - updateProfile, updatePassword

2. Documents and sections
   - document, myDocuments, sharedWithMeDocuments, searchDocuments, searchOtherUsersDocumentsByTitle
   - createDocument, updateDocument, deleteDocument
   - getSections, createSection, updateSection, applySectionOperation, deleteSection, reorderSection

3. Comments and versions
   - commentsBySection, addComment
   - getVersions, saveVersion, restoreVersion

4. Collaboration and notifications
   - sendCollaborationInvite, respondToInvitation, unshareDocument
   - myInvitations
   - myNotifications, markNotificationRead
   - likeDocument, unlikeDocument

5. Realtime
   - updateTypingStatus, updatePresence, leaveDocument
   - sectionUpdated, commentAdded, userTyping, userPresenceChanged, userNotificationReceived

### 3.2 DataLoader and N+1 control

Request-scoped batching/caching implemented in back/src/graphql/loaders.js:

- usersById
- documentsById
- sectionsById
- sectionsByDocumentId
- sharesByDocumentId
- commentsByDocumentId
- likesCountByDocumentId
- documentLikedByUser
- invitationsById

This is consumed by field resolvers in back/src/graphql/resolvers.js.

### 3.3 Permission and validation model

Permission checks:

- canAccessDocument
- canEditDocument
- ensureDocumentOwner
- ensureSectionAccess
- ensureSectionEditAccess

File:

- back/src/utils/permissions.js

Auth helpers:

- hashPassword, comparePassword
- signToken
- getUserIdFromAuthHeader

File:

- back/src/utils/auth.js

### 3.4 Realtime and PubSub

Domain events through graphql-subscriptions PubSub:

- back/src/graphql/pubsub.js

Cursor events through Socket.IO:

- back/src/realtime/cursorSocket.js

The cursor channel maintains per-document cursor state, sequence ordering, join/leave handling, and access checks.

### 3.5 Persistence layer

Database schema and bootstrap:

- back/src/db/schema.sql
- back/src/db/schema.js
- back/scripts/setup-postgres.js
- back/src/db/postgres.js

Models implemented:

- back/src/models/User.js
- back/src/models/Document.js
- back/src/models/Section.js
- back/src/models/Comment.js
- back/src/models/Share.js
- back/src/models/Invitation.js
- back/src/models/Notification.js
- back/src/models/Like.js
- back/src/models/Version.js
- back/src/models/_shared.js

## 4. Frontend Implementation Inventory

### 4.1 Routes

App routes implemented under front/app:

- /auth
- /auth/check-email
- /auth/forgot-password
- /auth/reset-password
- /auth/verify
- /
- /documents
- /discover
- /doc/[id]
- /invitations
- /profile
- /settings
- system pages: loading, error, not-found

Route protection implemented in:

- front/middleware.js

### 4.2 Client data and networking

Apollo client and transport split:

- front/lib/apollo.js

GraphQL operation document set:

- front/lib/graphql.js

Session/token handling:

- front/lib/authToken.js
- front/lib/useAuthSession.js

Cursor transport:

- front/lib/cursorSocket.js

### 4.3 UI/feature modules

Core orchestration:

- front/components/WorkspaceApp.js

Editor stack:

- front/components/EditorPane.js
- front/components/RichTextEditor.js
- front/components/SectionsTree.js
- front/components/SectionItem.js
- front/components/CommentsPane.js
- front/components/VersionPanel.js

App shell and pages:

- front/components/AppShell.js
- front/components/SidebarNavigation.js
- front/components/DashboardPage.js
- front/components/DocumentsPage.js
- front/components/DiscoverPage.js
- front/components/InvitationsPage.js
- front/components/ProfilePage.js
- front/components/SettingsPage.js
- front/components/NotificationCenter.js

Auth screens:

- front/components/AuthScreen.js
- front/components/AuthPanel.js

Theme/presentation:

- front/components/ThemeToggle.js
- front/app/globals.css

## 5. Configuration Surface

### 5.1 Backend env

Required:

- POSTGRES_URI
- JWT_SECRET

Supported optionals:

- PORT
- APP_URL
- JWT_EXPIRES_IN
- CORS_ORIGIN
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM
- GRAPHQL_INTROSPECTION
- GRAPHQL_DOCS_ENABLED

Reference:

- back/.env.example

### 5.2 Frontend env

Implemented:

- NEXT_PUBLIC_GRAPHQL_HTTP
- NEXT_PUBLIC_GRAPHQL_WS

Optional cursor overrides implemented:

- NEXT_PUBLIC_CURSOR_SOCKET_URL
- NEXT_PUBLIC_CURSOR_SOCKET_PATH

Reference:

- front/.env.local.example
- front/lib/cursorSocket.js

## 6. Scripts and Operational Commands

Backend scripts:

- npm run dev
- npm run start
- npm run db:setup
- npm run docs:generate
- npm run docs:dev
- npm run docs:preview

Frontend scripts:

- npm run dev
- npm run build
- npm run start

Windows convenience launcher:

- run-servers.bat

## 7. Data and Domain Characteristics

- Sections store both plain text and rich-text JSON representation (`content_doc`), with migration fallback in schema SQL.
- Versions store section snapshots (`snapshot` JSONB).
- Invitations are unique per (document, invitee) and are upserted to pending when re-sent.
- Notifications support typed events for likes and invitation state changes.
- Presence uses TTL-based in-memory map on backend.

## 8. Non-Functional Status

Implemented:

- Request-scoped DataLoader strategy for relation-heavy GraphQL fields
- Resolver-level authorization checks
- Runtime schema bootstrap for PostgreSQL
- Backward compatibility logic for legacy section/comment schema transitions

Current constraints:

- Automated tests are not yet present
- Backend lint script is placeholder
- Some `Section.ensureDefaults` call paths may be optimized in high-load scenarios

## 9. Magidoc Integration Status

Implemented and active:

- Config: back/magidoc.mjs
- Output: back/public/graphql-docs
- Serve path: /docs/graphql (when enabled)
- If docs files are missing, backend responds with 503 guidance message

## 10. Equivalence Statement

This file reflects the currently implemented functionality and structure in the repository and is intended as a technical implementation resume, not as a quick-start README replacement.
