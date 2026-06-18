 export const typeDefs = `#graphql
  scalar DateTime
  scalar JSON

  enum SharePermission {
    VIEW
    EDIT
  }

  enum DocumentSortField {
    UPDATED_AT
    CREATED_AT
    TITLE
  }

  enum SortDirection {
    ASC
    DESC
  }

  enum DocumentSearchMode {
    TITLE
    CONTENT
  }

  enum InvitationStatus {
    PENDING
    APPROVED
    REJECTED
  }

  enum NotificationType {
    DOCUMENT_EDITED
    DOCUMENT_LIKED
    INVITE_RECEIVED
    INVITE_APPROVED
    INVITE_REJECTED
  }

  enum SectionOperationType {
    INSERT
    DELETE
    REPLACE
  }

  input SectionContentOperationInput {
    type: SectionOperationType!
    position: Int!
    deleteCount: Int
    text: String
  }

  type User {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Section {
    id: ID!
    documentId: ID!
    title: String!
    content: String!
    parentId: ID
    order: Int!
    updatedBy: User
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Version {
    id: ID!
    documentId: ID!
    snapshot: String!
    createdAt: DateTime!
    createdBy: User!
  }
  type Presence {
    userId: ID!
    user: User!
    sectionId: ID
    sectionTitle: String
    updatedAt: DateTime!
  }


  type Document {
    id: ID!
    title: String!
    content: String!
    coverImage: String
    coverTitle: String
    snapshotBase64: String
    isPublic: Boolean!
    owner: User!
    collaborators: [User!]!
    sections: [Section!]!
    comments: [Comment!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DiscoverDocument {
    id: ID!
    title: String!
    isPublic: Boolean!
    owner: User!
    likesCount: Int!
    likedByMe: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DiscoverDocumentPage {
    items: [DiscoverDocument!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type DocumentLikeState {
    documentId: ID!
    likesCount: Int!
    likedByMe: Boolean!
  }

  type CollaborationInvitation {
    id: ID!
    document: Document!
    inviter: User!
    invitee: User!
    permission: SharePermission!
    status: InvitationStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
    respondedAt: DateTime
  }

  type UserNotification {
    id: ID!
    recipient: User!
    actor: User
    type: NotificationType!
    title: String!
    message: String!
    document: Document
    invitation: CollaborationInvitation
    isRead: Boolean!
    createdAt: DateTime!
    readAt: DateTime
  }

  type NotificationPage {
    items: [UserNotification!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type Comment {
    id: ID!
    text: String!
    content: String!
    author: User!
    section: Section!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DiaryPage {
    id: ID!
    documentId: ID!
    pageNumber: Int!
    date: DateTime
    mood: String
    text: String
    wordCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type StickerCatalogItem {
    id: ID!
    group: String!
    label: String!
    emoji: String!
    tags: [String!]!
    packId: String
  }

  type StickerGroup {
    groupName: String!
    count: Int!
  }

  type DiarySticker {
    id: ID!
    documentId: ID!
    catalogStickerId: String
    emoji: String!
    label: String!
    x: Float!
    y: Float!
    rotate: Float!
    scale: Float!
    zIndex: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type StickerPack {
    packId: String!
    groupName: String!
  }

  type Share {
    id: ID!
    document: Document!
    user: User!
    permission: SharePermission!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DocumentPage {
    items: [Document!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    document(id: ID!): Document
    myDocuments(
      limit: Int = 20
      offset: Int = 0
      sortBy: DocumentSortField = UPDATED_AT
      sortDirection: SortDirection = DESC
    ): DocumentPage!
    sharedWithMeDocuments(
      limit: Int = 20
      offset: Int = 0
      sortBy: DocumentSortField = UPDATED_AT
      sortDirection: SortDirection = DESC
    ): DocumentPage!
    searchDocuments(
      keyword: String!
      limit: Int = 20
      offset: Int = 0
      sortBy: DocumentSortField = UPDATED_AT
      sortDirection: SortDirection = DESC
    ): DocumentPage!
    searchOtherUsersDocumentsByTitle(
      keyword: String!
      mode: DocumentSearchMode = TITLE
      limit: Int = 20
      offset: Int = 0
      sortBy: DocumentSortField = UPDATED_AT
      sortDirection: SortDirection = DESC
    ): DiscoverDocumentPage!
    getSections(documentId: ID!): [Section!]!
    getVersions(documentId: ID!): [Version!]!
    commentsBySection(sectionId: ID!): [Comment!]!
    documentPresence(documentId: ID!): [Presence!]!
    myInvitations(status: InvitationStatus): [CollaborationInvitation!]!
    myNotifications(
      limit: Int = 20
      offset: Int = 0
      unreadOnly: Boolean = false
    ): NotificationPage!
    listDiaryEntries(documentId: ID!): [DiaryPage!]!
    stickerCatalog(group: String, packId: String, search: String): [StickerCatalogItem!]!
    stickerGroups: [StickerGroup!]!
    stickerPacks: [StickerPack!]!
    diaryStickers(documentId: ID!): [DiarySticker!]!
  }

  type Mutation {
    register(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(name: String): User!
    updatePassword(currentPassword: String!, newPassword: String!): User!
    verifyEmail(token: String!): Boolean!
    resendVerificationEmail(email: String!): Boolean!
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!

    createDocument(title: String!, content: String, isPublic: Boolean = false, coverImage: String, coverTitle: String): Document!
    updateDocument(id: ID!, title: String, content: String, isPublic: Boolean, coverImage: String, coverTitle: String): Document!
    deleteDocument(id: ID!): Boolean!

    createSection(documentId: ID!, title: String!, parentId: ID): Section!
    updateSection(sectionId: ID!, title: String, content: String): Section!
    applySectionOperation(
      sectionId: ID!
      baseContent: String!
      operation: SectionContentOperationInput!
    ): Section!
    updateSectionContent(sectionId: ID!, contentDoc: JSON!): Section!
    deleteSection(sectionId: ID!): Boolean!
    reorderSection(sectionId: ID!, order: Int!): Section!

    saveVersion(documentId: ID!): Version!
    saveDocumentSnapshot(documentId: ID!, snapshotBase64: String!): Boolean!
    restoreVersion(versionId: ID!): Document!

    addComment(sectionId: ID!, content: String!): Comment!
    unshareDocument(documentId: ID!, userEmail: String!): Boolean!
    sendCollaborationInvite(
      documentId: ID!
      userEmail: String!
      permission: SharePermission = EDIT
    ): CollaborationInvitation!
    respondToInvitation(invitationId: ID!, approve: Boolean!): CollaborationInvitation!
    markNotificationRead(notificationId: ID!): UserNotification!
    likeDocument(documentId: ID!): DocumentLikeState!
    unlikeDocument(documentId: ID!): DocumentLikeState!

    # Note: live typing is handled by the Yjs websocket (CRDT + awareness)
    updatePresence(documentId: ID!, sectionId: ID): [Presence!]!
    leaveDocument(documentId: ID!): Boolean!
    createDiaryEntry(documentId: ID!, date: String, mood: String, text: String!, pageNumber: Int): DiaryPage!
    updateDiaryEntry(id: ID!, mood: String, text: String!): DiaryPage!
    placeSticker(documentId: ID!, catalogStickerId: String, emoji: String!, label: String, x: Float, y: Float, rotate: Float, scale: Float): DiarySticker!
    updateSticker(id: ID!, x: Float, y: Float, rotate: Float, scale: Float, zIndex: Int): DiarySticker!
    removeSticker(id: ID!): DiarySticker!
  }

  type Subscription {
    sectionUpdated(documentId: ID!): Section!
    commentAdded(sectionId: ID!): Comment!
    userPresenceChanged(documentId: ID!): [Presence!]!
    userNotificationReceived: UserNotification!
  }
`;
