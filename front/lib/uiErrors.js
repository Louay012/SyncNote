export function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || "").trim());
}

export function toFriendlyError(error, fallback = "Something went wrong. Please try again.") {
  const message = String(error?.message || "");
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

  return fallback;
}

export function toFriendlyAuthError(error, mode = "login") {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();

  if (lower.includes("invalid email or password") || lower.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }

  if (mode === "login" && (lower.includes("not found") || lower.includes("does not exist"))) {
    return "This email is not registered.";
  }

  if (mode === "register" && lower.includes("already registered")) {
    return "This email is already registered.";
  }

  if (lower.includes("invalid email format")) {
    return "Please enter a valid email address.";
  }

  return toFriendlyError(error, "Unable to complete authentication. Please try again.");
}
