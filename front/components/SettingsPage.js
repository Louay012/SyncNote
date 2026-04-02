"use client";

import { useApolloClient } from "@apollo/client";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
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
      subtitle="Configure your workspace preferences."
      onLogout={handleLogout}
    >
      <section className="panel settings-panel">
        <h2>General Preferences</h2>
        <ul className="auth-points">
          <li>Theme toggle preference (light/dark)</li>
          <li>Editor behavior preferences</li>
          <li>Notification preferences</li>
        </ul>
        <p className="list-meta">More settings options will be added in upcoming iterations.</p>
      </section>
    </AppShell>
  );
}
