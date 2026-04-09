"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { clearStoredToken } from "@/lib/authToken";
import { GET_ME, UPDATE_PASSWORD, UPDATE_PROFILE } from "@/lib/graphql";
import { toFriendlyAuthError, toFriendlyError } from "@/lib/uiErrors";

export default function ProfilePage() {
  const router = useRouter();
  const apolloClient = useApolloClient();
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameNotice, setNameNotice] = useState("");

  const [passwordValues, setPasswordValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordNotice, setPasswordNotice] = useState("");

  const { data, loading, error, refetch } = useQuery(GET_ME, {
    fetchPolicy: "cache-and-network"
  });
  const [updateProfile, { loading: updatingName }] = useMutation(UPDATE_PROFILE);
  const [updatePassword, { loading: updatingPassword }] = useMutation(UPDATE_PASSWORD);

  useEffect(() => {
    if (data?.me?.name) {
      setNameInput(data.me.name);
    }
  }, [data?.me?.name]);

  function handleLogout() {
    clearStoredToken();
    apolloClient.clearStore();
    router.replace("/auth");
  }

  function handlePasswordField(field, value) {
    setPasswordValues((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleNameSubmit(event) {
    event.preventDefault();
    const nextName = String(nameInput || "").trim();

    if (!nextName) {
      setNameError("Name is required.");
      return;
    }

    setNameError("");
    setNameNotice("");

    try {
      await updateProfile({ variables: { name: nextName } });
      await refetch();
      setNameNotice("Name updated successfully.");
    } catch (mutationError) {
      setNameError(toFriendlyError(mutationError, "Unable to update name."));
    }
  }

  function validatePasswordForm() {
    const nextErrors = {};

    if (!passwordValues.currentPassword.trim()) {
      nextErrors.currentPassword = "Current password is required.";
    }

    if (!passwordValues.newPassword.trim()) {
      nextErrors.newPassword = "New password is required.";
    } else if (passwordValues.newPassword.length < 8) {
      nextErrors.newPassword = "New password must be at least 8 characters.";
    }

    if (!passwordValues.confirmPassword.trim()) {
      nextErrors.confirmPassword = "Please confirm your new password.";
    } else if (passwordValues.confirmPassword !== passwordValues.newPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (
      passwordValues.currentPassword.trim() &&
      passwordValues.newPassword.trim() &&
      passwordValues.currentPassword === passwordValues.newPassword
    ) {
      nextErrors.newPassword = "New password must be different from current password.";
    }

    return nextErrors;
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    const nextErrors = validatePasswordForm();
    setPasswordErrors(nextErrors);
    setPasswordNotice("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await updatePassword({
        variables: {
          currentPassword: passwordValues.currentPassword,
          newPassword: passwordValues.newPassword
        }
      });

      setPasswordNotice("Password updated successfully.");
      setPasswordValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (mutationError) {
      setPasswordNotice(toFriendlyAuthError(mutationError, "password"));
    }
  }

  return (
    <AppShell title="Profile" subtitle="Manage your account details." onLogout={handleLogout}>
      <section className="profile-center">
        {error ? (
          <section className="panel notice-panel error-notice">
            <p>{toFriendlyError(error)}</p>
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          </section>
        ) : null}

        <section className="panel profile-panel">
          <h2>Account</h2>
          {loading ? <p>Loading profile...</p> : null}
          {!loading && !error ? (
            <div className="profile-grid">
              <p>
                <strong>Name:</strong> {data?.me?.name || "Unknown"}
              </p>
              <p>
                <strong>Email:</strong> {data?.me?.email || "Unknown"}
              </p>
            </div>
          ) : null}
        </section>

        <section className="panel profile-panel profile-forms">
          <article className="profile-form-card">
            <h2>Change Name</h2>
            <form className="profile-form" onSubmit={handleNameSubmit}>
              <input
                value={nameInput}
                onChange={(event) => {
                  setNameInput(event.target.value);
                  setNameError("");
                }}
                placeholder="Display name"
                disabled={updatingName || loading}
              />
              {nameError ? <p className="field-error">{nameError}</p> : null}
              {nameNotice ? <p className="field-success">{nameNotice}</p> : null}
              <button type="submit" disabled={updatingName || loading}>
                {updatingName ? "Saving..." : "Save name"}
              </button>
            </form>
          </article>

          <article className="profile-form-card">
            <h2>Change Password</h2>
            <form className="profile-form" onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={passwordValues.currentPassword}
                onChange={(event) => handlePasswordField("currentPassword", event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
              />
              {passwordErrors.currentPassword ? (
                <p className="field-error">{passwordErrors.currentPassword}</p>
              ) : null}

              <input
                type="password"
                value={passwordValues.newPassword}
                onChange={(event) => handlePasswordField("newPassword", event.target.value)}
                placeholder="New password"
                autoComplete="new-password"
              />
              {passwordErrors.newPassword ? (
                <p className="field-error">{passwordErrors.newPassword}</p>
              ) : null}

              <input
                type="password"
                value={passwordValues.confirmPassword}
                onChange={(event) => handlePasswordField("confirmPassword", event.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              {passwordErrors.confirmPassword ? (
                <p className="field-error">{passwordErrors.confirmPassword}</p>
              ) : null}

              {passwordNotice ? <p className="field-success">{passwordNotice}</p> : null}

              <button type="submit" disabled={updatingPassword}>
                {updatingPassword ? "Updating..." : "Update password"}
              </button>
            </form>
          </article>
        </section>
      </section>
    </AppShell>
  );
}
