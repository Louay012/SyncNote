import { gql } from "@apollo/client";

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        name
        email
        emailVerified
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
        emailVerified
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
      emailVerified
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
        isPublic
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
        isPublic
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
        isPublic
        updatedAt
        owner {
          id
          name
        }
      }
    }
  }
`;

export const SEARCH_OTHER_USERS_DOCUMENTS_BY_TITLE = gql`
  query SearchOtherUsersDocumentsByTitle(
    $keyword: String!
    $mode: DocumentSearchMode
    $limit: Int
    $offset: Int
    $sortBy: DocumentSortField
    $sortDirection: SortDirection
  ) {
    searchOtherUsersDocumentsByTitle(
      keyword: $keyword
      mode: $mode
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
        isPublic
        likesCount
        likedByMe
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
      isPublic
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
      title
      content
      parentId
      order
      updatedAt
      updatedBy {
        id
        name
      }
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
      sectionId
      sectionTitle
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
  mutation CreateDocument($title: String!, $content: String, $isPublic: Boolean) {
    createDocument(title: $title, content: $content, isPublic: $isPublic) {
      id
      title
      isPublic
      updatedAt
    }
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($name: String) {
    updateProfile(name: $name) {
      id
      name
      email
    }
  }
`;

export const UPDATE_PASSWORD = gql`
  mutation UpdatePassword($currentPassword: String!, $newPassword: String!) {
    updatePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      id
      name
      email
    }
  }
`;

export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token)
  }
`;

export const RESEND_VERIFICATION_EMAIL = gql`
  mutation ResendVerificationEmail($email: String!) {
    resendVerificationEmail(email: $email)
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

export const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($id: ID!, $title: String, $content: String, $isPublic: Boolean) {
    updateDocument(id: $id, title: $title, content: $content, isPublic: $isPublic) {
      id
      title
      isPublic
      updatedAt
    }
  }
`;

export const CREATE_SECTION = gql`
  mutation CreateSection($documentId: ID!, $title: String!, $parentId: ID) {
    createSection(documentId: $documentId, title: $title, parentId: $parentId) {
      id
      documentId
      title
      parentId
      order
      content
      updatedAt
      updatedBy {
        id
        name
      }
    }
  }
`;

export const UPDATE_SECTION = gql`
  mutation UpdateSection($sectionId: ID!, $title: String, $content: String) {
    updateSection(sectionId: $sectionId, title: $title, content: $content) {
      id
      documentId
      title
      content
      parentId
      order
      updatedAt
      updatedBy {
        id
        name
      }
    }
  }
`;

export const APPLY_SECTION_OPERATION = gql`
  mutation ApplySectionOperation(
    $sectionId: ID!
    $baseContent: String!
    $operation: SectionContentOperationInput!
  ) {
    applySectionOperation(
      sectionId: $sectionId
      baseContent: $baseContent
      operation: $operation
    ) {
      id
      documentId
      title
      content
      parentId
      order
      updatedAt
      updatedBy {
        id
        name
      }
    }
  }
`;

export const UPDATE_SECTION_CONTENT = gql`
  mutation UpdateSectionContent($sectionId: ID!, $contentDoc: JSON!) {
    updateSectionContent(sectionId: $sectionId, contentDoc: $contentDoc) {
      id
      documentId
      title
      content
      parentId
      order
      updatedAt
      updatedBy {
        id
        name
      }
    }
  }
`;

export const DELETE_SECTION = gql`
  mutation DeleteSection($sectionId: ID!) {
    deleteSection(sectionId: $sectionId)
  }
`;

export const REORDER_SECTION = gql`
  mutation ReorderSection($sectionId: ID!, $order: Int!) {
    reorderSection(sectionId: $sectionId, order: $order) {
      id
      documentId
      title
      parentId
      order
      updatedAt
      updatedBy {
        id
        name
      }
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

export const SEND_COLLABORATION_INVITE = gql`
  mutation SendCollaborationInvite(
    $documentId: ID!
    $userEmail: String!
    $permission: SharePermission
  ) {
    sendCollaborationInvite(
      documentId: $documentId
      userEmail: $userEmail
      permission: $permission
    ) {
      id
      status
      permission
      createdAt
      invitee {
        id
        name
        email
      }
      inviter {
        id
        name
      }
      document {
        id
        title
      }
    }
  }
`;

export const GET_MY_INVITATIONS = gql`
  query GetMyInvitations($status: InvitationStatus) {
    myInvitations(status: $status) {
      id
      status
      permission
      createdAt
      respondedAt
      inviter {
        id
        name
        email
      }
      document {
        id
        title
        updatedAt
      }
    }
  }
`;

export const RESPOND_TO_INVITATION = gql`
  mutation RespondToInvitation($invitationId: ID!, $approve: Boolean!) {
    respondToInvitation(invitationId: $invitationId, approve: $approve) {
      id
      status
      permission
      respondedAt
      document {
        id
        title
      }
    }
  }
`;

export const GET_MY_NOTIFICATIONS = gql`
  query GetMyNotifications($limit: Int, $offset: Int, $unreadOnly: Boolean) {
    myNotifications(limit: $limit, offset: $offset, unreadOnly: $unreadOnly) {
      total
      limit
      offset
      items {
        id
        type
        title
        message
        isRead
        createdAt
        readAt
        actor {
          id
          name
        }
        document {
          id
          title
        }
        invitation {
          id
          status
        }
      }
    }
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($notificationId: ID!) {
    markNotificationRead(notificationId: $notificationId) {
      id
      isRead
      readAt
    }
  }
`;

export const LIKE_DOCUMENT = gql`
  mutation LikeDocument($documentId: ID!) {
    likeDocument(documentId: $documentId) {
      documentId
      likesCount
      likedByMe
    }
  }
`;

export const UNLIKE_DOCUMENT = gql`
  mutation UnlikeDocument($documentId: ID!) {
    unlikeDocument(documentId: $documentId) {
      documentId
      likesCount
      likedByMe
    }
  }
`;

export const UPDATE_TYPING_STATUS = gql`
  mutation UpdateTypingStatus($documentId: ID!, $sectionId: ID, $isTyping: Boolean!) {
    updateTypingStatus(documentId: $documentId, sectionId: $sectionId, isTyping: $isTyping) {
      documentId
      userId
      sectionId
      sectionTitle
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
  mutation UpdatePresence($documentId: ID!, $sectionId: ID) {
    updatePresence(documentId: $documentId, sectionId: $sectionId) {
      userId
      sectionId
      sectionTitle
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

export const USER_NOTIFICATION_RECEIVED = gql`
  subscription UserNotificationReceived {
    userNotificationReceived {
      id
      type
      title
      message
      isRead
      createdAt
      actor {
        id
        name
      }
      document {
        id
        title
      }
      invitation {
        id
        status
      }
    }
  }
`;

export const SECTION_UPDATED = gql`
  subscription OnSectionUpdated($documentId: ID!) {
    sectionUpdated(documentId: $documentId) {
      id
      documentId
      title
      content
      parentId
      order
      updatedAt
      updatedBy {
        id
        name
      }
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
      sectionId
      sectionTitle
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
      sectionId
      sectionTitle
      updatedAt
      user {
        id
        name
        email
      }
    }
  }
`;
