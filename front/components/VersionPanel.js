"use client";

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

export default function VersionPanel({
  versions,
  onSaveVersion,
  onRestoreVersion,
  loading,
  disabled
}) {
  return (
    <section className="version-tab-panel">
      <div className="version-header">
        <h3>Version History</h3>
        <button type="button" onClick={onSaveVersion} disabled={disabled || loading}>
          {loading ? "Working..." : "Save snapshot"}
        </button>
      </div>

      <div className="version-list">
        {versions.length === 0 ? <p className="empty">No versions saved yet.</p> : null}
        {versions.map((version) => (
          <article key={version.id} className="version-item">
            <div>
              <strong>{formatDate(version.createdAt)}</strong>
              <small>By {version.createdBy?.name || "Unknown"}</small>
            </div>
            <button
              type="button"
              onClick={() => onRestoreVersion(version.id)}
              disabled={disabled || loading}
            >
              Restore
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
