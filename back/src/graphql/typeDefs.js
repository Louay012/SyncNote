export const typeDefs = `#graphql
  scalar DateTime

  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Document {
    id: ID!
    title: String!
    content: String!
    owner: User!
    collaborators: [User!]!
    comments: [Comment!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Comment {
    id: ID!
    text: String!
    author: User!
    document: Document!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Share {
    id: ID!
    document: Document!
    user: User!
    permission: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    document(id: ID!): Document
    myDocuments: [Document!]!
    sharedWithMeDocuments: [Document!]!
    searchDocuments(keyword: String!): [Document!]!
  }

  type Mutation {
    register(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(name: String): User!

    createDocument(title: String!, content: String): Document!
    updateDocument(id: ID!, title: String, content: String!): Document!
    deleteDocument(id: ID!): Boolean!

    addComment(documentId: ID!, text: String!): Comment!
    shareDocument(documentId: ID!, userEmail: String!, permission: String = "EDIT"): Share!
  }

  type Subscription {
    documentUpdated(documentId: ID!): Document!
    commentAdded(documentId: ID!): Comment!
  }
`;
