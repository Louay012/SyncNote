"use client";

import { useEffect, useState } from "react";

export default function TabsPanel({ tabs, defaultTabId, onRequestClose = null }) {
  const availableTabs = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
  const initial = defaultTabId || availableTabs[0]?.id || "";
  const [activeTabId, setActiveTabId] = useState(initial);

  useEffect(() => {
    if (!availableTabs.length) {
      setActiveTabId("");
      return;
    }

    const exists = availableTabs.some((tab) => tab.id === activeTabId);
    if (!exists) {
      setActiveTabId(defaultTabId || availableTabs[0].id);
    }
  }, [availableTabs, activeTabId, defaultTabId]);

  const activeTab = availableTabs.find((tab) => tab.id === activeTabId) || availableTabs[0];

  return (
    <section className="panel tabs-panel">
      <div className="tabs-panel-top">
        <h3>Workspace Panels</h3>
        {typeof onRequestClose === "function" ? (
          <button
            type="button"
            className="tabs-close-btn"
            onClick={onRequestClose}
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="tabs-header" role="tablist" aria-label="Workspace panels">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab?.id}
            className={tab.id === activeTab?.id ? "tab-btn active" : "tab-btn"}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined ? <small>{tab.badge}</small> : null}
          </button>
        ))}
      </div>

      <div className="tab-body">{activeTab?.content || null}</div>
    </section>
  );
}
