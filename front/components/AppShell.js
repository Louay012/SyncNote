"use client";

import { useEffect, useState } from "react";
import SidebarNavigation from "@/components/SidebarNavigation";

export default function AppShell({
  title,
  subtitle = "",
  onLogout,
  children,
  variant = "default"
}) {
  const isEditorVariant = variant === "editor";
  const defaultOpen = !isEditorVariant;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
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
    setIsOpen((current) => !current);
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
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
        {children}
      </section>
    </main>
  );
}
