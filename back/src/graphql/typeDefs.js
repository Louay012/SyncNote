export const typeDefs = `#graphql
  scalar DateTime

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

  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Section {
    id: ID!
    documentId: ID!
    type: String!
    content: String!
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
    sectionType: String!
    updatedAt: DateTime!
  }

  type TypingEvent {
    documentId: ID!
    userId: ID!
    user: User!
    sectionType: String!
    isTyping: Boolean!
    at: DateTime!
  }

  type Document {
    id: ID!
    title: String!
    content: String!
    owner: User!
    collaborators: [User!]!
    sections: [Section!]!
    comments: [Comment!]!
    createdAt: DateTime!
    updatedAt: DateTime!
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
    getSections(documentId: ID!): [Section!]!
    getVersions(documentId: ID!): [Version!]!
    commentsBySection(sectionId: ID!): [Comment!]!
    documentPresence(documentId: ID!): [Presence!]!
  }

  type Mutation {
    register(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(name: String): User!

    createDocument(title: String!, content: String): Document!
    updateDocument(id: ID!, title: String, content: String): Document!
    deleteDocument(id: ID!): Boolean!

    updateSection(sectionId: ID!, content: String!): Section!
    saveVersion(documentId: ID!): Version!
    restoreVersion(versionId: ID!): Document!

    addComment(sectionId: ID!, content: String!): Comment!
    shareDocument(documentId: ID!, userEmail: String!, permission: SharePermission = EDIT): Share!
    unshareDocument(documentId: ID!, userEmail: String!): Boolean!

    updateTypingStatus(documentId: ID!, sectionType: String!, isTyping: Boolean!): TypingEvent!
    updatePresence(documentId: ID!, sectionType: String = "summary"): [Presence!]!
    leaveDocument(documentId: ID!): Boolean!
  }

  type Subscription {
    sectionUpdated(documentId: ID!): Section!
    commentAdded(sectionId: ID!): Comment!
    userTyping(documentId: ID!): TypingEvent!
    userPresenceChanged(documentId: ID!): [Presence!]!
  }
`;
