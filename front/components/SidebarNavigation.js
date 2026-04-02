"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isDashboardPath(pathname) {
  return pathname === "/" || pathname.startsWith("/doc/");
}

export default function SidebarNavigation({ onLogout }) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-top">
        <p className="badge">SYNCNOTE</p>
        <p className="sidebar-subtitle">Collaborative workspace</p>
      </div>

      <nav className="app-nav" aria-label="Main navigation">
        <Link href="/" className={isDashboardPath(pathname) ? "nav-link active" : "nav-link"}>
          Dashboard
        </Link>
        <Link
          href="/profile"
          className={pathname === "/profile" ? "nav-link active" : "nav-link"}
        >
          Profile
        </Link>
        <Link
          href="/settings"
          className={pathname === "/settings" ? "nav-link active" : "nav-link"}
        >
          Settings
        </Link>
      </nav>

      <div className="app-sidebar-bottom">
        <button type="button" className="nav-link logout-link" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
