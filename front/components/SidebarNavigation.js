"use client";

import { useMutation, gql } from "@apollo/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CREATE_DOCUMENT } from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="nav-icon-svg">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M6.5 9.5v10h11v-10" />
    </Icon>
  );
}

function DocumentsIcon() {
  return (
    <Icon>
      <path d="M4 6.5h6l2 2H20v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 8.5h16" />
    </Icon>
  );
}

function DiscoverIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="5" />
      <path d="m15 15 5 5" />
    </Icon>
  );
}

function DiaryIcon() {
  return (
    <Icon>
      <path d="M6 2h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </Icon>
  );
}

function UserIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.3-3 3.5-4.5 6.5-4.5S17.2 16 18.5 19" />
    </Icon>
  );
}

function InviteIcon() {
  return (
    <Icon>
      <path d="M4 7h16v10H4z" />
      <path d="m4 8 8 5 8-5" />
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 3.8v2.1M12 18.1v2.1M20.2 12h-2.1M5.9 12H3.8" />
      <path d="m17.8 6.2-1.5 1.5M7.7 16.3l-1.5 1.5M6.2 6.2l1.5 1.5M16.3 16.3l1.5 1.5" />
    </Icon>
  );
}

function LogoutIcon() {
  return (
    <Icon>
      <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M9 12h9" />
    </Icon>
  );
}

function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

function CollapseIcon({ collapsed }) {
  return collapsed ? (
    <Icon>
      <path d="m9 5 6 7-6 7" />
    </Icon>
  ) : (
    <Icon>
      <path d="m15 5-6 7 6 7" />
    </Icon>
  );
}

function isDashboardPath(pathname) {
  return pathname === "/";
}

function isDocumentsPath(pathname) {
  return pathname === "/documents" || pathname.startsWith("/doc/");
}

function isDiscoverPath(pathname) {
  return pathname === "/discover";
}

function isDiariesPath(pathname) {
  return pathname === "/diaries" || pathname.startsWith("/diaries");
}

export default function SidebarNavigation({
  variant = "default",
  isOpen = true,
  overlayMode = false,
  onToggleSidebar,
  onNavigate,
  onLogout
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createIsPublic, setCreateIsPublic] = useState(false);
  const [createType, setCreateType] = useState("document");
  const [createError, setCreateError] = useState("");
  const [createDocument, { loading: creatingDocument }] = useMutation(CREATE_DOCUMENT);
  const CREATE_DIARY_ENTRY = gql`
    mutation CreateDiaryEntry($documentId: ID!, $date: String, $mood: String, $text: String!, $pageNumber: Int) {
      createDiaryEntry(documentId: $documentId, date: $date, mood: $mood, text: $text, pageNumber: $pageNumber) {
        id
      }
    }
  `;
  const [createDiaryEntry, { loading: creatingDiaryEntry }] = useMutation(CREATE_DIARY_ENTRY);
  const collapsed = !isOpen;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!showCreateDialog) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && !creatingDocument) {
        closeCreateDialog();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateDialog, creatingDocument]);

  function openCreateDialog() {
    setCreateError("");
    setCreateTitle("");
    setCreateIsPublic(false);
    setCreateType("document");
    onNavigate?.();
    setShowCreateDialog(true);
  }

  function closeCreateDialog() {
    setShowCreateDialog(false);
    setCreateError("");
    setCreateIsPublic(false);
    setCreateType("document");
  }

  async function handleCreateDocument(event) {
    event.preventDefault();

    const title = String(createTitle || "").trim();
    if (!title) {
      setCreateError("Document title is required.");
      return;
    }

    setCreateError("");
    try {
      const result = await createDocument({
        variables: {
          title,
          content: "",
          isPublic: createIsPublic
        }
      });

      closeCreateDialog();
      onNavigate?.();

      const createdId = result.data?.createDocument?.id;
      const busy = creatingDocument || creatingDiaryEntry;
      if (createdId) {
        if (createType === "diary") {
          try {
            // create an initial empty diary entry so the document is recognized as a diary
            await createDiaryEntry({ variables: { documentId: createdId, date: new Date().toISOString(), text: "" } });
          } catch (e) {
            console.warn("failed to create initial diary entry", e);
          }
        }
        router.push(`/doc/${createdId}`);
      }
    } catch (error) {
      setCreateError(toFriendlyError(error));
    }
  }

  const sidebarClassName = [
    "app-sidebar",
    collapsed ? "collapsed" : "",
    (variant === "editor" || overlayMode) ? "overlay" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <aside className={sidebarClassName}>
      <div className="app-sidebar-top">
        <Link href="/" className="app-brand" aria-label="Go to dashboard" onClick={onNavigate}>
          <span className="nav-icon" aria-hidden="true">
            <HomeIcon />
          </span>
          {hydrated && !collapsed ? (
            <span className="app-brand-text">
              <strong>SyncNote</strong>
              <small>Collaborative workspace</small>
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          className="nav-link sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="nav-icon" aria-hidden="true">
            <CollapseIcon collapsed={collapsed} />
          </span>
          {hydrated && !collapsed ? <span className="nav-label">Collapse</span> : null}
        </button>

        <button
          type="button"
          className="nav-link sidebar-create-btn"
          onClick={openCreateDialog}
          disabled={creatingDocument}
          title="Create document"
        >
          <span className="nav-icon" aria-hidden="true">
            <PlusIcon />
          </span>
          {hydrated && !collapsed ? <span className="nav-label">New Document</span> : null}
        </button>
      </div>

      <div className="app-sidebar-scroll">
        <nav className="app-nav" aria-label="Main navigation">
          <Link
            href="/"
            className={isDashboardPath(pathname) ? "nav-link active" : "nav-link"}
            aria-label="Dashboard"
            title="Dashboard"
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">
              <HomeIcon />
            </span>
            {hydrated && !collapsed ? <span className="nav-label">Dashboard</span> : null}
          </Link>

          <Link
            href="/documents"
            className={isDocumentsPath(pathname) ? "nav-link active" : "nav-link"}
            aria-label="All Documents"
            title="All Documents"
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">
              <DocumentsIcon />
            </span>
            {hydrated && !collapsed ? <span className="nav-label">All Documents</span> : null}
          </Link>

          <Link
            href="/diaries/mine"
            className={isDiariesPath(pathname) ? "nav-link active" : "nav-link"}
            aria-label="My Diaries"
            title="My Diaries"
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">
              <DiaryIcon />
            </span>
            {hydrated && !collapsed ? <span className="nav-label">My Diaries</span> : null}
          </Link>

          <Link
            href="/discover"
            className={isDiscoverPath(pathname) ? "nav-link active" : "nav-link"}
            aria-label="Discover"
            title="Discover"
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">
              <DiscoverIcon />
            </span>
            {hydrated && !collapsed ? <span className="nav-label">Discover</span> : null}
          </Link>

          <Link
            href="/profile"
            className={pathname === "/profile" ? "nav-link active" : "nav-link"}
            aria-label="Profile"
            title="Profile"
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">
              <UserIcon />
            </span>
            {hydrated && !collapsed ? <span className="nav-label">Profile</span> : null}
          </Link>

          <Link
            href="/invitations"
            className={pathname === "/invitations" ? "nav-link active" : "nav-link"}
            aria-label="Invitations"
            title="Invitations"
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">
              <InviteIcon />
            </span>
            {hydrated && !collapsed ? <span className="nav-label">Invitations</span> : null}
          </Link>

          <Link
            href="/settings"
            className={pathname === "/settings" ? "nav-link active" : "nav-link"}
            aria-label="Settings"
            title="Settings"
            onClick={onNavigate}
          >
            <span className="nav-icon" aria-hidden="true">
              <SettingsIcon />
            </span>
            {hydrated && !collapsed ? <span className="nav-label">Settings</span> : null}
          </Link>
        </nav>
      </div>

      <div className="app-sidebar-bottom">
        <button
          type="button"
          className="nav-link logout-link"
          onClick={onLogout}
          aria-label="Logout"
          title="Logout"
        >
          <span className="nav-icon" aria-hidden="true">
            <LogoutIcon />
          </span>
          {hydrated && !collapsed ? <span className="nav-label">Logout</span> : null}
        </button>
      </div>

      </aside>

      {showCreateDialog ? (
        <section
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!creatingDocument) {
              closeCreateDialog();
            }
          }}
        >
          <article
            className="panel modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-document-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="create-document-title">Create Document</h3>
            <p className="list-meta">Duplicate names are allowed.</p>
            <form className="sidebar-create-form" onSubmit={handleCreateDocument}>
              <input
                autoFocus
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="Document title"
                disabled={creatingDocument}
              />
              <label className="sidebar-doc-type">
                <span>Type</span>
                <select value={createType} onChange={(e) => setCreateType(e.target.value)} disabled={creatingDocument || creatingDiaryEntry}>
                  <option value="document">Document</option>
                  <option value="diary">Diary</option>
                </select>
              </label>
              <label className="sidebar-visibility-toggle">
                <input
                  type="checkbox"
                  checked={createIsPublic}
                  onChange={(event) => setCreateIsPublic(event.target.checked)}
                  disabled={creatingDocument}
                />
                <span>Public document (discoverable in search)</span>
              </label>
              {createError ? <p className="field-error">{createError}</p> : null}
              <div className="sidebar-create-actions">
                <button type="button" onClick={closeCreateDialog} disabled={creatingDocument}>
                  Cancel
                </button>
                <button type="submit" disabled={creatingDocument}>
                  {creatingDocument ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </article>
        </section>
      ) : null}
    </>
  );
}
