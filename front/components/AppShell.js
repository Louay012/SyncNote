"use client";

import { useEffect, useState } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import SidebarNavigation from "@/components/SidebarNavigation";

const SIDEBAR_STATE_KEY = "syncnote-sidebar-open";

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
  const defaultOpen = true;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(readSidebarState(defaultOpen));
  }, [defaultOpen]);

  useEffect(() => {
    if (!isEditorVariant || !isOpen) {
      return undefined;
    }

    function onEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isEditorVariant, isOpen]);

  function handleToggleSidebar() {
    setIsOpen((current) => {
      const next = !current;
      writeSidebarState(next);
      return next;
    });
  }

  function handleNavigate() {
    if (isEditorVariant) {
      setIsOpen(false);
    }
  }

  const shellClassName = [
    "app-shell",
    isEditorVariant ? "app-shell-editor" : "",
    isOpen ? "sidebar-open" : "sidebar-closed"
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={shellClassName}>
      {isEditorVariant && isOpen ? (
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
        onToggleSidebar={handleToggleSidebar}
        onNavigate={handleNavigate}
        onLogout={onLogout}
      />

      <section className="app-main">
        <header className="app-header">
          <div className="app-header-main">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <NotificationCenter />
        </header>
        {children}
      </section>
    </main>
  );
}
