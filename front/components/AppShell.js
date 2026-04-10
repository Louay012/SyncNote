"use client";

import { useEffect, useRef, useState } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import SidebarNavigation from "@/components/SidebarNavigation";

const SIDEBAR_STATE_KEY = "syncnote-sidebar-open";
const TABLET_MAX_WIDTH = 1024;
const MOBILE_MAX_WIDTH = 767;

function getViewportMode() {
  if (typeof window === "undefined") {
    return "desktop";
  }

  if (window.innerWidth <= MOBILE_MAX_WIDTH) {
    return "mobile";
  }

  if (window.innerWidth <= TABLET_MAX_WIDTH) {
    return "tablet";
  }

  return "desktop";
}

function readSidebarState(defaultOpen) {
  if (typeof window === "undefined") {
    return defaultOpen;
  }

  const saved = window.localStorage.getItem(SIDEBAR_STATE_KEY);
  if (saved === "1") {
    return true;
  }

  if (saved === "0") {
    return false;
  }

  return defaultOpen;
}

function writeSidebarState(isOpen) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SIDEBAR_STATE_KEY, isOpen ? "1" : "0");
}

export default function AppShell({
  title,
  subtitle = "",
  onLogout,
  children,
  variant = "default"
}) {
  const isEditorVariant = variant === "editor";
  const [viewportMode, setViewportMode] = useState(() => getViewportMode());
  const previousViewportModeRef = useRef(viewportMode);
  const isCompactViewport = viewportMode !== "desktop";

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const currentViewportMode = getViewportMode();
    if (currentViewportMode !== "desktop") {
      return false;
    }

    return readSidebarState(true);
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function updateViewportMode() {
      setViewportMode(getViewportMode());
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    const previousViewportMode = previousViewportModeRef.current;
    if (previousViewportMode === viewportMode) {
      return;
    }

    previousViewportModeRef.current = viewportMode;

    if (viewportMode !== "desktop") {
      setIsOpen(false);
      return;
    }

    setIsOpen(readSidebarState(true));
  }, [viewportMode]);

  useEffect(() => {
    if (!isCompactViewport || !isOpen) {
      return undefined;
    }

    function onEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isCompactViewport, isOpen]);

  function handleToggleSidebar() {
    setIsOpen((current) => {
      const next = !current;
      if (viewportMode === "desktop") {
        writeSidebarState(next);
      }
      return next;
    });
  }

  function handleNavigate() {
    if (isCompactViewport) {
      setIsOpen(false);
    }
  }

  const shellControls = {
    isSidebarOpen: isOpen,
    isCompactViewport,
    viewportMode,
    toggleSidebar: handleToggleSidebar,
    openSidebar: () => setIsOpen(true),
    closeSidebar: () => setIsOpen(false)
  };

  const renderedChildren =
    typeof children === "function" ? children(shellControls) : children;

  const shellClassName = [
    "app-shell",
    isEditorVariant ? "app-shell-editor" : "",
    isCompactViewport ? "app-shell-compact" : "",
    isOpen ? "sidebar-open" : "sidebar-closed"
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={shellClassName}>
      {isCompactViewport && isOpen ? (
        <button
          type="button"
          className="app-overlay-backdrop"
          onClick={() => setIsOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <SidebarNavigation
        variant={variant}
        isOpen={isOpen}
        overlayMode={isCompactViewport}
        onToggleSidebar={handleToggleSidebar}
        onNavigate={handleNavigate}
        onLogout={onLogout}
      />

      <section className="app-main">
        <header className="app-header">
          <div className="app-header-main">
            <button
              type="button"
              className="app-header-nav-toggle"
              onClick={handleToggleSidebar}
              aria-label={isOpen ? "Close navigation" : "Open navigation"}
            >
              Menu
            </button>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <NotificationCenter />
        </header>
        {renderedChildren}
      </section>
    </main>
  );
}
