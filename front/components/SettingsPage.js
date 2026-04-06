"use client";

import { useApolloClient } from "@apollo/client";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { clearStoredToken } from "@/lib/authToken";

export default function SettingsPage() {
  const router = useRouter();
  const apolloClient = useApolloClient();

  function handleLogout() {
    clearStoredToken();
    apolloClient.clearStore();
    router.replace("/auth");
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Customize your workspace preferences."
      onLogout={handleLogout}
    >
      <section className="panel settings-panel">
        <h2>Appearance</h2>
        <div className="settings-row">
          <div>
            <p className="settings-label">Theme</p>
            <p className="list-meta">Choose from light, dark, or curated color presets.</p>
          </div>
          <ThemeToggle inline />
        </div>
      </section>

      <section className="panel settings-panel">
        <h2>Workspace</h2>
        <ul className="auth-points">
          <li>Editor behavior preferences</li>
          <li>Notification preferences</li>
          <li>Collaboration defaults</li>
        </ul>
        <p className="list-meta">More settings options will be added in upcoming iterations.</p>
      </section>
    </AppShell>
  );
}
