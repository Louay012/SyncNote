export function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || "").trim());
}

function extractErrorMessage(error) {
  const graphQLError =
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.cause?.graphQLErrors?.[0]?.message;

  if (graphQLError) {
    return String(graphQLError);
  }

  return String(error?.message || "");
}

export function toFriendlyError(error, fallback = "Something went wrong. Please try again.") {
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Network issue detected. Please check your connection and try again.";
  }

  if (lower.includes("timeout")) {
    return "The request timed out. Please try again.";
  }

  if (lower.includes("email delivery is not configured")) {
    return "Email sending is not configured on this server.";
  }

  if (lower.includes("collaborator not found") || lower.includes("no account found")) {
    return "No user found with this email address.";
  }

  if (lower.includes("user is already a collaborator")) {
    return "This user is already a collaborator on the document.";
  }

  if (lower.includes("owner cannot invite themselves") || lower.includes("owner already has access")) {
    return "You already have full access to this document.";
  }

  if (lower.includes("permission must be view or edit")) {
    return "Permission must be either VIEW or EDIT.";
  }

  if (lower.includes("you do not have permission")) {
    return "You do not have permission to perform this action.";
  }

  if (lower.includes("document not found")) {
    return "Document not found or no longer accessible.";
  }

  if (lower.includes("section not found")) {
    return "Section not found. It may have been deleted.";
  }

  if (lower.includes("section content is out of date")) {
    return "This section changed in another session. Please retry your edit.";
  }

  return fallback;
}

export function toFriendlyAuthError(error, mode = "login") {
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("invalid email or password") || lower.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }

  if (lower.includes("please verify your email before signing in")) {
    return "Please verify your email before signing in.";
  }

  if (lower.includes("email delivery is not configured")) {
    if (mode === "reset") {
      return "Password reset email is unavailable because email sending is not configured.";
    }
    return "Email sending is not configured on this server.";
  }

  if (mode === "login" && (lower.includes("not found") || lower.includes("does not exist"))) {
    return "This email is not registered.";
  }

  if (mode === "register" && lower.includes("already registered")) {
    return "This email is already registered.";
  }

  if (lower.includes("verification token is required")) {
    return "Missing verification token.";
  }

  if (lower.includes("verification link is invalid or expired")) {
    return "Verification link is invalid or expired. Request a new email.";
  }

  if (lower.includes("password reset token is required")) {
    return "Missing password reset token. Please request a new reset email.";
  }

  if (lower.includes("password reset link is invalid or expired")) {
    return "Password reset link is invalid or expired. Request a new one.";
  }

  if (lower.includes("no account found with this email")) {
    return "No account found with this email address.";
  }

  if (lower.includes("current password is incorrect")) {
    return "Current password is incorrect.";
  }

  if (lower.includes("new password must be different")) {
    return "New password must be different from your current password.";
  }

  if (lower.includes("at least 8 characters")) {
    return "Password must be at least 8 characters.";
  }

  if (lower.includes("invalid email format")) {
    return "Please enter a valid email address.";
  }

  if (mode === "verify") {
    return toFriendlyError(error, "Unable to verify email. Please request a new verification link.");
  }

  if (mode === "reset") {
    return toFriendlyError(error, "Unable to reset password. Please request a new reset link.");
  }

  if (mode === "register") {
    return toFriendlyError(error, "Unable to create your account. Please try again.");
  }

  if (mode === "password") {
    return toFriendlyError(error, "Unable to update password. Please try again.");
  }

  return toFriendlyError(error, "Unable to complete authentication. Please try again.");
}
