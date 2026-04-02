"use client";

import SidebarNavigation from "@/components/SidebarNavigation";

export default function AppShell({ title, subtitle = "", onLogout, children }) {
  return (
    <main className="app-shell">
      <SidebarNavigation onLogout={onLogout} />

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
