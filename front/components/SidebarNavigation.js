"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CREATE_DOCUMENT, GET_MY_DOCUMENTS, GET_SHARED_DOCUMENTS } from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

const SIDEBAR_DOC_LIMIT = 4;

const listVariables = {
  limit: SIDEBAR_DOC_LIMIT,
  offset: 0,
  sortBy: "UPDATED_AT",
  sortDirection: "DESC"
};

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="nav-icon-svg">
      {children}
    </svg>
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

function UserIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.3-3 3.5-4.5 6.5-4.5S17.2 16 18.5 19" />
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

function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
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

function RecentDocuments({ documents = [], pathname, onNavigate }) {
  return (
    <section className="sidebar-doc-group" aria-label="Recent Documents">
      <div className="sidebar-doc-group-head">
        <h3>Recent Documents</h3>
        <Link href="/" className="sidebar-doc-see-all" onClick={onNavigate}>
          See all
        </Link>
      </div>
      {documents.length === 0 ? (
        <p className="sidebar-doc-empty">No recent documents</p>
      ) : (
        <div className="sidebar-doc-list">
          {documents.map((doc) => {
            const href = `/doc/${doc.id}`;
            const isActive = pathname === href;

            return (
              <Link
                key={doc.id}
                href={href}
                className={isActive ? "sidebar-doc-link active" : "sidebar-doc-link"}
                title={doc.title}
                onClick={onNavigate}
              >
                {doc.title}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function isDashboardPath(pathname) {
  return pathname === "/" || pathname.startsWith("/doc/");
}

function normalizeScope(scopeValue) {
  if (scopeValue === "my" || scopeValue === "shared") {
    return scopeValue;
  }

  return "all";
}

export default function SidebarNavigation({
  variant = "default",
  isOpen = true,
  onToggleSidebar,
  onNavigate,
  onLogout
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const collapsed = !isOpen;
  const activeScope = normalizeScope(searchParams.get("scope"));
  const allDocsActive = isDashboardPath(pathname);
  const myDocsFilterActive = pathname === "/" && activeScope === "my";
  const sharedDocsFilterActive = pathname === "/" && activeScope === "shared";

  const {
    data: myDocumentsData,
    loading: loadingMine,
    error: mineError,
    refetch: refetchMine
  } = useQuery(GET_MY_DOCUMENTS, {
    variables: listVariables,
    fetchPolicy: "cache-and-network"
  });

  const {
    data: sharedDocumentsData,
    loading: loadingShared,
    error: sharedError,
    refetch: refetchShared
  } = useQuery(GET_SHARED_DOCUMENTS, {
    variables: listVariables,
    fetchPolicy: "cache-and-network"
  });

  const [createDocument, { loading: creatingDocument }] = useMutation(CREATE_DOCUMENT);

  const myDocuments = myDocumentsData?.myDocuments?.items || [];
  const sharedDocuments = sharedDocumentsData?.sharedWithMeDocuments?.items || [];
  const documentsError = mineError || sharedError;

  const recentDocuments = [
    ...myDocuments,
    ...sharedDocuments
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter((doc, index, source) => {
      return source.findIndex((item) => String(item.id) === String(doc.id)) === index;
    })
    .slice(0, SIDEBAR_DOC_LIMIT);

  function openCreateDialog() {
    setCreateError("");
    setCreateTitle("");
    setShowCreateDialog(true);
  }

  function closeCreateDialog() {
    setShowCreateDialog(false);
    setCreateError("");
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
          content: ""
        }
      });

      const createdId = result.data?.createDocument?.id;
      await Promise.all([refetchMine(), refetchShared()]);
      closeCreateDialog();
      onNavigate?.();

      if (createdId) {
        router.push(`/doc/${createdId}`);
      }
    } catch (error) {
      setCreateError(toFriendlyError(error));
    }
  }

  const sidebarClassName = [
    "app-sidebar",
    collapsed ? "collapsed" : "",
    variant === "editor" ? "overlay" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <aside className={sidebarClassName}>
        <div className="app-sidebar-top">
          <div className={collapsed ? "app-brand-shell collapsed" : "app-brand-shell"}>
            <button
              type="button"
              className="sidebar-hamburger"
              onClick={onToggleSidebar}
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <span aria-hidden="true">☰</span>
            </button>

            {!collapsed ? (
              <Link
                href="/"
                className="app-brand"
                aria-label="Go to all documents"
                onClick={onNavigate}
              >
                <span className="app-brand-text">
                  <strong>SyncNote</strong>
                  <small>Collaborative workspace</small>
                </span>
              </Link>
            ) : null}
          </div>

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
            {!collapsed ? <span className="nav-label">Create Document</span> : null}
          </button>
        </div>

        <div className="app-sidebar-scroll">
          <nav className="app-nav" aria-label="Main navigation">
            <div className="all-docs-nav-group">
              <Link
                href="/"
                className={allDocsActive ? "nav-link active" : "nav-link"}
                aria-label="All Documents"
                title="All Documents"
                onClick={onNavigate}
              >
                <span className="nav-icon" aria-hidden="true">
                  <DocumentsIcon />
                </span>
                {!collapsed ? <span className="nav-label">All Documents</span> : null}
              </Link>

              {!collapsed ? (
                <div className="all-docs-sub-links" aria-label="All documents filters">
                  <Link
                    href="/?scope=my"
                    className={
                      myDocsFilterActive ? "all-docs-sub-link active" : "all-docs-sub-link"
                    }
                    onClick={onNavigate}
                  >
                    My Documents
                  </Link>
                  <Link
                    href="/?scope=shared"
                    className={
                      sharedDocsFilterActive
                        ? "all-docs-sub-link active"
                        : "all-docs-sub-link"
                    }
                    onClick={onNavigate}
                  >
                    Shared with Me
                  </Link>
                </div>
              ) : null}
            </div>
          </nav>

          {!collapsed ? (
            <section className="sidebar-docs" aria-label="Recent documents">
              <RecentDocuments
                documents={recentDocuments}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            </section>
          ) : null}

          {!collapsed && (loadingMine || loadingShared) ? (
            <p className="sidebar-doc-meta">Loading documents...</p>
          ) : null}

          {!collapsed && documentsError ? (
            <p className="sidebar-inline-error">{toFriendlyError(documentsError)}</p>
          ) : null}
        </div>

        <div className="app-sidebar-bottom">
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
            {!collapsed ? <span className="nav-label">Profile</span> : null}
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
            {!collapsed ? <span className="nav-label">Settings</span> : null}
          </Link>

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
            {!collapsed ? <span className="nav-label">Logout</span> : null}
          </button>
        </div>
      </aside>

      {showCreateDialog ? (
        <section className="modal-backdrop" role="presentation">
          <article className="panel modal-card" role="dialog" aria-modal="true">
            <h3>Create Document</h3>
            <p className="list-meta">Duplicate names are allowed.</p>
            <form className="sidebar-create-form" onSubmit={handleCreateDocument}>
              <input
                autoFocus
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="Document title"
                disabled={creatingDocument}
              />
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
