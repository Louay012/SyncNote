"use client";

import { useEffect, useState } from "react";
import SidebarNavigation from "@/components/SidebarNavigation";

const SIDEBAR_STATE_KEY = "syncnote-sidebar-collapsed";

function readSidebarState() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STATE_KEY) === "1";
}

function writeSidebarState(collapsed) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "1" : "0");
}

export default function AppShell({
  title,
  subtitle = "",
  onLogout,
  children,
  variant = "default"
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readSidebarState());
  }, []);

  function handleToggleCollapse() {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarState(next);
      return next;
    });
  }

  const shellClassName = [
    "app-shell",
    variant === "editor" ? "app-shell-editor" : "",
    collapsed ? "app-shell-collapsed" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={shellClassName}>
      <SidebarNavigation
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
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
