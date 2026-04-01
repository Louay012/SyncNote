"use client";

export default function SectionItem({
  section,
  depth = 0,
  selectedSectionId,
  cursorUsers,
  onSelect,
  onAddChild,
  onDelete,
  onMove,
  siblingCount,
  siblingIndex,
  disabled
}) {
  const isSelected = String(selectedSectionId || "") === String(section.id);
  const isRoot = depth === 0;

  return (
    <article className={isSelected ? "section-row selected" : "section-row"}>
      <button
        type="button"
        className="section-main-btn"
        onClick={() => onSelect(section.id)}
        disabled={disabled}
      >
        <span className="section-name">{section.title}</span>
        <span className="section-kind">{isRoot ? "Section" : "Subsection"}</span>
        {cursorUsers?.length ? (
          <span className="section-cursor-badges" title="Live cursors">
            {cursorUsers.slice(0, 3).map((entry) => {
              const color = entry.cursorColor;

              return (
                <span
                  key={`${section.id}-${entry.cursorId || entry.userId}`}
                  className="section-cursor-dot"
                  style={{
                    backgroundColor: color?.bg,
                    color: color?.fg,
                    borderColor: color?.border
                  }}
                >
                  {(entry.user?.name || "U").slice(0, 1).toUpperCase()}
                </span>
              );
            })}
            {cursorUsers.length > 3 ? (
              <span className="section-cursor-count">+{cursorUsers.length - 3}</span>
            ) : null}
          </span>
        ) : null}
      </button>

      <div className="section-actions">
        <button
          type="button"
          onClick={() => onMove(section.id, siblingIndex - 1)}
          disabled={disabled || siblingIndex <= 0}
          className="tiny-btn"
        >
          Up
        </button>
        <button
          type="button"
          onClick={() => onMove(section.id, siblingIndex + 1)}
          disabled={disabled || siblingIndex >= siblingCount - 1}
          className="tiny-btn"
        >
          Down
        </button>
        {isRoot ? (
          <button
            type="button"
            onClick={() => onAddChild(section.id)}
            disabled={disabled}
            className="tiny-btn"
          >
            Add sub
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          disabled={disabled}
          className="tiny-btn danger"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
