"use client";

export default function SectionItem({
  section,
  depth = 0,
  selectedSectionId,
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
