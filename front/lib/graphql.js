import { gql } from "@apollo/client";

export const GET_MY_DOCUMENTS = gql`
  query GetMyDocuments {
    myDocuments {
      id
      title
      updatedAt
      owner {
        id
        name
      }
    }
  }
`;

export const GET_SHARED_DOCUMENTS = gql`
  query GetSharedDocuments {
    sharedWithMeDocuments {
      id
      title
      updatedAt
      owner {
        id
        name
      }
    }
  }
`;

export const GET_DOCUMENT = gql`
  query GetDocument($id: ID!) {
    document(id: $id) {
      id
      title
      content
      updatedAt
      owner {
        id
        name
      }
      collaborators {
        id
        name
        email
      }
      comments {
        id
        text
        createdAt
        author {
          id
          name
        }
      }
    }
  }
`;

export const CREATE_DOCUMENT = gql`
  mutation CreateDocument($title: String!, $content: String) {
    createDocument(title: $title, content: $content) {
      id
      title
      content
      updatedAt
    }
  }
`;

export const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($id: ID!, $title: String, $content: String!) {
    updateDocument(id: $id, title: $title, content: $content) {
      id
      title
      content
      updatedAt
    }
  }
`;

export const ADD_COMMENT = gql`
  mutation AddComment($documentId: ID!, $text: String!) {
    addComment(documentId: $documentId, text: $text) {
      id
      text
      createdAt
      author {
        id
        name
      }
    }
  }
`;

export const DOCUMENT_UPDATED = gql`
  subscription OnDocumentUpdated($documentId: ID!) {
    documentUpdated(documentId: $documentId) {
      id
      title
      content
      updatedAt
    }
  }
`;

export const COMMENT_ADDED = gql`
  subscription OnCommentAdded($documentId: ID!) {
    commentAdded(documentId: $documentId) {
      id
      text
      createdAt
      author {
        id
        name
      }
    }
  }
`;
