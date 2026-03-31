import { gql } from "@apollo/client";

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        name
        email
      }
    }
  }
`;

export const REGISTER = gql`
  mutation Register($name: String!, $email: String!, $password: String!) {
    register(name: $name, email: $email, password: $password) {
      token
      user {
        id
        name
        email
      }
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      name
      email
    }
  }
`;

export const GET_MY_DOCUMENTS = gql`
  query GetMyDocuments(
    $limit: Int
    $offset: Int
    $sortBy: DocumentSortField
    $sortDirection: SortDirection
  ) {
    myDocuments(
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      total
      limit
      offset
      items {
        id
        title
        updatedAt
        owner {
          id
          name
        }
      }
    }
  }
`;

export const GET_SHARED_DOCUMENTS = gql`
  query GetSharedDocuments(
    $limit: Int
    $offset: Int
    $sortBy: DocumentSortField
    $sortDirection: SortDirection
  ) {
    sharedWithMeDocuments(
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      total
      limit
      offset
      items {
        id
        title
        updatedAt
        owner {
          id
          name
        }
      }
    }
  }
`;

export const SEARCH_DOCUMENTS = gql`
  query SearchDocuments(
    $keyword: String!
    $limit: Int
    $offset: Int
    $sortBy: DocumentSortField
    $sortDirection: SortDirection
  ) {
    searchDocuments(
      keyword: $keyword
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      total
      limit
      offset
      items {
        id
        title
        updatedAt
        owner {
          id
          name
        }
      }
    }
  }
`;

export const GET_DOCUMENT = gql`
  query GetDocument($id: ID!) {
    document(id: $id) {
      id
      title
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
    }
  }
`;

export const GET_SECTIONS = gql`
  query GetSections($documentId: ID!) {
    getSections(documentId: $documentId) {
      id
      documentId
      type
      content
      updatedAt
    }
  }
`;

export const GET_VERSIONS = gql`
  query GetVersions($documentId: ID!) {
    getVersions(documentId: $documentId) {
      id
      documentId
      snapshot
      createdAt
      createdBy {
        id
        name
      }
    }
  }
`;

export const GET_SECTION_COMMENTS = gql`
  query GetSectionComments($sectionId: ID!) {
    commentsBySection(sectionId: $sectionId) {
      id
      content
      text
      createdAt
      author {
        id
        name
      }
      section {
        id
      }
    }
  }
`;

export const GET_DOCUMENT_PRESENCE = gql`
  query GetDocumentPresence($documentId: ID!) {
    documentPresence(documentId: $documentId) {
      userId
      sectionType
      updatedAt
      user {
        id
        name
        email
      }
    }
  }
`;

export const CREATE_DOCUMENT = gql`
  mutation CreateDocument($title: String!, $content: String) {
    createDocument(title: $title, content: $content) {
      id
      title
      updatedAt
    }
  }
`;

export const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($id: ID!, $title: String, $content: String) {
    updateDocument(id: $id, title: $title, content: $content) {
      id
      title
      updatedAt
    }
  }
`;

export const UPDATE_SECTION = gql`
  mutation UpdateSection($sectionId: ID!, $content: String!) {
    updateSection(sectionId: $sectionId, content: $content) {
      id
      documentId
      type
      content
      updatedAt
    }
  }
`;

export const SAVE_VERSION = gql`
  mutation SaveVersion($documentId: ID!) {
    saveVersion(documentId: $documentId) {
      id
      createdAt
      createdBy {
        id
        name
      }
    }
  }
`;

export const RESTORE_VERSION = gql`
  mutation RestoreVersion($versionId: ID!) {
    restoreVersion(versionId: $versionId) {
      id
      title
      updatedAt
    }
  }
`;

export const ADD_COMMENT = gql`
  mutation AddComment($sectionId: ID!, $content: String!) {
    addComment(sectionId: $sectionId, content: $content) {
      id
      content
      text
      createdAt
      author {
        id
        name
      }
      section {
        id
      }
    }
  }
`;

export const SHARE_DOCUMENT = gql`
  mutation ShareDocument($documentId: ID!, $userEmail: String!, $permission: SharePermission) {
    shareDocument(documentId: $documentId, userEmail: $userEmail, permission: $permission) {
      id
      permission
      user {
        id
        name
        email
      }
    }
  }
`;

export const UNSHARE_DOCUMENT = gql`
  mutation UnshareDocument($documentId: ID!, $userEmail: String!) {
    unshareDocument(documentId: $documentId, userEmail: $userEmail)
  }
`;

export const UPDATE_TYPING_STATUS = gql`
  mutation UpdateTypingStatus($documentId: ID!, $sectionType: String!, $isTyping: Boolean!) {
    updateTypingStatus(
      documentId: $documentId
      sectionType: $sectionType
      isTyping: $isTyping
    ) {
      documentId
      userId
      sectionType
      isTyping
      at
      user {
        id
        name
      }
    }
  }
`;

export const UPDATE_PRESENCE = gql`
  mutation UpdatePresence($documentId: ID!, $sectionType: String) {
    updatePresence(documentId: $documentId, sectionType: $sectionType) {
      userId
      sectionType
      updatedAt
      user {
        id
        name
        email
      }
    }
  }
`;

export const LEAVE_DOCUMENT = gql`
  mutation LeaveDocument($documentId: ID!) {
    leaveDocument(documentId: $documentId)
  }
`;

export const SECTION_UPDATED = gql`
  subscription OnSectionUpdated($documentId: ID!) {
    sectionUpdated(documentId: $documentId) {
      id
      documentId
      type
      content
      updatedAt
    }
  }
`;

export const COMMENT_ADDED = gql`
  subscription OnCommentAdded($sectionId: ID!) {
    commentAdded(sectionId: $sectionId) {
      id
      content
      text
      createdAt
      author {
        id
        name
      }
      section {
        id
      }
    }
  }
`;

export const USER_TYPING = gql`
  subscription OnUserTyping($documentId: ID!) {
    userTyping(documentId: $documentId) {
      documentId
      userId
      sectionType
      isTyping
      at
      user {
        id
        name
      }
    }
  }
`;

export const USER_PRESENCE_CHANGED = gql`
  subscription OnUserPresenceChanged($documentId: ID!) {
    userPresenceChanged(documentId: $documentId) {
      userId
      sectionType
      updatedAt
      user {
        id
        name
        email
      }
    }
  }
`;
